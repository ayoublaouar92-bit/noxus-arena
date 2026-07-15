import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Crown,
  Gamepad2,
  Play,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";

type TournamentStatus =
  | "Draft"
  | "Registration"
  | "Running"
  | "Completed";

type Tournament = {
  id: number;
  name: string;
  game: string;
  startAt: string;
  maxPlayers: number;
  entryFee: number;
  prize: number;
  status: TournamentStatus;
  participantCount: number;
  createdAt: string;
};

type Player = {
  id: number;
  name: string;
  username: string;
  walletBalance: number;
  debtBalance: number;
};

type Participant = {
  id: number;
  tournamentId: number;
  playerId: number;
  entryFee: number;
  walletPaid: number;
  debtAdded: number;
  playerName: string;
  playerUsername: string;
  playerWallet: number;
  playerDebt: number;
  playerImage: string | null;
  joinedAt: string;
};

const fieldClass =
  "h-11 w-full rounded-lg border border-white/10 bg-[#080b16] px-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-violet-400/60";

function normalizeNumber(
  value: string
) {
  const digitMap:
    Record<string, string> = {
    "&": "1",
    "é": "2",
    '"': "3",
    "'": "4",
    "(": "5",
    "-": "6",
    "è": "7",
    "_": "8",
    "ç": "9",
    "à": "0",

    "\u0660": "0",
    "\u0661": "1",
    "\u0662": "2",
    "\u0663": "3",
    "\u0664": "4",
    "\u0665": "5",
    "\u0666": "6",
    "\u0667": "7",
    "\u0668": "8",
    "\u0669": "9",

    "\u06F0": "0",
    "\u06F1": "1",
    "\u06F2": "2",
    "\u06F3": "3",
    "\u06F4": "4",
    "\u06F5": "5",
    "\u06F6": "6",
    "\u06F7": "7",
    "\u06F8": "8",
    "\u06F9": "9",
  };

  let normalized = value
    .split("")
    .map(
      (character) =>
        digitMap[character] ??
        character
    )
    .join("")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");

  const parts =
    normalized.split(".");

  if (parts.length > 1) {
    normalized =
      `${parts[0]}.` +
      parts.slice(1).join("");
  }

  return normalized;
}

function getStatusStyle(
  status: TournamentStatus
) {
  if (
    status === "Registration"
  ) {
    return "bg-sky-500/10 text-sky-300 border-sky-400/20";
  }

  if (status === "Running") {
    return "bg-emerald-500/10 text-emerald-300 border-emerald-400/20";
  }

  if (status === "Completed") {
    return "bg-amber-500/10 text-amber-300 border-amber-400/20";
  }

  return "bg-white/[0.05] text-white/40 border-white/10";
}

function getNextStatus(
  status: TournamentStatus
): TournamentStatus {
  if (status === "Draft") {
    return "Registration";
  }

  if (
    status === "Registration"
  ) {
    return "Running";
  }

  if (status === "Running") {
    return "Completed";
  }

  return "Completed";
}

