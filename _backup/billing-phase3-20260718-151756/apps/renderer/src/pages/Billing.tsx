import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Clock3,
  History,
  LogIn,
  LogOut,
  Plus,
  RefreshCw,
  Trash2,
  UserRound,
} from "lucide-react";
import { handleUnauthorized } from "../lib/auth";
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
  guestDebtCash: number;
  cashCollected: number;
  expenses: number;
};

const fieldClass =
  "h-11 w-full rounded-lg border border-white/10 bg-[#080b16] px-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-violet-400/60";

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
  const api = (window as any).api;

  const [current, setCurrent] = useState<StaffUser | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [shiftHistory, setShiftHistory] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shiftSaving, setShiftSaving] = useState(false);
  const [error, setError] = useState("");

  const [openingCash, setOpeningCash] = useState("0");
  const [actualCash, setActualCash] = useState("0");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Other");
  const [amount, setAmount] = useState("0");
  const [note, setNote] = useState("");

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

  async function loadAll(showLoading = false) {
    try {
      if (showLoading) setLoading(true);
      setError("");

      const [staffUser, s, e, activeShift, history] = await Promise.all([
        loadCurrentStaff(api),
        api.getBillingSummary(),
        api.getExpenses(),
        api.getCurrentShift(),
        api.getShiftHistory(),
      ]);

      setCurrent(staffUser);
      setSummary(s);
      setExpenses(e);
      setCurrentShift(activeShift);
      setShiftHistory(history);

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

    if (!canEdit) {
      window.alert("إضافة/حذف المصروفات: Admin فقط");
      window.location.hash = "#/staff";
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
      setCategory("Other");
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
    <div dir="rtl" className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-sm text-violet-300">Business</p>
          <h1 className="text-3xl font-semibold">Billing / الفوترة</h1>
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
            <h2 className="font-semibold">الوردية الحالية</h2>
            <p className="mt-1 text-xs text-white/30">Current shift</p>
          </div>
        </div>

        {!currentShift ? (
          <form
            onSubmit={openShift}
            className="grid gap-4 p-5 lg:grid-cols-[1fr_240px_auto] lg:items-end"
          >
            <div>
              <p className="text-sm font-medium">لا توجد وردية مفتوحة</p>
              <p className="mt-1 text-xs text-white/35">
                افتح وردية واحدة للكاشير الحالي قبل تسجيل عمليات الكاش.
              </p>
            </div>
            <label className="space-y-2">
              <span className="text-xs text-white/45">
                كاش البداية / Opening cash
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
              فتح الوردية
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
                    بدأت: {formatDate(currentShift.openedAt)}
                  </p>
                </div>
              </div>
              <span className="w-fit rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
                وردية مفتوحة
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
              {[
                ["كاش البداية", currentShift.openingCash, "text-white"],
                ["جلسات Cash", currentShift.sessionCash, "text-emerald-300"],
                ["مبيعات Store", currentShift.storeCash, "text-emerald-300"],
                ["شحن المحافظ", currentShift.walletTopUps, "text-emerald-300"],
                [
                  "تحصيل الديون",
                  currentShift.guestDebtCash,
                  "text-emerald-300",
                ],
                ["المصروفات", currentShift.expenses, "text-rose-300"],
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
                <p className="text-xs text-white/40">الكاش المتوقع الآن</p>
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
                  الكاش الحقيقي / Actual cash
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
                  إغلاق الوردية
                </button>
              </form>
            </div>
          </div>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <article className="rounded-xl border border-white/[0.08] bg-[#0c101d] p-5">
          <h2 className="font-semibold">الملخص العام</h2>
          {!summary ? (
            <p className="mt-3 text-sm text-white/35">لا توجد بيانات</p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-white/[0.03] p-4">
                <p className="text-xs text-white/35">إيراد Store</p>
                <p dir="ltr" className="mt-1 text-emerald-300">
                  {money(Number(summary.storeRevenue || 0))}
                </p>
              </div>
              <div className="rounded-lg bg-white/[0.03] p-4">
                <p className="text-xs text-white/35">المصروفات</p>
                <p dir="ltr" className="mt-1 text-rose-300">
                  {money(Number(summary.expenses || 0))}
                </p>
              </div>
              <div className="col-span-2 rounded-lg bg-white/[0.03] p-4">
                <p className="text-xs text-white/35">صافي النقد</p>
                <p dir="ltr" className="mt-1 font-semibold text-amber-300">
                  {money(netCash)}
                </p>
              </div>
            </div>
          )}
        </article>

        <aside className="rounded-xl border border-violet-400/15 bg-[#0c101d]">
          <div className="border-b border-white/[0.08] p-5">
            <h2 className="font-semibold">إضافة مصروف</h2>
            <p className="mt-1 text-xs text-white/30">Admin فقط</p>
          </div>
          <form onSubmit={addExpense} className="space-y-4 p-5">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="عنوان المصروف"
              className={fieldClass}
              disabled={!canEdit}
            />
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Category"
              className={fieldClass}
              disabled={!canEdit}
            />
            <input
              dir="ltr"
              value={amount}
              onChange={(e) => setAmount(normalizeNumber(e.target.value))}
              placeholder="Amount"
              className={fieldClass}
              disabled={!canEdit}
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ملاحظة (اختياري)"
              className={fieldClass}
              disabled={!canEdit}
            />
            <button
              type="submit"
              disabled={!canEdit || saving}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-violet-600 text-sm font-medium disabled:opacity-50"
            >
              {saving ? (
                <RefreshCw size={17} className="animate-spin" />
              ) : (
                <Plus size={17} />
              )}
              إضافة
            </button>
          </form>
        </aside>
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
