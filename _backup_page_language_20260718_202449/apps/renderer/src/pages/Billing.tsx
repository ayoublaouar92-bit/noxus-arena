import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Clock3,
  History,
  ListFilter,
  LogIn,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import { handleUnauthorized } from "../lib/auth";
import { useLanguage } from "../lib/i18n";
import { isAdmin, loadCurrentStaff, type StaffUser } from "../lib/staff-ui";

type Summary = Record<string, any>;

type Expense = {
  id: number;
  title: string;
  category: string;
  amount: number;
  note?: string;
  spentAt: string;
  createdAt: string;
  shiftId: number | null;
  staffUserId: number | null;
  staffName?: string | null;
  staffRole?: string | null;
};

type Shift = {
  id: number;
  staffUserId: number;
  staffName: string;
  staffRole: "Admin" | "Staff";
  openingCash: number;
  openedAt: string;
  closedAt: string | null;
  actualCash: number | null;
  expectedCash: number;
  difference: number | null;
  status: "Open" | "Closed";
  sessionCash: number;
  storeCash: number;
  walletTopUps: number;
  playerDebtCash: number;
  guestDebtCash: number;
  cashCollected: number;
  expenses: number;
};

type BillingTransaction = {
  id: string;
  sourceId: number;
  type:
    "Session" | "Round" | "Store" | "WalletTopUp" | "DebtPayment" | "Expense";
  typeLabel: string;
  customer: string;
  details: string;
  payment: "Cash" | "Wallet" | "Wallet + Debt" | "Cash out";
  revenue: number;
  cashMovement: number;
  walletPaid: number;
  debtAdded: number;
  amount: number;
  staffUserId: number | null;
  staffName: string;
  shiftId: number | null;
  occurredAt: string;
};

type BillingTransactionsData = {
  transactions: BillingTransaction[];
  staff: Array<{ id: number; name: string; role: string }>;
};

const fieldClass =
  "h-11 w-full rounded-lg border border-white/10 bg-[#080b16] px-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-violet-400/60";

const expenseCategories = [
  "شراء مخزون",
  "تنظيف",
  "صيانة",
  "الإنترنت",
  "الكهرباء",
  "الأجور",
  "مصاريف أخرى",
] as const;