export default function Tournaments() {
  const [
    tournaments,
    setTournaments,
  ] = useState<Tournament[]>([]);

  const [players, setPlayers] =
    useState<Player[]>([]);

  const [
    participants,
    setParticipants,
  ] = useState<Participant[]>([]);

  const [
    selectedTournament,
    setSelectedTournament,
  ] = useState<Tournament | null>(
    null
  );

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [
    registering,
    setRegistering,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [name, setName] =
    useState("");

  const [game, setGame] =
    useState("EA FC");

  const [startAt, setStartAt] =
    useState("");

  const [
    maxPlayers,
    setMaxPlayers,
  ] = useState("8");

  const [entryFee, setEntryFee] =
    useState("0");

  const [prize, setPrize] =
    useState("0");

  const [
    registrationPlayerId,
    setRegistrationPlayerId,
  ] = useState("");

  const api = (window as any).api;

  async function loadData(
    showLoading = false
  ) {
    try {
      if (showLoading) {
        setLoading(true);
      }

      setError("");

      const [
        tournamentResult,
        playerResult,
      ] = await Promise.all([
        api.getTournaments(),
        api.getPlayers(),
      ]);

      setTournaments(
        tournamentResult
      );

      setPlayers(playerResult);

      if (selectedTournament) {
        const updated =
          tournamentResult.find(
            (
              tournament:
                Tournament
            ) =>
              tournament.id ===
              selectedTournament.id
          );

        if (updated) {
          setSelectedTournament(
            updated
          );
        }
      }
    } catch (loadError) {
      console.error(loadError);

      setError(
        "تعذر تحميل البطولات"
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadParticipants(
    tournament: Tournament
  ) {
    try {
      setError("");

      setSelectedTournament(
        tournament
      );

      const result =
        await api.getTournamentParticipants(
          tournament.id
        );

      setParticipants(result);
    } catch (loadError) {
      console.error(loadError);

      setError(
        "تعذر تحميل المشاركين"
      );
    }
  }

  useEffect(() => {
    void loadData(true);
  }, []);

  const filteredTournaments =
    useMemo(() => {
      const query = search
        .trim()
        .toLowerCase();

      if (!query) {
        return tournaments;
      }

      return tournaments.filter(
        (tournament) =>
          tournament.name
            .toLowerCase()
            .includes(query) ||
          tournament.game
            .toLowerCase()
            .includes(query)
      );
    }, [tournaments, search]);

  async function createTournament(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      !name.trim() ||
      !game.trim() ||
      !startAt
    ) {
      setError(
        "أدخل اسم البطولة واللعبة والتاريخ"
      );

      return;
    }

    try {
      setSaving(true);
      setError("");

      await api.createTournament({
        name: name.trim(),
        game: game.trim(),

        startAt:
          new Date(
            startAt
          ).toISOString(),

        maxPlayers:
          Number(maxPlayers || 8),

        entryFee:
          Number(entryFee || 0),

        prize:
          Number(prize || 0),
      });

      setName("");
      setStartAt("");
      setMaxPlayers("8");
      setEntryFee("0");
      setPrize("0");

      await loadData();
    } catch (saveError) {
      console.error(saveError);

      setError(
        "تعذر إنشاء البطولة"
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(
    tournament: Tournament
  ) {
    if (
      tournament.status ===
      "Completed"
    ) {
      return;
    }

    const nextStatus =
      getNextStatus(
        tournament.status
      );

    try {
      await api.setTournamentStatus({
        tournamentId:
          tournament.id,

        status: nextStatus,
      });

      await loadData();

      if (
        selectedTournament?.id ===
        tournament.id
      ) {
        setSelectedTournament({
          ...tournament,
          status: nextStatus,
        });
      }
    } catch (statusError) {
      console.error(statusError);

      setError(
        "تعذر تحديث حالة البطولة"
      );
    }
  }

  async function registerPlayer(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      !selectedTournament ||
      !registrationPlayerId
    ) {
      setError(
        "اختر لاعبًا"
      );

      return;
    }

    try {
      setRegistering(true);
      setError("");

      const result =
        await api.registerTournamentPlayer(
          {
            tournamentId:
              selectedTournament.id,

            playerId:
              Number(
                registrationPlayerId
              ),
          }
        );

      window.alert(
        `تم تسجيل اللاعب\n` +
          `رسوم المشاركة: ${result.entryFee} DA\n` +
          `من المحفظة: ${result.walletPaid} DA\n` +
          `أضيف للدين: ${result.debtAdded} DA`
      );

      setRegistrationPlayerId(
        ""
      );

      await loadData();

      await loadParticipants(
        selectedTournament
      );
    } catch (registerError) {
      console.error(
        registerError
      );

      const message =
        registerError instanceof Error
          ? registerError.message
          : "";

      if (
        message.includes(
          "already registered"
        )
      ) {
        setError(
          "اللاعب مسجل مسبقًا"
        );
      } else if (
        message.includes("full")
      ) {
        setError(
          "البطولة ممتلئة"
        );
      } else {
        setError(
          "تعذر تسجيل اللاعب. تأكد أن التسجيل مفتوح."
        );
      }
    } finally {
      setRegistering(false);
    }
  }

  async function deleteTournament(
    tournament: Tournament
  ) {
    const confirmed =
      window.confirm(
        `هل تريد حذف ${tournament.name}؟`
      );

    if (!confirmed) {
      return;
    }

    try {
      await api.deleteTournament(
        tournament.id
      );

      if (
        selectedTournament?.id ===
        tournament.id
      ) {
        setSelectedTournament(null);
        setParticipants([]);
      }

      await loadData();
    } catch (deleteError) {
      console.error(deleteError);

      setError(
        "لا يمكن حذف بطولة لديها مشاركون"
      );
    }
  }

  const activeCount =
    tournaments.filter(
      (tournament) =>
        tournament.status ===
          "Registration" ||
        tournament.status ===
          "Running"
    ).length;

  const totalParticipants =
    tournaments.reduce(
      (total, tournament) =>
        total +
        Number(
          tournament.participantCount ||
            0
        ),
      0
    );

  const totalPrizes =
    tournaments.reduce(
      (total, tournament) =>
        total +
        Number(
          tournament.prize || 0
        ),
      0
    );

  return (
    <div
      dir="rtl"
      className="space-y-6"
    >
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-sm text-violet-300">
            Arena Competition
          </p>

          <h1 className="text-3xl font-semibold">
            البطولات / Tournaments
          </h1>

          <p className="mt-2 text-sm text-white/45">
            إنشاء البطولات وتسجيل
            اللاعبين وإدارة الرسوم
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            void loadData(true)
          }
          className="flex h-11 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm"
        >
          <RefreshCw
            size={17}
            className={
              loading
                ? "animate-spin"
                : ""
            }
          />

          تحديث
        </button>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-white/[0.08] bg-[#0c101d] p-5">
          <Trophy className="text-violet-300" />

          <p className="mt-4 text-2xl font-semibold">
            {tournaments.length}
          </p>

          <p className="mt-1 text-xs text-white/35">
            إجمالي البطولات
          </p>
        </article>

        <article className="rounded-xl border border-white/[0.08] bg-[#0c101d] p-5">
          <Play className="text-emerald-300" />

          <p className="mt-4 text-2xl font-semibold">
            {activeCount}
          </p>

          <p className="mt-1 text-xs text-white/35">
            بطولات نشطة
          </p>
        </article>

        <article className="rounded-xl border border-white/[0.08] bg-[#0c101d] p-5">
          <Users className="text-sky-300" />

          <p className="mt-4 text-2xl font-semibold">
            {totalParticipants}
          </p>

          <p className="mt-1 text-xs text-white/35">
            إجمالي المشاركين
          </p>
        </article>

        <article className="rounded-xl border border-white/[0.08] bg-[#0c101d] p-5">
          <Crown className="text-amber-300" />

          <p
            dir="ltr"
            className="mt-4 text-2xl font-semibold"
          >
            {totalPrizes.toFixed(2)} DA
          </p>

          <p className="mt-1 text-xs text-white/35">
            مجموع الجوائز
          </p>
        </article>
      </section>

      {error && (
        <div className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_370px]">
        <article className="rounded-xl border border-white/[0.08] bg-[#0c101d]">
          <div className="flex flex-col gap-4 border-b border-white/[0.08] p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-semibold">
                قائمة البطولات
              </h2>

              <p className="mt-1 text-xs text-white/30">
                Tournament List
              </p>
            </div>

            <div className="flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-[#080b16] px-3">
              <Search
                size={16}
                className="text-white/25"
              />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="بحث..."
                className="bg-transparent text-sm outline-none"
              />
            </div>
          </div>

          <div className="p-5">
            {filteredTournaments.length ===
            0 ? (
              <div className="flex min-h-72 flex-col items-center justify-center text-center">
                <Trophy className="mb-3 text-white/20" />

                <p>
                  لا توجد بطولات
                </p>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {filteredTournaments.map(
                  (tournament) => {
                    const spaces =
                      Math.max(
                        0,

                        Number(
                          tournament.maxPlayers
                        ) -
                          Number(
                            tournament.participantCount
                          )
                      );

                    return (
                      <article
                        key={
                          tournament.id
                        }
                        className="rounded-xl border border-white/[0.08] bg-[#090d18] p-5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold">
                              {
                                tournament.name
                              }
                            </h3>

                            <p className="mt-1 flex items-center gap-2 text-xs text-violet-300">
                              <Gamepad2
                                size={13}
                              />

                              {
                                tournament.game
                              }
                            </p>
                          </div>

                          <span
                            className={`rounded-lg border px-2.5 py-1 text-[10px] ${getStatusStyle(
                              tournament.status
                            )}`}
                          >
                            {
                              tournament.status
                            }
                          </span>
                        </div>

                        <div className="my-4 grid grid-cols-2 gap-3 text-xs">
                          <div className="rounded-lg bg-white/[0.03] p-3">
                            <p className="text-white/30">
                              المشاركون
                            </p>

                            <p className="mt-1 text-sky-300">
                              {
                                tournament.participantCount
                              }
                              /
                              {
                                tournament.maxPlayers
                              }
                            </p>
                          </div>

                          <div className="rounded-lg bg-white/[0.03] p-3">
                            <p className="text-white/30">
                              أماكن متبقية
                            </p>

                            <p className="mt-1 text-emerald-300">
                              {spaces}
                            </p>
                          </div>

                          <div className="rounded-lg bg-white/[0.03] p-3">
                            <p className="text-white/30">
                              رسوم المشاركة
                            </p>

                            <p
                              dir="ltr"
                              className="mt-1 text-amber-300"
                            >
                              {Number(
                                tournament.entryFee
                              ).toFixed(2)}{" "}
                              DA
                            </p>
                          </div>

                          <div className="rounded-lg bg-white/[0.03] p-3">
                            <p className="text-white/30">
                              الجائزة
                            </p>

                            <p
                              dir="ltr"
                              className="mt-1 text-violet-300"
                            >
                              {Number(
                                tournament.prize
                              ).toFixed(2)}{" "}
                              DA
                            </p>
                          </div>
                        </div>

                        <div className="mb-4 flex items-center gap-2 text-xs text-white/35">
                          <CalendarDays
                            size={14}
                          />

                          {new Date(
                            tournament.startAt
                          ).toLocaleString(
                            "ar-DZ"
                          )}
                        </div>

                        <div className="grid grid-cols-[1fr_1fr_38px] gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              void loadParticipants(
                                tournament
                              )
                            }
                            className="h-9 rounded-lg bg-violet-600 text-xs"
                          >
                            المشاركون
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void updateStatus(
                                tournament
                              )
                            }
                            disabled={
                              tournament.status ===
                              "Completed"
                            }
                            className="h-9 rounded-lg bg-white/[0.06] text-xs disabled:opacity-40"
                          >
                            الحالة التالية
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void deleteTournament(
                                tournament
                              )
                            }
                            className="flex h-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-300"
                          >
                            <Trash2
                              size={15}
                            />
                          </button>
                        </div>
                      </article>
                    );
                  }
                )}
              </div>
            )}
          </div>
        </article>

        <aside className="h-fit rounded-xl border border-violet-400/15 bg-[#0c101d]">
          <div className="border-b border-white/[0.08] p-5">
            <h2 className="font-semibold">
              إنشاء بطولة
            </h2>

            <p className="mt-1 text-xs text-white/30">
              Create Tournament
            </p>
          </div>

          <form
            onSubmit={createTournament}
            className="space-y-4 p-5"
          >
            <input
              value={name}
              onChange={(event) =>
                setName(
                  event.target.value
                )
              }
              placeholder="اسم البطولة"
              className={fieldClass}
            />

            <select
              value={game}
              onChange={(event) =>
                setGame(
                  event.target.value
                )
              }
              className={fieldClass}
            >
              <option value="EA FC">
                EA FC
              </option>

              <option value="eFootball">
                eFootball
              </option>

              <option value="CS2">
                Counter-Strike 2
              </option>

              <option value="Valorant">
                Valorant
              </option>

              <option value="League of Legends">
                League of Legends
              </option>

              <option value="Tekken 8">
                Tekken 8
              </option>

              <option value="Other">
                Other
              </option>
            </select>

            <input
              type="datetime-local"
              value={startAt}
              onChange={(event) =>
                setStartAt(
                  event.target.value
                )
              }
              className={fieldClass}
            />

            <input
              type="text"
              inputMode="numeric"
              value={maxPlayers}
              onChange={(event) =>
                setMaxPlayers(
                  normalizeNumber(
                    event.target.value
                  ).replace(".", "")
                )
              }
              placeholder="عدد اللاعبين"
              className={fieldClass}
            />

            <input
              type="text"
              inputMode="decimal"
              value={entryFee}
              onChange={(event) =>
                setEntryFee(
                  normalizeNumber(
                    event.target.value
                  )
                )
              }
              placeholder="رسوم المشاركة DA"
              className={fieldClass}
            />

            <input
              type="text"
              inputMode="decimal"
              value={prize}
              onChange={(event) =>
                setPrize(
                  normalizeNumber(
                    event.target.value
                  )
                )
              }
              placeholder="قيمة الجائزة DA"
              className={fieldClass}
            />

            <button
              type="submit"
              disabled={saving}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-violet-600 text-sm font-medium disabled:opacity-50"
            >
              {saving ? (
                <RefreshCw
                  size={17}
                  className="animate-spin"
                />
              ) : (
                <Plus size={17} />
              )}

              إنشاء البطولة
            </button>
          </form>
        </aside>
      </section>

      {selectedTournament && (
        <section className="rounded-xl border border-violet-400/15 bg-[#0c101d]">
          <div className="flex flex-col gap-4 border-b border-white/[0.08] p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-semibold">
                المشاركون —{" "}
                {
                  selectedTournament.name
                }
              </h2>

              <p className="mt-1 text-xs text-white/30">
                {
                  selectedTournament.participantCount
                }
                /
                {
                  selectedTournament.maxPlayers
                }{" "}
                Players
              </p>
            </div>

            <form
              onSubmit={registerPlayer}
              className="flex flex-col gap-2 sm:flex-row"
            >
              <select
                value={
                  registrationPlayerId
                }
                onChange={(event) =>
                  setRegistrationPlayerId(
                    event.target.value
                  )
                }
                className={fieldClass}
              >
                <option value="">
                  اختر اللاعب
                </option>

                {players.map(
                  (player) => (
                    <option
                      key={player.id}
                      value={player.id}
                    >
                      {player.name} —
                      Wallet{" "}
                      {Number(
                        player.walletBalance
                      ).toFixed(2)}{" "}
                      DA
                    </option>
                  )
                )}
              </select>

              <button
                type="submit"
                disabled={
                  registering ||
                  selectedTournament.status !==
                    "Registration"
                }
                className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 text-sm disabled:opacity-40"
              >
                {registering ? (
                  <RefreshCw
                    size={16}
                    className="animate-spin"
                  />
                ) : (
                  <UserPlus
                    size={16}
                  />
                )}

                تسجيل
              </button>
            </form>
          </div>

          <div className="p-5">
            {participants.length ===
            0 ? (
              <div className="flex min-h-40 items-center justify-center text-white/35">
                لا يوجد مشاركون
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {participants.map(
                  (participant) => (
                    <article
                      key={
                        participant.id
                      }
                      className="rounded-lg border border-white/[0.08] bg-[#090d18] p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300">
                          <Users
                            size={18}
                          />
                        </div>

                        <div>
                          <h3 className="text-sm font-medium">
                            {
                              participant.playerName
                            }
                          </h3>

                          <p
                            dir="ltr"
                            className="mt-1 text-xs text-violet-300"
                          >
                            @
                            {
                              participant.playerUsername
                            }
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-emerald-500/[0.06] p-3">
                          <p className="text-white/30">
                            من المحفظة
                          </p>

                          <p
                            dir="ltr"
                            className="mt-1 text-emerald-300"
                          >
                            {Number(
                              participant.walletPaid
                            ).toFixed(2)}{" "}
                            DA
                          </p>
                        </div>

                        <div className="rounded-lg bg-rose-500/[0.06] p-3">
                          <p className="text-white/30">
                            أضيف للدين
                          </p>

                          <p
                            dir="ltr"
                            className="mt-1 text-rose-300"
                          >
                            {Number(
                              participant.debtAdded
                            ).toFixed(2)}{" "}
                            DA
                          </p>
                        </div>
                      </div>
                    </article>
                  )
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}