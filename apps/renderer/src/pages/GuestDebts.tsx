import { FormEvent, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, Coins, Plus, CheckCircle2 } from "lucide-react";
import { handleUnauthorized } from "../lib/auth";
import { isAdmin, loadCurrentStaff, type StaffUser } from "../lib/staff-ui";

type GuestDebt = {
  id: number;
  sessionId: number | null;
  guestName: string;
  phone: string | null;
  identityNotes: string | null;
  amount: number;
  paidAmount: number;
  remaining: number;
  status: "Open" | "Paid";
  note: string | null;
  source: "session" | "manual";
  createdAt: string;
  settledAt: string | null;
};

type Range = "today" | "week" | "month" | "custom";

const fieldClass =
  "h-11 w-full rounded-lg border border-white/10 bg-[#080b16] px-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-violet-400/60";

function money(n: number) {
  return `${Number(n || 0).toFixed(2)} DA`;
}

function startOfRange(range: Range) {
  const now = new Date();
  if (range === "today") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (range === "week") {
    const d = new Date(now);
    const day = d.getDay();
    const diff = (day + 6) % 7;
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (range === "month") {
    const d = new Date(now);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  return "";
}

export default function GuestDebts() {
  const api = (window as any).api;

  const [current, setCurrent] = useState<StaffUser | null>(null);
  const canAddManual = useMemo(() => isAdmin(current), [current]);

  const [debts, setDebts] = useState<GuestDebt[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"Open" | "Paid" | "All">("Open");
  const [range, setRange] = useState<Range>("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const [settleId, setSettleId] = useState<number | null>(null);
  const [settleAmount, setSettleAmount] = useState("0");
  const [settleNote, setSettleNote] = useState("");

  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [addAmount, setAddAmount] = useState("0");
  const [addNote, setAddNote] = useState("");

  async function load(showLoading = false) {
    try {
      if (showLoading) setLoading(true);
      setError("");

      const staffUser = await loadCurrentStaff(api);
      setCurrent(staffUser);

      const start =
        range === "custom"
          ? (customStart ? new Date(customStart).toISOString() : "")
          : startOfRange(range);

      const end =
        range === "custom"
          ? (customEnd ? new Date(customEnd).toISOString() : "")
          : "";

      const rows = await api.getGuestDebts({
        query: query.trim(),
        status,
        start: start || undefined,
        end: end || undefined,
        limit: 300,
      });

      setDebts(rows);
    } catch (e) {
      console.error(e);
      setError("تعذر تحميل ديون الضيوف");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(() => {
    const totalOpen = debts
      .filter((d) => d.status === "Open")
      .reduce((t, d) => t + Number(d.remaining || 0), 0);

    const totalCollected = debts.reduce((t, d) => t + Number(d.paidAmount || 0), 0);

    return { totalOpen, totalCollected };
  }, [debts]);

  async function applyFilters(event: FormEvent) {
    event.preventDefault();
    await load(true);
  }

  async function settle(debt: GuestDebt) {
    try {
      setBusy(true);
      setError("");

      const paid = Number(settleAmount || 0);
      if (!Number.isFinite(paid) || paid <= 0) {
        setError("أدخل مبلغ التحصيل");
        return;
      }

      await api.settleGuestDebt({
        debtId: debt.id,
        paidAmount: paid,
        note: settleNote.trim() || undefined,
      });

      setSettleId(null);
      setSettleAmount("0");
      setSettleNote("");

      await load(true);
    } catch (e: any) {
      console.error(e);
      if (handleUnauthorized(e)) return;

      const msg = String(e?.message || "");
      if (msg.includes("exceeds remaining")) setError("المبلغ أكبر من المتبقي");
      else setError("تعذر تسوية الدين");
    } finally {
      setBusy(false);
    }
  }

  async function addManualDebt(event: FormEvent) {
    event.preventDefault();

    if (!canAddManual) {
      window.alert("إضافة دين يدوي: Admin فقط");
      window.location.hash = "#/staff";
      return;
    }

    try {
      setBusy(true);
      setError("");

      const amount = Number(addAmount || 0);
      if (!addName.trim()) {
        setError("اسم الضيف مطلوب");
        return;
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        setError("مبلغ الدين غير صحيح");
        return;
      }

      await api.addGuestDebt({
        guestName: addName.trim(),
        phone: addPhone.trim() || undefined,
        identityNotes: addNotes.trim() || undefined,
        amount,
        note: addNote.trim() || undefined,
      });

      setAddName("");
      setAddPhone("");
      setAddNotes("");
      setAddAmount("0");
      setAddNote("");

      await load(true);
    } catch (e: any) {
      console.error(e);
      if (handleUnauthorized(e)) return;

      const msg = String(e?.message || "");
      if (msg.includes("FORBIDDEN")) setError("هذه العملية Admin فقط");
      else setError("تعذر إضافة دين يدوي");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div dir="rtl" className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-sm text-violet-300">Business</p>
          <h1 className="text-3xl font-semibold">ديون الضيوف / Guest Debts</h1>
          <p className="mt-2 text-sm text-white/45">بحث + تحصيل جزئي/كامل + فلترة حسب الفترة</p>
        </div>

        <button
          type="button"
          onClick={() => void load(true)}
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
        <article className="rounded-xl border border-white/[0.08] bg-[#0c101d]">
          <div className="border-b border-white/[0.08] p-5">
            <form onSubmit={applyFilters} className="grid gap-3">
              <div className="flex h-11 items-center gap-2 rounded-lg border border-white/10 bg-[#080b16] px-3">
                <Search size={16} className="text-white/25" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="بحث بالاسم أو الهاتف..."
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select value={status} onChange={(e) => setStatus(e.target.value as any)} className={fieldClass}>
                  <option value="Open">Open (مفتوح)</option>
                  <option value="Paid">Paid (مدفوع)</option>
                  <option value="All">All (الكل)</option>
                </select>

                <select value={range} onChange={(e) => setRange(e.target.value as any)} className={fieldClass}>
                  <option value="today">Today</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              {range === "custom" && (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    dir="ltr"
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className={fieldClass}
                  />
                  <input
                    dir="ltr"
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className={fieldClass}
                  />
                </div>
              )}

              <button type="submit" className="flex h-11 items-center justify-center gap-2 rounded-lg bg-violet-600 text-sm font-medium">
                تطبيق الفلاتر
              </button>
            </form>
          </div>

          <div className="p-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/[0.08] bg-[#090d18] p-4">
                <p className="text-xs text-white/35">إجمالي الدين المفتوح</p>
                <p dir="ltr" className="mt-2 text-lg font-semibold text-amber-300">{money(totals.totalOpen)}</p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-[#090d18] p-4">
                <p className="text-xs text-white/35">إجمالي المحصل</p>
                <p dir="ltr" className="mt-2 text-lg font-semibold text-emerald-300">{money(totals.totalCollected)}</p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-white/[0.08] bg-[#090d18] overflow-hidden">
              {debts.length === 0 ? (
                <div className="p-8 text-center text-sm text-white/35">لا توجد نتائج</div>
              ) : (
                <div className="divide-y divide-white/[0.06]">
                  {debts.map((d) => (
                    <div key={d.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {d.guestName} <span className="text-xs text-white/35">#{d.id}</span>
                          </p>
                          <p className="mt-1 text-xs text-white/35">
                            {d.phone || "—"} · {d.status} · {d.source}
                          </p>
                          <p className="mt-1 text-[10px] text-white/25">
                            {new Date(d.createdAt).toLocaleString("ar-DZ")}
                          </p>
                        </div>

                        <div className="text-right">
                          <p dir="ltr" className="text-xs text-white/40">Total {money(d.amount)}</p>
                          <p dir="ltr" className="text-xs text-emerald-300">Paid {money(d.paidAmount || 0)}</p>
                          <p dir="ltr" className="text-sm font-semibold text-amber-300">Rem {money(d.remaining || 0)}</p>
                        </div>
                      </div>

                      {d.status === "Open" && (
                        <div className="mt-3 rounded-lg border border-white/[0.08] bg-[#080b16] p-3">
                          {settleId !== d.id ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSettleId(d.id);
                                setSettleAmount(String(Math.min(Number(d.remaining || 0), Number(d.amount || 0))));
                                setSettleNote("");
                              }}
                              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 text-sm font-medium"
                            >
                              <Coins size={16} />
                              تحصيل / Collect
                            </button>
                          ) : (
                            <div className="space-y-2">
                              <input
                                dir="ltr"
                                value={settleAmount}
                                onChange={(e) => setSettleAmount(e.target.value)}
                                className={fieldClass}
                                placeholder="Paid amount"
                              />
                              <input
                                value={settleNote}
                                onChange={(e) => setSettleNote(e.target.value)}
                                className={fieldClass}
                                placeholder="ملاحظة (اختياري)"
                              />

                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void settle(d)}
                                  className="flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 text-sm font-medium disabled:opacity-40"
                                >
                                  <CheckCircle2 size={16} />
                                  تأكيد
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setSettleId(null)}
                                  className="h-11 rounded-lg bg-white/[0.06] text-sm text-white/70"
                                >
                                  إلغاء
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </article>

        {/* Admin-only manual add */}
        <aside className="space-y-6">
          {canAddManual ? (
            <article className="rounded-xl border border-violet-400/15 bg-[#0c101d]">
              <div className="border-b border-white/[0.08] p-5">
                <h2 className="font-semibold">إضافة دين يدوي</h2>
                <p className="mt-1 text-xs text-white/30">Admin فقط</p>
              </div>

              <form onSubmit={addManualDebt} className="space-y-3 p-5">
                <input value={addName} onChange={(e) => setAddName(e.target.value)} className={fieldClass} placeholder="اسم الضيف" />
                <input dir="ltr" value={addPhone} onChange={(e) => setAddPhone(e.target.value)} className={fieldClass} placeholder="Phone (optional)" />
                <input value={addNotes} onChange={(e) => setAddNotes(e.target.value)} className={fieldClass} placeholder="ملاحظات الهوية (اختياري)" />
                <input dir="ltr" value={addAmount} onChange={(e) => setAddAmount(e.target.value)} className={fieldClass} placeholder="Amount" />
                <input value={addNote} onChange={(e) => setAddNote(e.target.value)} className={fieldClass} placeholder="Note (optional)" />

                <button
                  type="submit"
                  disabled={busy}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-violet-600 text-sm font-medium disabled:opacity-40"
                >
                  <Plus size={16} />
                  إضافة
                </button>
              </form>
            </article>
          ) : (
            <article className="rounded-xl border border-amber-400/15 bg-[#0c101d]">
              <div className="p-5 text-sm text-amber-200">
                إضافة دين يدوي Admin فقط.
              </div>
            </article>
          )}
        </aside>
      </section>
    </div>
  );
}