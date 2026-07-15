import { contextBridge, ipcRenderer } from "electron";

const api = {
  getDevices: () => ipcRenderer.invoke("get-devices"),
  addDevice: (device: {
    name: string;
    type: string;
    ip?: string;
    mac?: string;
    price: string;
  }) => ipcRenderer.invoke("add-device", device),

  // Settings
  getSettings: () => ipcRenderer.invoke("settings:get"),
  updateSettings: (updates: {
    currency?: string;
    roundingMode?: "minute" | "quarter_hour" | "hour";
    minimumMinutes?: number;
    defaultGuestPayment?: "cash" | "debt";
  }) => ipcRenderer.invoke("settings:update", updates),

  // Finance
  getPlayers: () => ipcRenderer.invoke("finance:get-players"),
  addPlayer: (player: {
    name: string;
    username: string;
    phone?: string;
    initialDeposit?: number;
    image?: string;
  }) => ipcRenderer.invoke("finance:add-player", player),
  deletePlayer: (playerId: number) =>
    ipcRenderer.invoke("finance:delete-player", playerId),
  topUpPlayer: (data: { playerId: number; amount: number; note?: string }) =>
    ipcRenderer.invoke("finance:top-up-player", data),
  getPlayerTransactions: (playerId: number) =>
    ipcRenderer.invoke("finance:get-transactions", playerId),

  startSession: (data: {
    deviceId: number;
    playerId?: number | null;
    customerName?: string;
    guestPhone?: string;
    guestNotes?: string;
  }) => ipcRenderer.invoke("finance:start-session", data),
  getActiveSessions: () => ipcRenderer.invoke("finance:get-active-sessions"),
  endSession: (data: { sessionId: number; guestPaymentMethod?: "cash" | "debt" }) =>
    ipcRenderer.invoke("finance:end-session", data),

  getGuestDebts: () => ipcRenderer.invoke("finance:get-guest-debts"),
  settleGuestDebt: (debtId: number) =>
    ipcRenderer.invoke("finance:settle-guest-debt", debtId),

  // Tournaments
  getTournaments: () => ipcRenderer.invoke("tournaments:get-all"),
  createTournament: (data: {
    name: string;
    game: string;
    startAt: string;
    maxPlayers: number;
    entryFee: number;
    prize: number;
  }) => ipcRenderer.invoke("tournaments:create", data),
  setTournamentStatus: (data: {
    tournamentId: number;
    status: "Draft" | "Registration" | "Running" | "Completed";
  }) => ipcRenderer.invoke("tournaments:set-status", data),
  getTournamentParticipants: (tournamentId: number) =>
    ipcRenderer.invoke("tournaments:get-participants", tournamentId),
  registerTournamentPlayer: (data: { tournamentId: number; playerId: number }) =>
    ipcRenderer.invoke("tournaments:register-player", data),
  deleteTournament: (tournamentId: number) =>
    ipcRenderer.invoke("tournaments:delete", tournamentId),

  // Billing
  getBillingSummary: () => ipcRenderer.invoke("billing:get-summary"),
  getBillingDailyRevenue: () => ipcRenderer.invoke("billing:get-daily-revenue"),
  getBillingLedger: () => ipcRenderer.invoke("billing:get-ledger"),
  getExpenses: () => ipcRenderer.invoke("billing:get-expenses"),
  addExpense: (data: {
    title: string;
    category: string;
    amount: number;
    note?: string;
    spentAt?: string;
  }) => ipcRenderer.invoke("billing:add-expense", data),
  deleteExpense: (expenseId: number) =>
    ipcRenderer.invoke("billing:delete-expense", expenseId),

  // Reports
  getReport: (payload: {
    range: "today" | "week" | "month" | "custom";
    start?: string;
    end?: string;
  }) => ipcRenderer.invoke("reports:get", payload),
};

contextBridge.exposeInMainWorld("api", api);