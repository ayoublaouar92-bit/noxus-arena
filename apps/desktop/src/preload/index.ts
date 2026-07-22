import { contextBridge, ipcRenderer } from "electron";

function invoke(channel: string, ...args: unknown[]) {
  return ipcRenderer.invoke(channel, ...args).finally(() => {
    ipcRenderer.send("renderer:request-focus");
  });
}

const api = {
  getDevices: () => invoke("get-devices"),
  addDevice: (device: {
    name: string;
    type: string;
    ip?: string;
    mac?: string;
    price: string;
  }) => invoke("add-device", device),

  updateDevice: (data: {
    deviceId: number;
    name: string;
    type: string;
    ip?: string;
    mac?: string;
    price: string;
    status?: "Available" | "Busy";
  }) => invoke("update-device", data),

  deleteDevice: (deviceId: number) => invoke("delete-device", deviceId),

  // Staff (PIN)
  getCurrentStaff: () => invoke("staff:get-current"),
  staffLogin: (userIdOrPin: number | string, pin?: string) =>
    typeof userIdOrPin === "number"
      ? invoke("staff:login", { userId: userIdOrPin, pin })
      : invoke("staff:login", { pin: userIdOrPin }),
  staffLogout: () => invoke("staff:logout"),
  listStaffUsers: () => invoke("staff:list-users"),
  createStaffUser: (data: {
    name: string;
    role: "Admin" | "Staff";
    pin: string;
  }) => invoke("staff:create-user", data),
  setStaffUserActive: (data: { userId: number; active: boolean }) =>
    invoke("staff:set-user-active", data),
  getAuditLog: () => invoke("staff:get-audit"),

  // Settings
  getSettings: () => invoke("settings:get"),
  updateSettings: (updates: {
    currency?: string;
    roundingMode?: "minute" | "quarter_hour" | "hour";
    minimumMinutes?: number;
    defaultGuestPayment?: "cash" | "debt";
  }) => invoke("settings:update", updates),

  // Kiosk control
  getKioskMode: () => invoke("kiosk:get-mode"),
  setKioskMode: (data: { enabled: boolean; force?: boolean }) =>
    invoke("kiosk:set-mode", data),

  // Finance
  getPlayers: () => invoke("finance:get-players"),
  addPlayer: (player: {
    name: string;
    username: string;
    phone?: string;
    initialDeposit?: number;
    image?: string;
  }) => invoke("finance:add-player", player),
  updatePlayer: (player: {
    playerId: number;
    name: string;
    username: string;
    phone?: string;
    image?: string | null;
  }) => invoke("finance:update-player", player),
  deletePlayer: (playerId: number) => invoke("finance:delete-player", playerId),
  topUpPlayer: (data: { playerId: number; amount: number; note?: string }) =>
    invoke("finance:top-up-player", data),
  setPlayerWalletBalance: (data: {
    playerId: number;
    newBalance: number;
    reason?: string;
  }) => invoke("finance:set-player-wallet-balance", data),
  payPlayerDebt: (data: { playerId: number; amount: number; note?: string }) =>
    invoke("finance:pay-player-debt", data),
  getPlayerTransactions: (playerId: number) =>
    invoke("finance:get-transactions", playerId),

  startSession: (data: {
    deviceId: number;
    playerId?: number | null;
    customerName?: string;
    guestPhone?: string;
    guestNotes?: string;
  }) => invoke("finance:start-session", data),

  startRoundSession: (data: {
    deviceId: number;
    playerId?: number | null;
    customerName?: string;
    guestPhone?: string;
    guestNotes?: string;
    fixedPrice: number;
    roundTitle?: string;
  }) => invoke("finance:start-round-session", data),

  getActiveSessions: () => invoke("finance:get-active-sessions"),

  endSession: (data: {
    sessionId: number;
    guestPaymentMethod?: "cash" | "debt";
    playerPaymentMethod?: "cash" | "wallet";
  }) => invoke("finance:end-session", data),

  // CS round groups and waiting list
  getRoundState: () => invoke("rounds:get-state"),
  startRoundGroup: (data: {
    playerIds: number[];
    fixedPrice: number;
    title?: string;
  }) => invoke("rounds:start-group", data),
  endRoundGroup: (groupId: number) => invoke("rounds:end-group", groupId),
  addWaitingPlayer: (playerId: number) =>
    invoke("rounds:add-waiting-player", playerId),
  removeWaitingPlayer: (waitingId: number) =>
    invoke("rounds:remove-waiting-player", waitingId),
  seatWaitingPlayers: () => invoke("rounds:seat-waiting-players"),
  finishAndStartNextRound: (data: {
    groupId: number;
    winnerPlayerIds: number[];
  }) => invoke("rounds:finish-and-start-next", data),

  // VIP
  getVipOverview: () => invoke("vip:get-overview"),
  updateVipSettings: (data: {
    spendPerPoint: number;
    roundPoints: number;
    autoVipThreshold: number;
  }) => invoke("vip:update-settings", data),
  setManualVip: (data: { playerId: number; enabled: boolean }) =>
    invoke("vip:set-manual", data),

  // Guest Debts v2
  getGuestDebts: (query?: {
    query?: string;
    status?: "Open" | "Paid" | "All";
    start?: string;
    end?: string;
    limit?: number;
  }) => invoke("finance:get-guest-debts", query),

  settleGuestDebt: (data: {
    debtId: number;
    paidAmount: number;
    note?: string;
  }) => invoke("finance:settle-guest-debt", data),

  addGuestDebt: (data: {
    guestName: string;
    phone?: string;
    identityNotes?: string;
    amount: number;
    note?: string;
  }) => invoke("finance:add-guest-debt", data),

  // Tournaments
  getTournaments: () => invoke("tournaments:get-all"),
  createTournament: (data: {
    name: string;
    game: string;
    startAt: string;
    maxPlayers: number;
    entryFee: number;
    prize: number;
  }) => invoke("tournaments:create", data),
  setTournamentStatus: (data: {
    tournamentId: number;
    status: "Draft" | "Registration" | "Running" | "Completed";
  }) => invoke("tournaments:set-status", data),
  getTournamentParticipants: (tournamentId: number) =>
    invoke("tournaments:get-participants", tournamentId),
  registerTournamentPlayer: (data: {
    tournamentId: number;
    playerId: number;
  }) => invoke("tournaments:register-player", data),
  deleteTournament: (tournamentId: number) =>
    invoke("tournaments:delete", tournamentId),

  // Store / Inventory
  getCategories: () => invoke("store:get-categories"),
  addCategory: (data: {
    name: string;
    color?: string;
    sortOrder?: number;
    active?: boolean;
  }) => invoke("store:add-category", data),
  updateCategory: (data: {
    categoryId: number;
    name?: string;
    color?: string;
    sortOrder?: number;
    active?: boolean;
  }) => invoke("store:update-category", data),
  deleteCategory: (categoryId: number) =>
    invoke("store:delete-category", categoryId),

  getProducts: () => invoke("store:get-products"),
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
  }) => invoke("store:add-product", data),

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
  }) => invoke("store:update-product", data),

  deleteProduct: (productId: number) =>
    invoke("store:delete-product", productId),

  getProductMovements: (productId: number) =>
    invoke("store:get-product-movements", productId),

  moveStock: (data: {
    productId: number;
    quantity: number;
    reason: "PURCHASE" | "ADJUSTMENT" | "RETURN";
    note?: string;
  }) => invoke("store:move-stock", data),

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
        }
  ) => invoke("store:create-sale", data),
  getSales: () => invoke("store:get-sales"),

  // Billing
  getCurrentShift: () => invoke("billing:get-current-shift"),
  openShift: (data: { openingCash: number }) =>
    invoke("billing:open-shift", data),
  closeShift: (data: { actualCash: number }) =>
    invoke("billing:close-shift", data),
  getShiftHistory: () => invoke("billing:get-shift-history"),
  getBillingSummary: () => invoke("billing:get-summary"),
  getBillingDailyRevenue: () => invoke("billing:get-daily-revenue"),
  getBillingTransactions: (query?: {
    range?: "today" | "week" | "month" | "custom";
    start?: string;
    end?: string;
    staffUserId?: number | null;
    shiftId?: number | null;
    type?: string;
    payment?: string;
    search?: string;
  }) => invoke("billing:get-transactions", query),
  getBillingLedger: () => invoke("billing:get-ledger"),
  getExpenses: () => invoke("billing:get-expenses"),
  addExpense: (data: {
    title: string;
    category: string;
    amount: number;
    note?: string;
    spentAt?: string;
  }) => invoke("billing:add-expense", data),
  deleteExpense: (expenseId: number) =>
    invoke("billing:delete-expense", expenseId),

  // Reports
  getReport: (payload: {
    range: "today" | "week" | "month" | "custom";
    start?: string;
    end?: string;
  }) => invoke("reports:get", payload),

  // Focus fix
  requestFocus: () => ipcRenderer.send("renderer:request-focus"),
};

contextBridge.exposeInMainWorld("api", api);