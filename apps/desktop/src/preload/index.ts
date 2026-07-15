import {
  contextBridge,
  ipcRenderer,
} from "electron";

const api = {
  getDevices: () => {
    return ipcRenderer.invoke(
      "get-devices"
    );
  },

  addDevice: (device: {
    name: string;
    type: string;
    ip?: string;
    mac?: string;
    price: string;
  }) => {
    return ipcRenderer.invoke(
      "add-device",
      device
    );
  },

  getPlayers: () => {
    return ipcRenderer.invoke(
      "finance:get-players"
    );
  },

  addPlayer: (player: {
    name: string;
    username: string;
    phone?: string;
    initialDeposit?: number;
    image?: string;
  }) => {
    return ipcRenderer.invoke(
      "finance:add-player",
      player
    );
  },

  deletePlayer: (
    playerId: number
  ) => {
    return ipcRenderer.invoke(
      "finance:delete-player",
      playerId
    );
  },

  topUpPlayer: (data: {
    playerId: number;
    amount: number;
    note?: string;
  }) => {
    return ipcRenderer.invoke(
      "finance:top-up-player",
      data
    );
  },

  getPlayerTransactions: (
    playerId: number
  ) => {
    return ipcRenderer.invoke(
      "finance:get-transactions",
      playerId
    );
  },

  startSession: (data: {
    deviceId: number;
    playerId?: number | null;
    customerName?: string;
    guestPhone?: string;
    guestNotes?: string;
  }) => {
    return ipcRenderer.invoke(
      "finance:start-session",
      data
    );
  },

  getActiveSessions: () => {
    return ipcRenderer.invoke(
      "finance:get-active-sessions"
    );
  },

  endSession: (data: {
    sessionId: number;

    guestPaymentMethod?:
      | "cash"
      | "debt";
  }) => {
    return ipcRenderer.invoke(
      "finance:end-session",
      data
    );
  },

  getGuestDebts: () => {
    return ipcRenderer.invoke(
      "finance:get-guest-debts"
    );
  },

  settleGuestDebt: (
    debtId: number
  ) => {
    return ipcRenderer.invoke(
      "finance:settle-guest-debt",
      debtId
    );
  },

  getTournaments: () => {
    return ipcRenderer.invoke(
      "tournaments:get-all"
    );
  },

  createTournament: (data: {
    name: string;
    game: string;
    startAt: string;
    maxPlayers: number;
    entryFee: number;
    prize: number;
  }) => {
    return ipcRenderer.invoke(
      "tournaments:create",
      data
    );
  },

  setTournamentStatus: (data: {
    tournamentId: number;

    status:
      | "Draft"
      | "Registration"
      | "Running"
      | "Completed";
  }) => {
    return ipcRenderer.invoke(
      "tournaments:set-status",
      data
    );
  },

  getTournamentParticipants: (
    tournamentId: number
  ) => {
    return ipcRenderer.invoke(
      "tournaments:get-participants",
      tournamentId
    );
  },

  registerTournamentPlayer: (
    data: {
      tournamentId: number;
      playerId: number;
    }
  ) => {
    return ipcRenderer.invoke(
      "tournaments:register-player",
      data
    );
  },

  deleteTournament: (
    tournamentId: number
  ) => {
    return ipcRenderer.invoke(
      "tournaments:delete",
      tournamentId
    );
  },
};

contextBridge.exposeInMainWorld(
  "api",
  api
);