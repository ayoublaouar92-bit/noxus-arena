import { ipcMain } from "electron";

type TournamentStatus =
  | "Draft"
  | "Registration"
  | "Running"
  | "Completed";

type CreateTournamentData = {
  name: string;
  game: string;
  startAt: string;
  maxPlayers: number;
  entryFee: number;
  prize: number;
};

type RegisterPlayerData = {
  tournamentId: number;
  playerId: number;
};

type PlayerRow = {
  id: number;
  name: string;
  username: string;
  walletBalance: number;
  debtBalance: number;
};

type TournamentRow = {
  id: number;
  name: string;
  game: string;
  startAt: string;
  maxPlayers: number;
  entryFee: number;
  prize: number;
  status: TournamentStatus;
  createdAt: string;
};

function registerHandler(
  channel: string,
  handler: (...args: any[]) => any
) {
  ipcMain.removeHandler(channel);

  ipcMain.handle(
    channel,
    handler
  );
}

export function registerTournamentHandlers(
  db: any
) {
  /*
  |--------------------------------------------------------------------------
  | Tables
  |--------------------------------------------------------------------------
  */

  db.exec(`
    CREATE TABLE IF NOT EXISTS
      tournaments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        game TEXT NOT NULL,
        startAt TEXT NOT NULL,
        maxPlayers INTEGER NOT NULL DEFAULT 8,
        entryFee REAL NOT NULL DEFAULT 0,
        prize REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'Draft',
        createdAt TEXT NOT NULL
          DEFAULT CURRENT_TIMESTAMP
      );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS
      tournament_participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tournamentId INTEGER NOT NULL,
        playerId INTEGER NOT NULL,
        entryFee REAL NOT NULL DEFAULT 0,
        walletPaid REAL NOT NULL DEFAULT 0,
        debtAdded REAL NOT NULL DEFAULT 0,
        joinedAt TEXT NOT NULL
          DEFAULT CURRENT_TIMESTAMP,

        UNIQUE (
          tournamentId,
          playerId
        ),

        FOREIGN KEY (tournamentId)
          REFERENCES tournaments(id)
          ON DELETE CASCADE,

        FOREIGN KEY (playerId)
          REFERENCES players(id)
      );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS
      idx_tournaments_status
    ON tournaments(status);

    CREATE INDEX IF NOT EXISTS
      idx_tournament_participants_tournament
    ON tournament_participants(
      tournamentId
    );

    CREATE INDEX IF NOT EXISTS
      idx_tournament_participants_player
    ON tournament_participants(
      playerId
    );
  `);

  /*
  |--------------------------------------------------------------------------
  | Get tournaments
  |--------------------------------------------------------------------------
  */

  registerHandler(
    "tournaments:get-all",
    () => {
      return db
        .prepare(
          `
            SELECT
              tournaments.*,

              (
                SELECT COUNT(*)
                FROM tournament_participants
                WHERE
                  tournament_participants.tournamentId =
                  tournaments.id
              ) AS participantCount

            FROM tournaments
            ORDER BY
              datetime(startAt) ASC,
              id DESC
          `
        )
        .all();
    }
  );

  /*
  |--------------------------------------------------------------------------
  | Create tournament
  |--------------------------------------------------------------------------
  */

  registerHandler(
    "tournaments:create",
    (
      _event,
      data: CreateTournamentData
    ) => {
      const name =
        data.name?.trim();

      const game =
        data.game?.trim();

      const maxPlayers =
        Math.max(
          2,
          Math.floor(
            Number(
              data.maxPlayers || 0
            )
          )
        );

      const entryFee =
        Math.max(
          0,
          Number(
            data.entryFee || 0
          )
        );

      const prize =
        Math.max(
          0,
          Number(
            data.prize || 0
          )
        );

      if (!name) {
        throw new Error(
          "Tournament name is required"
        );
      }

      if (!game) {
        throw new Error(
          "Game is required"
        );
      }

      if (!data.startAt) {
        throw new Error(
          "Start date is required"
        );
      }

      if (
        Number.isNaN(
          new Date(
            data.startAt
          ).getTime()
        )
      ) {
        throw new Error(
          "Invalid start date"
        );
      }

      const result = db
        .prepare(
          `
            INSERT INTO tournaments
            (
              name,
              game,
              startAt,
              maxPlayers,
              entryFee,
              prize,
              status
            )
            VALUES
            (
              ?,
              ?,
              ?,
              ?,
              ?,
              ?,
              'Draft'
            )
          `
        )
        .run(
          name,
          game,
          data.startAt,
          maxPlayers,
          entryFee,
          prize
        );

      return {
        id: Number(
          result.lastInsertRowid
        ),

        changes:
          result.changes,
      };
    }
  );

  /*
  |--------------------------------------------------------------------------
  | Update status
  |--------------------------------------------------------------------------
  */

  registerHandler(
    "tournaments:set-status",
    (
      _event,
      data: {
        tournamentId: number;
        status: TournamentStatus;
      }
    ) => {
      const allowedStatuses:
        TournamentStatus[] = [
        "Draft",
        "Registration",
        "Running",
        "Completed",
      ];

      if (
        !allowedStatuses.includes(
          data.status
        )
      ) {
        throw new Error(
          "Invalid tournament status"
        );
      }

      const tournament = db
        .prepare(
          `
            SELECT *
            FROM tournaments
            WHERE id = ?
          `
        )
        .get(
          data.tournamentId
        ) as
        | TournamentRow
        | undefined;

      if (!tournament) {
        throw new Error(
          "Tournament not found"
        );
      }

      db.prepare(
        `
          UPDATE tournaments
          SET status = ?
          WHERE id = ?
        `
      ).run(
        data.status,
        data.tournamentId
      );

      return {
        id: data.tournamentId,
        status: data.status,
      };
    }
  );

  /*
  |--------------------------------------------------------------------------
  | Tournament participants
  |--------------------------------------------------------------------------
  */

  registerHandler(
    "tournaments:get-participants",
    (
      _event,
      tournamentId: number
    ) => {
      return db
        .prepare(
          `
            SELECT
              tournament_participants.*,
              players.name
                AS playerName,
              players.username
                AS playerUsername,
              players.phone
                AS playerPhone,
              players.walletBalance
                AS playerWallet,
              players.debtBalance
                AS playerDebt,
              players.image
                AS playerImage

            FROM tournament_participants

            INNER JOIN players
              ON players.id =
                tournament_participants.playerId

            WHERE
              tournament_participants.tournamentId =
              ?

            ORDER BY
              tournament_participants.id DESC
          `
        )
        .all(tournamentId);
    }
  );

  /*
  |--------------------------------------------------------------------------
  | Register player
  |--------------------------------------------------------------------------
  */

  registerHandler(
    "tournaments:register-player",
    (
      _event,
      data: RegisterPlayerData
    ) => {
      if (!data.tournamentId) {
        throw new Error(
          "Tournament is required"
        );
      }

      if (!data.playerId) {
        throw new Error(
          "Player is required"
        );
      }

      const tournament = db
        .prepare(
          `
            SELECT *
            FROM tournaments
            WHERE id = ?
          `
        )
        .get(
          data.tournamentId
        ) as
        | TournamentRow
        | undefined;

      if (!tournament) {
        throw new Error(
          "Tournament not found"
        );
      }

      if (
        tournament.status !==
        "Registration"
      ) {
        throw new Error(
          "Tournament registration is closed"
        );
      }

      const participantCount =
        db
          .prepare(
            `
              SELECT COUNT(*)
                AS total
              FROM tournament_participants
              WHERE tournamentId = ?
            `
          )
          .get(
            tournament.id
          ) as {
          total: number;
        };

      if (
        Number(
          participantCount.total
        ) >=
        Number(
          tournament.maxPlayers
        )
      ) {
        throw new Error(
          "Tournament is full"
        );
      }

      const existingParticipant =
        db
          .prepare(
            `
              SELECT id
              FROM tournament_participants
              WHERE
                tournamentId = ?
                AND playerId = ?
            `
          )
          .get(
            tournament.id,
            data.playerId
          );

      if (existingParticipant) {
        throw new Error(
          "Player is already registered"
        );
      }

      const player = db
        .prepare(
          `
            SELECT *
            FROM players
            WHERE id = ?
          `
        )
        .get(
          data.playerId
        ) as
        | PlayerRow
        | undefined;

      if (!player) {
        throw new Error(
          "Player not found"
        );
      }

      const entryFee =
        Math.max(
          0,
          Number(
            tournament.entryFee || 0
          )
        );

      const currentWallet =
        Math.max(
          0,
          Number(
            player.walletBalance || 0
          )
        );

      const walletPaid =
        Math.min(
          currentWallet,
          entryFee
        );

      const debtAdded =
        entryFee - walletPaid;

      const newWallet =
        currentWallet -
        walletPaid;

      const newDebt =
        Number(
          player.debtBalance || 0
        ) + debtAdded;

      const transaction =
        db.transaction(() => {
          const result = db
            .prepare(
              `
                INSERT INTO
                  tournament_participants
                (
                  tournamentId,
                  playerId,
                  entryFee,
                  walletPaid,
                  debtAdded
                )
                VALUES
                (
                  ?,
                  ?,
                  ?,
                  ?,
                  ?
                )
              `
            )
            .run(
              tournament.id,
              player.id,
              entryFee,
              walletPaid,
              debtAdded
            );

          if (entryFee > 0) {
            db.prepare(
              `
                UPDATE players
                SET
                  walletBalance = ?,
                  debtBalance = ?
                WHERE id = ?
              `
            ).run(
              newWallet,
              newDebt,
              player.id
            );

            db.prepare(
              `
                INSERT INTO
                  wallet_transactions
                (
                  playerId,
                  type,
                  amount,
                  walletChange,
                  debtChange,
                  note
                )
                VALUES
                (
                  ?,
                  'TOURNAMENT_FEE',
                  ?,
                  ?,
                  ?,
                  ?
                )
              `
            ).run(
              player.id,
              entryFee,
              -walletPaid,
              debtAdded,
              `Tournament: ${tournament.name}`
            );
          }

          return result;
        });

      const result = transaction();

      return {
        id: Number(
          result.lastInsertRowid
        ),

        tournamentId:
          tournament.id,

        playerId:
          player.id,

        entryFee,

        walletPaid,

        debtAdded,

        walletBalance:
          newWallet,

        debtBalance:
          newDebt,
      };
    }
  );

  /*
  |--------------------------------------------------------------------------
  | Delete tournament
  |--------------------------------------------------------------------------
  */

  registerHandler(
    "tournaments:delete",
    (
      _event,
      tournamentId: number
    ) => {
      const tournament = db
        .prepare(
          `
            SELECT *
            FROM tournaments
            WHERE id = ?
          `
        )
        .get(
          tournamentId
        ) as
        | TournamentRow
        | undefined;

      if (!tournament) {
        throw new Error(
          "Tournament not found"
        );
      }

      const participantCount =
        db
          .prepare(
            `
              SELECT COUNT(*)
                AS total
              FROM tournament_participants
              WHERE tournamentId = ?
            `
          )
          .get(
            tournamentId
          ) as {
          total: number;
        };

      if (
        Number(
          participantCount.total
        ) > 0
      ) {
        throw new Error(
          "Tournament has participants and cannot be deleted"
        );
      }

      const result = db
        .prepare(
          `
            DELETE FROM tournaments
            WHERE id = ?
          `
        )
        .run(tournamentId);

      return {
        changes:
          result.changes,
      };
    }
  );
}