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

  // NEW: Devices update/delete
  updateDevice: (data: {
    deviceId: number;
    name: string;
    type: string;
    ip?: string;
    mac?: string;
    price: string;
    status?: "Available" | "Busy";
  }) => ipcRenderer.invoke("update-device", data),

  deleteDevice: (deviceId: number) =>
    ipcRenderer.invoke("delete-device", deviceId),

  // Staff (PIN)
  getCurrentStaff: () => ipcRenderer.invoke("staff:get-current"),
  staffLogin: (pin: string) => ipcRenderer.invoke("staff:login", { pin }),
  staffLogout: () => ipcRenderer.invoke("staff:logout"),
  listStaffUsers: () => ipcRenderer.invoke("staff:list-users"),
  createStaffUser: (data: {
    name: string;
    role: "Admin" | "Staff";
    pin: string;
  }) => ipcRenderer.invoke("staff:create-user", data),
  setStaffUserActive: (data: { userId: number; active: boolean }) =>
    ipcRenderer.invoke("staff:set-user-active", data),
  getAuditLog: () => ipcRenderer.invoke("staff:get-audit"),

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

  setPlayerWalletBalance: (data: {
    playerId: number;
    newBalance: number;
    reason?: string;
  }) =>
    ipcRenderer.invoke(
      "finance:set-player-wallet-balance",
      data,
    ),

  payPlayerDebt: (data: {
    playerId: number;
    amount: number;
    note?: string;
  }) =>
    ipcRenderer.invoke(
      "finance:pay-player-debt",
      data,
    ),

  startSession: (data: {
    deviceId: number;
    playerId?: number | null;
    customerName?: string;
    guestPhone?: string;
    guestNotes?: string;
  }) => ipcRenderer.invoke("finance:start-session", data),

  startRoundSession: (data: {
    deviceId: number;
    playerId?: number | null;
    customerName?: string;
    guestPhone?: string;
    guestNotes?: string;
    fixedPrice: number;
    roundTitle?: string;
  }) => ipcRenderer.invoke("finance:start-round-session", data),

  getActiveSessions: () => ipcRenderer.invoke("finance:get-active-sessions"),

  endSession: (data: {
    sessionId: number;
    guestPaymentMethod?: "cash" | "debt";
    playerPaymentMethod?: "cash" | "wallet";
  }) => ipcRenderer.invoke("finance:end-session", data),

  // CS round groups and waiting list
  getRoundState: () => ipcRenderer.invoke("rounds:get-state"),
  startRoundGroup: (data: {
    playerIds: number[];
    fixedPrice: number;
    title?: string;
  }) => ipcRenderer.invoke("rounds:start-group", data),
  endRoundGroup: (groupId: number) =>
    ipcRenderer.invoke("rounds:end-group", groupId),
  addWaitingPlayer: (playerId: number) =>
    ipcRenderer.invoke("rounds:add-waiting-player", playerId),
  removeWaitingPlayer: (waitingId: number) =>
    ipcRenderer.invoke("rounds:remove-waiting-player", waitingId),
  finishAndStartNextRound: (data: {
    groupId: number;
    winnerPlayerIds: number[];
  }) => ipcRenderer.invoke("rounds:finish-and-start-next", data),

  // VIP
  getVipOverview: () => ipcRenderer.invoke("vip:get-overview"),
  updateVipSettings: (data: {
    spendPerPoint: number;
    roundPoints: number;
    autoVipThreshold: number;
  }) => ipcRenderer.invoke("vip:update-settings", data),
  setManualVip: (data: { playerId: number; enabled: boolean }) =>
    ipcRenderer.invoke("vip:set-manual", data),

  // Guest Debts v2
  getGuestDebts: (query?: {
    query?: string;
    status?: "Open" | "Paid" | "All";
    start?: string;
    end?: string;
    limit?: number;
  }) => ipcRenderer.invoke("finance:get-guest-debts", query),

  settleGuestDebt: (data: {
    debtId: number;
    paidAmount: number;
    note?: string;
  }) => ipcRenderer.invoke("finance:settle-guest-debt", data),

  addGuestDebt: (data: {
    guestName: string;
    phone?: string;
    identityNotes?: string;
    amount: number;
    note?: string;
  }) => ipcRenderer.invoke("finance:add-guest-debt", data),

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
  registerTournamentPlayer: (data: {
    tournamentId: number;
    playerId: number;
  }) => ipcRenderer.invoke("tournaments:register-player", data),
  deleteTournament: (tournamentId: number) =>
    ipcRenderer.invoke("tournaments:delete", tournamentId),

  // Store / Inventory
  getCategories: () => ipcRenderer.invoke("store:get-categories"),
  addCategory: (data: {
    name: string;
    color?: string;
    sortOrder?: number;
    active?: boolean;
  }) => ipcRenderer.invoke("store:add-category", data),
  updateCategory: (data: {
    categoryId: number;
    name?: string;
    color?: string;
    sortOrder?: number;
    active?: boolean;
  }) => ipcRenderer.invoke("store:update-category", data),
  deleteCategory: (categoryId: number) =>
    ipcRenderer.invoke("store:delete-category", categoryId),

  getProducts: () => ipcRenderer.invoke("store:get-products"),
  addProduct: (data: {
    name: string;
    sku?: string;
    unit?: string;
    salePrice: number;
    costPrice?: number;
    initialStock?: number;
    active?: boolean;
    categoryId?: number | null;
    image?: string | null;
  }) => ipcRenderer.invoke("store:add-product", data),

  updateProduct: (data: {
    productId: number;
    name?: string;
    sku?: string;
    unit?: string;
    salePrice?: number;
    costPrice?: number;
    active?: boolean;
    categoryId?: number | null;
    image?: string | null;
  }) => ipcRenderer.invoke("store:update-product", data),

  deleteProduct: (productId: number) =>
    ipcRenderer.invoke("store:delete-product", productId),

  getProductMovements: (productId: number) =>
    ipcRenderer.invoke("store:get-product-movements", productId),

  moveStock: (data: {
    productId: number;
    quantity: number;
    reason: "PURCHASE" | "ADJUSTMENT" | "RETURN";
    note?: string;
  }) => ipcRenderer.invoke("store:move-stock", data),

  createSale: (
    data:
      | {
          paymentType: "cash";
          customerName?: string;
          note?: string;
          items: Array<{
            productId: number;
            quantity: number;
            unitPrice: number;
          }>;
        }
      | {
          paymentType: "player";
          playerId: number;
          customerName?: string;
          note?: string;
          items: Array<{
            productId: number;
            quantity: number;
            unitPrice: number;
          }>;
        },
  ) => ipcRenderer.invoke("store:create-sale", data),

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

