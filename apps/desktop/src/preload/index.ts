import {
  contextBridge,
  ipcRenderer,
} from "electron";

const api = {
  /*
  |--------------------------------------------------------------------------
  | Devices
  |--------------------------------------------------------------------------
  */

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

  /*
  |--------------------------------------------------------------------------
  | Players and wallets
  |--------------------------------------------------------------------------
  */

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

  /*
  |--------------------------------------------------------------------------
  | Sessions
  |--------------------------------------------------------------------------
  */

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

  /*
  |--------------------------------------------------------------------------
  | Guest debts
  |--------------------------------------------------------------------------
  */

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
};

contextBridge.exposeInMainWorld(
  "api",
  api
);