function normalizeNumber(value: string) {
  const digitMap: Record<string, string> = {
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
    .map((c) => digitMap[c] ?? c)
    .join("")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");

  const parts = normalized.split(".");
  if (parts.length > 1) normalized = `${parts[0]}.` + parts.slice(1).join("");
  return normalized;
}

function money(n: number) {
  return `${Number(n || 0).toFixed(2)} DA`;
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString("ar-DZ") : "—";
}

function differenceClass(value: number) {
  if (value > 0) return "text-emerald-300";
  if (value < 0) return "text-rose-300";
  return "text-sky-300";
}

function friendlyError(error: any) {
  const message = String(error?.message || error || "");
  if (message.includes("SHIFT_ALREADY_OPEN"))
    return "توجد وردية مفتوحة بالفعل.";
  if (message.includes("SHIFT_REQUIRED"))
    return "يجب فتح وردية قبل تنفيذ أي عملية مالية.";
  if (message.includes("NO_OPEN_SHIFT")) return "لا توجد وردية مفتوحة.";
  if (message.includes("SHIFT_OWNED_BY_ANOTHER_STAFF"))
    return "هذه الوردية تخص كاشير آخر. يجب أن يغلقها صاحب الوردية.";
  if (message.includes("Invalid opening cash")) return "كاش البداية غير صالح.";
  if (message.includes("Invalid actual cash")) return "الكاش الحقيقي غير صالح.";
  return "تعذر تنفيذ العملية.";
}

export default function Billing() {
  const { dir, t } = useLanguage();
  const api = (window as any).api;

  const [current, setCurrent] = useState<StaffUser | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [shiftHistory, setShiftHistory] = useState<Shift[]>([]);
  const [transactionData, setTransactionData] =
    useState<BillingTransactionsData>({ transactions: [], staff: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shiftSaving, setShiftSaving] = useState(false);
  const [error, setError] = useState("");

  const [openingCash, setOpeningCash] = useState("0");
  const [actualCash, setActualCash] = useState("0");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("مصاريف أخرى");
  const [amount, setAmount] = useState("0");
  const [note, setNote] = useState("");
  const [transactionRange, setTransactionRange] = useState<
    "today" | "week" | "month"
  >("today");
  const [staffFilter, setStaffFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [transactionSearch, setTransactionSearch] = useState("");
  const [expenseRange, setExpenseRange] = useState<"today" | "week" | "month">(
    "today",
  );
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState("All");
  const [expenseStaffFilter, setExpenseStaffFilter] = useState("All");
  const [expenseSearch, setExpenseSearch] = useState("");

  const canEdit = useMemo(() => isAdmin(current), [current]);
  const ownsCurrentShift = useMemo(
    () =>
      Boolean(
        current &&
        currentShift &&
        Number(current.id) === Number(currentShift.staffUserId),
      ),
    [current, currentShift],
  );
  const canAddExpense = Boolean(current && ownsCurrentShift);

  async function loadAll(showLoading = false) {
    try {
      if (showLoading) setLoading(true);
      setError("");

      const [staffUser, s, e, activeShift, history, transactions] =
        await Promise.all([
          loadCurrentStaff(api),
          api.getBillingSummary(),
          api.getExpenses(),
          api.getCurrentShift(),
          api.getShiftHistory(),
          api.getBillingTransactions({ range: transactionRange }),
        ]);

      setCurrent(staffUser);
      setSummary(s);
      setExpenses(e);
      setCurrentShift(activeShift);
      setShiftHistory(history);
      setTransactionData(transactions);

      if (activeShift) {
        setActualCash(String(Number(activeShift.expectedCash || 0).toFixed(2)));
      } else if (history.length > 0 && history[0].actualCash !== null) {
        setOpeningCash(String(Number(history[0].actualCash || 0).toFixed(2)));
      }
    } catch (e) {
      console.error(e);
      setError("تعذر تحميل بيانات Billing");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const netCash = useMemo(() => Number(summary?.netCash || 0), [summary]);

  const filteredTransactions = useMemo(() => {
    const search = transactionSearch.trim().toLowerCase();
    return transactionData.transactions.filter((item) => {
      if (staffFilter !== "All" && String(item.staffUserId) !== staffFilter)
        return false;
      if (typeFilter !== "All" && item.type !== typeFilter) return false;
      if (paymentFilter !== "All" && item.payment !== paymentFilter)
        return false;
      if (
        search &&
        !`${item.customer} ${item.details} ${item.staffName}`
          .toLowerCase()
          .includes(search)
      )
        return false;
      return true;
    });
  }, [
    paymentFilter,
    staffFilter,
    transactionData.transactions,
    transactionSearch,
    typeFilter,
  ]);

  const transactionTotals = useMemo(
    () =>
      filteredTransactions.reduce(
        (totals, item) => {
          totals.revenue += Number(item.revenue || 0);
          totals.cashMovement += Number(item.cashMovement || 0);
          totals.cashIn += Math.max(0, Number(item.cashMovement || 0));
          totals.wallet += Number(item.walletPaid || 0);
          totals.debt += Number(item.debtAdded || 0);
          if (item.type === "Expense")
            totals.expenses += Number(item.amount || 0);
          return totals;
        },
        {
          revenue: 0,
          cashIn: 0,
          cashMovement: 0,
          wallet: 0,
          debt: 0,
          expenses: 0,
        },
      ),
    [filteredTransactions],
  );

  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    if (expenseRange === "today") start.setHours(0, 0, 0, 0);
    if (expenseRange === "week") {
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
    }
    if (expenseRange === "month") {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    }

    const search = expenseSearch.trim().toLowerCase();
    return expenses.filter((expense) => {
      if (new Date(expense.spentAt).getTime() < start.getTime()) return false;
      if (
        expenseCategoryFilter !== "All" &&
        expense.category !== expenseCategoryFilter
      )
        return false;
      if (
        expenseStaffFilter !== "All" &&
        String(expense.staffUserId) !== expenseStaffFilter
      )
        return false;
      if (
        search &&
        !`${expense.title} ${expense.note || ""} ${expense.category} ${expense.staffName || ""}`
          .toLowerCase()
          .includes(search)
      )
        return false;
      return true;
    });
  }, [
    expenseCategoryFilter,
    expenseRange,
    expenseSearch,
    expenseStaffFilter,
    expenses,
  ]);

  const expenseTotal = useMemo(
    () =>
      filteredExpenses.reduce(
        (total, expense) => total + Number(expense.amount || 0),
        0,
      ),
    [filteredExpenses],
  );

  const expenseCategoryTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const expense of filteredExpenses) {
      totals.set(
        expense.category,
        (totals.get(expense.category) || 0) + Number(expense.amount || 0),
      );
    }
    return Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
  }, [filteredExpenses]);

  const expenseStaff = useMemo(() => {
    const staff = new Map<number, string>();
    for (const expense of expenses) {
      if (expense.staffUserId && expense.staffName)
        staff.set(expense.staffUserId, expense.staffName);
    }
    return Array.from(staff.entries());
  }, [expenses]);

  async function changeTransactionRange(range: "today" | "week" | "month") {
    try {
      setLoading(true);
      setTransactionRange(range);
      const transactions = await api.getBillingTransactions({ range });
      setTransactionData(transactions);
    } catch (error) {
      console.error(error);
      setError("تعذر تحميل سجل العمليات");
    } finally {
      setLoading(false);
    }
  }

  async function openShift(event: FormEvent) {
    event.preventDefault();
    if (!current) {
      window.alert("سجّل الدخول من صفحة Staff أولًا.");
      window.location.hash = "#/staff";
      return;
    }

    try {
      setShiftSaving(true);
      setError("");
      await api.openShift({ openingCash: Number(openingCash || 0) });
      await loadAll(true);
    } catch (e: any) {
      console.error(e);
      if (handleUnauthorized(e)) return;
      setError(friendlyError(e));
    } finally {
      setShiftSaving(false);
    }
  }

  async function closeShift(event: FormEvent) {
    event.preventDefault();
    if (!window.confirm("إغلاق الوردية وتثبيت الكاش الحقيقي؟")) return;

    try {
      setShiftSaving(true);
      setError("");
      await api.closeShift({ actualCash: Number(actualCash || 0) });
      await loadAll(true);
    } catch (e: any) {
      console.error(e);
      if (handleUnauthorized(e)) return;
      setError(friendlyError(e));
    } finally {
      setShiftSaving(false);
    }
  }

  async function addExpense(event: FormEvent) {
    event.preventDefault();

    if (!canAddExpense) {
      setError("يجب أن تكون ورديتك مفتوحة قبل إضافة مصروف.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      await api.addExpense({
        title: title.trim(),
        category: category.trim(),
        amount: Number(amount || 0),
        note: note.trim(),
      });

      setTitle("");
      setCategory("مصاريف أخرى");
      setAmount("0");
      setNote("");
      await loadAll(true);
    } catch (e: any) {
      console.error(e);
      if (handleUnauthorized(e)) return;
      setError(friendlyError(e));
    } finally {
      setSaving(false);
    }
  }

  async function removeExpense(id: number) {
    if (!canEdit) {
      window.alert("حذف المصروفات: Admin فقط");
      window.location.hash = "#/staff";
      return;
    }
    if (!window.confirm("حذف المصروف؟")) return;

    try {
      setError("");
      await api.deleteExpense(id);
      await loadAll(true);
    } catch (e: any) {
      console.error(e);
      if (handleUnauthorized(e)) return;
      setError("تعذر حذف المصروف");
    }
  }

  return (
    <div dir={dir} className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-sm text-violet-300">{t("business")}</p>
          <h1 className="text-3xl font-semibold">{t("billing")}</h1>
          <p className="mt-2 text-sm text-white/45">
            {current ? `الموظف الحالي: ${current.name}` : "لم يتم تسجيل الدخول"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadAll(true)}
          className="flex h-11 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm"
        >
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
          تحديث
        </button>
      </section>

      {error && (
        <div className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-violet-400/20 bg-[#0c101d]">
        <div className="flex items-center gap-3 border-b border-white/[0.08] p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300">
            <Clock3 size={19} />
          </div>
          <div>
            <h2 className="font-semibold">{t("currentShift")}</h2>
          </div>
        </div>

        {!currentShift ? (
          <form
            onSubmit={openShift}
            className="grid gap-4 p-5 lg:grid-cols-[1fr_240px_auto] lg:items-end"
          >
            <div>
              <p className="text-sm font-medium">{t("noOpenShift")}</p>
              <p className="mt-1 text-xs text-white/35">
                افتح وردية واحدة للكاشير الحالي قبل تسجيل عمليات الكاش.
              </p>
            </div>
            <label className="space-y-2">
              <span className="text-xs text-white/45">
                {t("startCash")}
              </span>
              <input
                dir="ltr"
                value={openingCash}
                onChange={(e) =>
                  setOpeningCash(normalizeNumber(e.target.value))
                }
                className={fieldClass}
                disabled={!current || shiftSaving}
              />
            </label>
            <button
              type="submit"
              disabled={!current || shiftSaving}
              className="flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-medium disabled:opacity-50"
            >
              {shiftSaving ? (
                <RefreshCw size={17} className="animate-spin" />
              ) : (
                <LogIn size={17} />
              )}
              {t("openShift")}
            </button>
          </form>
        ) : (
          <div className="space-y-5 p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <UserRound size={18} className="text-violet-300" />
                <div>
                  <p className="font-medium">{currentShift.staffName}</p>
                  <p className="mt-1 text-xs text-white/35">
                    {t("started")}: {formatDate(currentShift.openedAt)}
                  </p>
                </div>
              </div>
              <span className="w-fit rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
                {t("shiftOpen")}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
              {[
                [t("startCash"), currentShift.openingCash, "text-white"],
                [t("sessionCash"), currentShift.sessionCash, "text-emerald-300"],
                [t("storeSales"), currentShift.storeCash, "text-emerald-300"],
                [t("walletTopups"), currentShift.walletTopUps, "text-emerald-300"],
                [
                  t("debtCollection"),
                  currentShift.guestDebtCash,
                  "text-emerald-300",
                ],
                [t("expenses"), currentShift.expenses, "text-rose-300"],
              ].map(([label, value, color]) => (
                <div
                  key={String(label)}
                  className="rounded-lg bg-white/[0.03] p-4"
                >
                  <p className="text-xs text-white/35">{label}</p>
                  <p
                    dir="ltr"
                    className={`mt-2 text-sm font-semibold ${color}`}
                  >
                    {money(Number(value))}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 rounded-lg border border-amber-400/15 bg-amber-500/[0.05] p-4 lg:grid-cols-[1fr_240px_auto] lg:items-end">
              <div>
                <p className="text-xs text-white/40">{t("expectedCash")}</p>
                <p
                  dir="ltr"
                  className="mt-1 text-2xl font-semibold text-amber-300"
                >
                  {money(currentShift.expectedCash)}
                </p>
                {!ownsCurrentShift && (
                  <p className="mt-2 text-xs text-rose-300">
                    الوردية تخص {currentShift.staffName} ولا يمكن لموظف آخر
                    إغلاقها.
                  </p>
                )}
              </div>
              <label className="space-y-2">
                <span className="text-xs text-white/45">
                  {t("actualCash")}
                </span>
                <input
                  dir="ltr"
                  value={actualCash}
                  onChange={(e) =>
                    setActualCash(normalizeNumber(e.target.value))
                  }
                  className={fieldClass}
                  disabled={!ownsCurrentShift || shiftSaving}
                />
              </label>
              <form onSubmit={closeShift}>
                <button
                  type="submit"
                  disabled={!ownsCurrentShift || shiftSaving}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-5 text-sm font-medium disabled:opacity-50"
                >
                  {shiftSaving ? (
                    <RefreshCw size={17} className="animate-spin" />
                  ) : (
                    <LogOut size={17} />
                  )}
                  {t("closeShift")}
                </button>
              </form>
            </div>
          </div>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <article className="rounded-xl border border-white/[0.08] bg-[#0c101d] p-5">
          <h2 className="font-semibold">{t("overallSummary")}</h2>
          {!summary ? (
            <p className="mt-3 text-sm text-white/35">{t("noData")}</p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-white/[0.03] p-4">
                <p className="text-xs text-white/35">{t("storeRevenue")}</p>
                <p dir="ltr" className="mt-1 text-emerald-300">
                  {money(Number(summary.storeRevenue || 0))}
                </p>
              </div>
              <div className="rounded-lg bg-white/[0.03] p-4">
                <p className="text-xs text-white/35">{t("expenses")}</p>
                <p dir="ltr" className="mt-1 text-rose-300">
                  {money(Number(summary.expenses || 0))}
                </p>
              </div>
              <div className="col-span-2 rounded-lg bg-white/[0.03] p-4">
                <p className="text-xs text-white/35">{t("netCash")}</p>
                <p dir="ltr" className="mt-1 font-semibold text-amber-300">
                  {money(netCash)}
                </p>
              </div>
            </div>
          )}
        </article>

        <aside className="rounded-xl border border-violet-400/15 bg-[#0c101d]">
          <div className="border-b border-white/[0.08] p-5">
            <h2 className="font-semibold">{t("addExpense")}</h2>
            <p className="mt-1 text-xs text-white/30">
              يُسجل تلقائيًا باسم الكاشير والوردية الحالية
            </p>
          </div>
          <form onSubmit={addExpense} className="space-y-4 p-5">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="عنوان المصروف"
              className={fieldClass}
              disabled={!canAddExpense}
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={fieldClass}
              disabled={!canAddExpense}
            >
              {expenseCategories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <input
              dir="ltr"
              value={amount}
              onChange={(e) => setAmount(normalizeNumber(e.target.value))}
              placeholder="Amount"
              className={fieldClass}
              disabled={!canAddExpense}
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ملاحظة (اختياري)"
              className={fieldClass}
              disabled={!canAddExpense}
            />
            <button
              type="submit"
              disabled={!canAddExpense || saving}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-violet-600 text-sm font-medium disabled:opacity-50"
            >
              {saving ? (
                <RefreshCw size={17} className="animate-spin" />
              ) : (
                <Plus size={17} />
              )}
              إضافة
            </button>
            {!canAddExpense && (
              <p className="text-center text-xs text-amber-300/80">
                افتح ورديتك أولًا لإضافة المصروفات.
              </p>
            )}
          </form>
        </aside>
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-[#0c101d]">
        <div className="flex flex-col gap-4 border-b border-white/[0.08] p-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-300">
              <ListFilter size={18} />
            </div>
            <div>
              <h2 className="font-semibold">عمليات اليوم والمكاسب</h2>
              <p className="mt-1 text-xs text-white/30">
                الإيرادات وحركة الصندوق حسب الكاشير والوردية
              </p>
            </div>
          </div>

          <div className="flex rounded-lg border border-white/[0.08] bg-[#080b16] p-1">
            {(
              [
                ["today", "اليوم"],
                ["week", "7 أيام"],
                ["month", "الشهر"],
              ] as const
            ).map(([range, label]) => (
              <button
                key={range}
                type="button"
                onClick={() => void changeTransactionRange(range)}
                className={`h-9 rounded-md px-4 text-xs transition ${
                  transactionRange === range
                    ? "bg-violet-600 text-white"
                    : "text-white/40 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 p-5 lg:grid-cols-6">
          {[
            ["الإيرادات", transactionTotals.revenue, "text-emerald-300"],
            ["الكاش الداخل", transactionTotals.cashIn, "text-cyan-300"],
            ["Wallet", transactionTotals.wallet, "text-violet-300"],
            ["ديون مضافة", transactionTotals.debt, "text-amber-300"],
            ["المصاريف", transactionTotals.expenses, "text-rose-300"],
            ["صافي حركة الكاش", transactionTotals.cashMovement, "text-sky-300"],
          ].map(([label, value, color]) => (
            <div key={String(label)} className="rounded-lg bg-white/[0.03] p-4">
              <p className="text-xs text-white/35">{label}</p>
              <p dir="ltr" className={`mt-2 text-sm font-semibold ${color}`}>
                {money(Number(value))}
              </p>
            </div>
          ))}
        </div>

        <div className="grid gap-3 border-y border-white/[0.06] p-4 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_180px_180px_180px]">
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/25"
            />
            <input
              value={transactionSearch}
              onChange={(event) => setTransactionSearch(event.target.value)}
              placeholder="بحث بالعميل أو التفاصيل..."
              className={`${fieldClass} pr-9`}
            />
          </div>

          <select
            value={staffFilter}
            onChange={(event) => setStaffFilter(event.target.value)}
            className={fieldClass}
          >
            <option value="All">كل الموظفين</option>
            {transactionData.staff.map((staff) => (
              <option key={staff.id} value={staff.id}>
                {staff.name}
              </option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className={fieldClass}
          >
            <option value="All">كل العمليات</option>
            <option value="Session">جلسات اللعب</option>
            <option value="Round">جولات اللعب</option>
            <option value="Store">مبيعات المتجر</option>
            <option value="WalletTopUp">شحن المحافظ</option>
            <option value="DebtPayment">تسديد الديون</option>
            <option value="Expense">المصاريف</option>
          </select>

          <select
            value={paymentFilter}
            onChange={(event) => setPaymentFilter(event.target.value)}
            className={fieldClass}
          >
            <option value="All">كل طرق الدفع</option>
            <option value="Cash">Cash</option>
            <option value="Wallet">Wallet</option>
            <option value="Wallet + Debt">Wallet + Debt</option>
            <option value="Cash out">Cash out</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-sm">
            <thead className="text-xs text-white/35">
              <tr className="border-b border-white/[0.06]">
                <th className="p-4 text-right font-medium">الوقت</th>
                <th className="p-4 text-right font-medium">الكاشير</th>
                <th className="p-4 text-right font-medium">الوردية</th>
                <th className="p-4 text-right font-medium">العملية</th>
                <th className="p-4 text-right font-medium">العميل</th>
                <th className="p-4 text-right font-medium">التفاصيل</th>
                <th className="p-4 text-right font-medium">الدفع</th>
                <th className="p-4 text-right font-medium">الإيراد</th>
                <th className="p-4 text-right font-medium">حركة الكاش</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {filteredTransactions.map((item) => (
                <tr key={item.id} className="transition hover:bg-white/[0.02]">
                  <td className="whitespace-nowrap p-4 text-white/45">
                    {new Date(item.occurredAt).toLocaleTimeString("ar-DZ", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="p-4 font-medium">{item.staffName}</td>
                  <td className="p-4 text-violet-300">
                    {item.shiftId ? `#${item.shiftId}` : "—"}
                  </td>
                  <td className="p-4">
                    <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-xs text-white/65">
                      {item.typeLabel}
                    </span>
                  </td>
                  <td className="max-w-[150px] truncate p-4">
                    {item.customer}
                  </td>
                  <td className="max-w-[220px] truncate p-4 text-white/40">
                    {item.details}
                  </td>
                  <td className="p-4 text-xs text-white/60">{item.payment}</td>
                  <td dir="ltr" className="p-4 font-medium text-emerald-300">
                    {item.revenue > 0 ? money(item.revenue) : "—"}
                  </td>
                  <td
                    dir="ltr"
                    className={`p-4 font-medium ${
                      item.cashMovement < 0 ? "text-rose-300" : "text-cyan-300"
                    }`}
                  >
                    {item.cashMovement !== 0 ? money(item.cashMovement) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredTransactions.length === 0 && (
            <div className="p-10 text-center text-sm text-white/35">
              لا توجد عمليات مطابقة للفلاتر
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-[#0c101d]">
        <div className="flex items-center gap-3 border-b border-white/[0.08] p-5">
          <History size={18} className="text-violet-300" />
          <div>
            <h2 className="font-semibold">سجل الورديات</h2>
            <p className="mt-1 text-xs text-white/30">آخر 100 وردية مغلقة</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="text-xs text-white/35">
              <tr className="border-b border-white/[0.06]">
                <th className="p-4 text-right font-medium">الكاشير</th>
                <th className="p-4 text-right font-medium">البداية</th>
                <th className="p-4 text-right font-medium">النهاية</th>
                <th className="p-4 text-right font-medium">Opening</th>
                <th className="p-4 text-right font-medium">Expected</th>
                <th className="p-4 text-right font-medium">Actual</th>
                <th className="p-4 text-right font-medium">Difference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {shiftHistory.map((shift) => (
                <tr key={shift.id}>
                  <td className="p-4 font-medium">{shift.staffName}</td>
                  <td className="p-4 text-white/55">
                    {formatDate(shift.openedAt)}
                  </td>
                  <td className="p-4 text-white/55">
                    {formatDate(shift.closedAt)}
                  </td>
                  <td dir="ltr" className="p-4">
                    {money(shift.openingCash)}
                  </td>
                  <td dir="ltr" className="p-4 text-amber-300">
                    {money(shift.expectedCash)}
                  </td>
                  <td dir="ltr" className="p-4">
                    {money(Number(shift.actualCash || 0))}
                  </td>
                  <td
                    dir="ltr"
                    className={`p-4 font-semibold ${differenceClass(Number(shift.difference || 0))}`}
                  >
                    {money(Number(shift.difference || 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {shiftHistory.length === 0 && (
            <div className="p-8 text-center text-sm text-white/35">
              لا توجد ورديات مغلقة بعد
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-[#0c101d]">
        <div className="border-b border-white/[0.08] p-5">
          <h2 className="font-semibold">المصروفات</h2>
          <p className="mt-1 text-xs text-white/30">Expenses</p>
        </div>
        <div className="divide-y divide-white/[0.06]">
          {expenses.map((expense) => (
            <div
              key={expense.id}
              className="flex items-center justify-between gap-3 p-4"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{expense.title}</p>
                <p className="mt-1 text-xs text-white/35">
                  {expense.category} · {formatDate(expense.spentAt)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p dir="ltr" className="text-sm font-semibold text-rose-300">
                  {money(Number(expense.amount || 0))}
                </p>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => void removeExpense(expense.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-300"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {expenses.length === 0 && (
            <div className="p-8 text-center text-sm text-white/35">
              لا توجد مصروفات
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
