import { FormEvent, useEffect, useMemo, useState } from "react";
import { RefreshCw, Plus, Trash2 } from "lucide-react";
import { handleUnauthorized } from "../lib/auth";

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

export default function Billing() {
  const api = (window as any).api;

  const [summary, setSummary] = useState<Summary | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Other");
  const [amount, setAmount] = useState("0");
  const [note, setNote] = useState("");

  async function loadAll(showLoading = false) {
    try {
      if (showLoading) setLoading(true);
      setError("");
      const [s, e] = await Promise.all([api.getBillingSummary(), api.getExpenses()]);
      setSummary(s);
      setExpenses(e);
    } catch (e) {
      console.error(e);
      setError("تعذر تحميل بيانات Billing");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll(true);
  }, []);

  const netCash = useMemo(() => Number(summary?.netCash || 0), [summary]);

  async function addExpense(event: FormEvent) {
    event.preventDefault();

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
      setError("تعذر إضافة المصروف");
    } finally {
      setSaving(false);
    }
  }

  async function removeExpense(id: number) {
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
          <p className="mt-2 text-sm text-white/45">إيرادات + مصروفات + صافي</p>
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

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <article className="rounded-xl border border-white/[0.08] bg-[#0c101d] p-5">
          <h2 className="font-semibold">الملخص</h2>

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

              <div className="rounded-lg bg-white/[0.03] p-4 col-span-2">
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
            <p className="mt-1 text-xs text-white/30">يتطلب تسجيل دخول Staff</p>
          </div>

          <form onSubmit={addExpense} className="space-y-4 p-5">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان المصروف" className={fieldClass} />
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" className={fieldClass} />
            <input
              dir="ltr"
              value={amount}
              onChange={(e) => setAmount(normalizeNumber(e.target.value))}
              placeholder="Amount"
              className={fieldClass}
            />
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة (اختياري)" className={fieldClass} />

            <button
              type="submit"
              disabled={saving}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-violet-600 text-sm font-medium disabled:opacity-50"
            >
              {saving ? <RefreshCw size={17} className="animate-spin" /> : <Plus size={17} />}
              إضافة
            </button>
          </form>
        </aside>
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-[#0c101d]">
        <div className="border-b border-white/[0.08] p-5">
          <h2 className="font-semibold">المصروفات</h2>
          <p className="mt-1 text-xs text-white/30">Expenses</p>
        </div>

        <div className="divide-y divide-white/[0.06]">
          {expenses.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{e.title}</p>
                <p className="mt-1 text-xs text-white/35">
                  {e.category} · {new Date(e.spentAt).toLocaleString("ar-DZ")}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <p dir="ltr" className="text-sm font-semibold text-rose-300">
                  {money(Number(e.amount || 0))}
                </p>

                <button
                  type="button"
                  onClick={() => void removeExpense(e.id)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-300"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}

          {expenses.length === 0 && (
            <div className="p-8 text-center text-sm text-white/35">لا توجد مصروفات</div>
          )}
        </div>
      </section>
    </div>
  );
}