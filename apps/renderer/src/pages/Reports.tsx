import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Crown,
  RefreshCw,
  TrendingUp,
  Users,
  Wallet,
  CircleDollarSign,
  ShoppingBag,
  Boxes,
  Layers,
} from "lucide-react";

type Range = "today" | "week" | "month" | "custom";

type Report = {
  range: Range;
  start: string;
  end: string;

  sessions: {
    revenue: number;
    cashPaid: number;
    walletPaid: number;
    debtAdded: number;
    count: number;
  };

  tournaments: {
    revenue: number;
    walletPaid: number;
    debtAdded: number;
    count: number;
  };

  store: {
    revenue: number;
    cashPaid: number;
    walletPaid: number;
    debtAdded: number;
    count: number;
  };

  topUps: {
    total: number;
    count: number;
  };

  guestDebtPaid: {
    total: number;
    count: number;
  };

  expenses: {
    total: number;
    count: number;
  };

  cashInflow: number;
  netCash: number;

  topPlayers: Array<{
    id: number;
    name: string;
    username: string;
    totalCharged: number;
  }>;

  topDebts: Array<{
    id: number;
    name: string;
    username: string;
    walletBalance: number;
    debtBalance: number;
  }>;

  storeAnalytics: {
    topProducts: Array<{
      productId: number;
      name: string;
      unit: string;
      quantity: number;
      revenue: number;
    }>;
    revenueByCategory: Array<{
      category: string;
      quantity: number;
      revenue: number;
    }>;
    profit: number;
    cogs: number;
    inventoryValuation: {
      valuationCost: number;
      valuationSale: number;
    };
  };
};

const fieldClass =
  "h-11 w-full rounded-lg border border-white/10 bg-[#080b16] px-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-violet-400/60";

function formatMoney(value: number) {
  return `${Number(value || 0).toFixed(2)} DA`;
}

export default function Reports() {
  const api = (window as any).api;

  const [range, setRange] = useState<Range>("today");
  const [start, setStart] = useState(() => new Date().toISOString().slice(0, 16));
  const [end, setEnd] = useState(() => new Date().toISOString().slice(0, 16));

  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");

  async function loadReport(showLoading = false) {
    try {
      if (showLoading) setLoading(true);
      setError("");

      const payload =
        range === "custom"
          ? {
              range,
              start: new Date(start).toISOString(),
              end: new Date(end).toISOString(),
            }
          : { range };

      const result = await api.getReport(payload);
      setReport(result);
    } catch (loadError) {
      console.error(loadError);
      setError("تعذر إنشاء التقرير");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReport(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const headerSubtitle = useMemo(() => {
    if (!report) return "";
    return `${new Date(report.start).toLocaleString("ar-DZ")} → ${new Date(report.end).toLocaleString("ar-DZ")}`;
  }, [report]);

  function onCustomSubmit(event: FormEvent) {
    event.preventDefault();
    void loadReport(true);
  }

  const totalRevenue =
    (report?.sessions.revenue || 0) +
    (report?.tournaments.revenue || 0) +
    (report?.store.revenue || 0);

  const statCards = report
    ? [
        {
          label: "الإيراد (جلسات + بطولات + متجر)",
          value: totalRevenue,
          icon: TrendingUp,
          surface: "bg-emerald-500/10",
          color: "text-emerald-300",
        },
        {
          label: "التدفق النقدي",
          value: report.cashInflow,
          icon: Wallet,
          surface: "bg-sky-500/10",
          color: "text-sky-300",
        },
        {
          label: "الديون المضافة",
          value: report.sessions.debtAdded + report.tournaments.debtAdded + report.store.debtAdded,
          icon: CircleDollarSign,
          surface: "bg-rose-500/10",
          color: "text-rose-300",
        },
        {
          label: "المصروفات",
          value: report.expenses.total,
          icon: BarChart3,
          surface: "bg-amber-500/10",
          color: "text-amber-300",
        },
      ]
    : [];

  return (
    <div dir="rtl" className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-sm text-violet-300">Insights</p>
          <h1 className="text-3xl font-semibold">التقارير / Reports</h1>
          <p className="mt-2 text-sm text-white/45">تقارير حسب فترة + متجر + ربح + مخزون</p>
          {headerSubtitle && <p className="mt-2 text-xs text-white/30">{headerSubtitle}</p>}
        </div>

        <button
          type="button"
          onClick={() => void loadReport(true)}
          disabled={loading}
          className="flex h-11 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm"
        >
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
          تحديث
        </button>
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-[#0c101d] p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {(["today", "week", "month", "custom"] as Range[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRange(value)}
                className={`h-10 rounded-lg px-4 text-xs ${
                  range === value ? "bg-violet-600" : "bg-white/[0.05] text-white/45"
                }`}
              >
                {value === "today" && "اليوم"}
                {value === "week" && "آخر 7 أيام"}
                {value === "month" && "آخر 30 يوم"}
                {value === "custom" && "مخصص"}
              </button>
            ))}
          </div>

          {range === "custom" && (
            <form onSubmit={onCustomSubmit} className="flex flex-col gap-2 sm:flex-row">
              <div className="flex items-center gap-2">
                <CalendarDays size={16} className="text-white/25" />
                <input
                  type="datetime-local"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className={fieldClass}
                />
              </div>

              <div className="flex items-center gap-2">
                <CalendarDays size={16} className="text-white/25" />
                <input
                  type="datetime-local"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className={fieldClass}
                />
              </div>

              <button type="submit" className="h-11 rounded-lg bg-violet-600 px-4 text-sm font-medium">
                إنشاء
              </button>
            </form>
          )}
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-60 items-center justify-center text-white/35">جارٍ إنشاء التقرير...</div>
      ) : !report ? (
        <div className="flex min-h-60 items-center justify-center text-white/35">لا توجد بيانات</div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <article key={stat.label} className="rounded-xl border border-white/[0.08] bg-[#0c101d] p-5">
                  <div className="flex items-start justify-between">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${stat.surface}`}>
                      <Icon size={21} className={stat.color} />
                    </div>
                    <p dir="ltr" className="text-xl font-semibold">
                      {formatMoney(stat.value)}
                    </p>
                  </div>
                  <p className="mt-5 text-sm">{stat.label}</p>
                </article>
              );
            })}
          </section>

          {/* NEW: Store analytics */}
          <section className="grid gap-6 xl:grid-cols-2">
            <article className="rounded-xl border border-white/[0.08] bg-[#0c101d]">
              <div className="border-b border-white/[0.08] p-5">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="text-violet-300" size={18} />
                  <h2 className="font-semibold">المتجر — ربح ومبيعات</h2>
                </div>
                <p className="mt-1 text-xs text-white/30">Store revenue / profit</p>
              </div>

              <div className="grid gap-3 p-5 sm:grid-cols-2">
                <div className="rounded-lg bg-white/[0.03] p-4">
                  <p className="text-xs text-white/35">إيراد المتجر</p>
                  <p dir="ltr" className="mt-2 text-emerald-300">
                    {formatMoney(report.store.revenue)}
                  </p>
                </div>

                <div className="rounded-lg bg-white/[0.03] p-4">
                  <p className="text-xs text-white/35">عدد فواتير المتجر</p>
                  <p className="mt-2 text-sky-300">{report.store.count}</p>
                </div>

                <div className="rounded-lg bg-white/[0.03] p-4">
                  <p className="text-xs text-white/35">تكلفة البضاعة (COGS)</p>
                  <p dir="ltr" className="mt-2 text-amber-300">
                    {formatMoney(report.storeAnalytics.cogs)}
                  </p>
                </div>

                <div className="rounded-lg bg-white/[0.03] p-4">
                  <p className="text-xs text-white/35">الربح (Profit)</p>
                  <p dir="ltr" className="mt-2 font-semibold text-emerald-300">
                    {formatMoney(report.storeAnalytics.profit)}
                  </p>
                </div>
              </div>
            </article>

            <article className="rounded-xl border border-white/[0.08] bg-[#0c101d]">
              <div className="border-b border-white/[0.08] p-5">
                <div className="flex items-center gap-2">
                  <Boxes className="text-violet-300" size={18} />
                  <h2 className="font-semibold">قيمة المخزون (حاليًا)</h2>
                </div>
                <p className="mt-1 text-xs text-white/30">Inventory valuation snapshot</p>
              </div>

              <div className="grid gap-3 p-5 sm:grid-cols-2">
                <div className="rounded-lg bg-white/[0.03] p-4">
                  <p className="text-xs text-white/35">Cost valuation</p>
                  <p dir="ltr" className="mt-2 text-amber-300">
                    {formatMoney(report.storeAnalytics.inventoryValuation.valuationCost)}
                  </p>
                </div>

                <div className="rounded-lg bg-white/[0.03] p-4">
                  <p className="text-xs text-white/35">Sale valuation</p>
                  <p dir="ltr" className="mt-2 text-emerald-300">
                    {formatMoney(report.storeAnalytics.inventoryValuation.valuationSale)}
                  </p>
                </div>
              </div>
            </article>

            <article className="rounded-xl border border-white/[0.08] bg-[#0c101d]">
              <div className="border-b border-white/[0.08] p-5">
                <div className="flex items-center gap-2">
                  <Layers className="text-violet-300" size={18} />
                  <h2 className="font-semibold">أفضل المنتجات</h2>
                </div>
                <p className="mt-1 text-xs text-white/30">Top products</p>
              </div>

              <div className="divide-y divide-white/[0.06]">
                {report.storeAnalytics.topProducts.length === 0 ? (
                  <div className="p-10 text-center text-white/30">لا توجد بيانات</div>
                ) : (
                  report.storeAnalytics.topProducts.map((p, idx) => (
                    <div key={p.productId} className="flex items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {idx + 1}. {p.name}
                        </p>
                        <p className="mt-1 text-xs text-white/30">
                          Qty: {Number(p.quantity || 0).toFixed(2)} {p.unit}
                        </p>
                      </div>
                      <p dir="ltr" className="text-sm font-semibold text-emerald-300">
                        {formatMoney(p.revenue)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className="rounded-xl border border-white/[0.08] bg-[#0c101d]">
              <div className="border-b border-white/[0.08] p-5">
                <div className="flex items-center gap-2">
                  <BarChart3 className="text-violet-300" size={18} />
                  <h2 className="font-semibold">المبيعات حسب التصنيف</h2>
                </div>
                <p className="mt-1 text-xs text-white/30">Revenue by category</p>
              </div>

              <div className="divide-y divide-white/[0.06]">
                {report.storeAnalytics.revenueByCategory.length === 0 ? (
                  <div className="p-10 text-center text-white/30">لا توجد بيانات</div>
                ) : (
                  report.storeAnalytics.revenueByCategory.map((c) => (
                    <div key={c.category} className="flex items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{c.category}</p>
                        <p className="mt-1 text-xs text-white/30">
                          Qty: {Number(c.quantity || 0).toFixed(2)}
                        </p>
                      </div>
                      <p dir="ltr" className="text-sm font-semibold text-emerald-300">
                        {formatMoney(c.revenue)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </article>
          </section>

          {/* Existing blocks (players/debts) */}
          <section className="grid gap-6 xl:grid-cols-2">
            <article className="rounded-xl border border-white/[0.08] bg-[#0c101d]">
              <div className="border-b border-white/[0.08] p-5">
                <h2 className="font-semibold">أفضل اللاعبين (إنفاق)</h2>
                <p className="mt-1 text-xs text-white/30">Top spenders</p>
              </div>

              <div className="divide-y divide-white/[0.06]">
                {report.topPlayers.length === 0 ? (
                  <div className="p-10 text-center text-white/30">لا توجد بيانات</div>
                ) : (
                  report.topPlayers.map((player, index) => (
                    <div key={player.id} className="flex items-center gap-3 p-4">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300">
                        <Crown size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">
                          {index + 1}. {player.name}
                        </p>
                        <p dir="ltr" className="mt-1 text-xs text-white/30">
                          @{player.username}
                        </p>
                      </div>
                      <p dir="ltr" className="text-sm font-semibold text-emerald-300">
                        {formatMoney(player.totalCharged)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className="rounded-xl border border-white/[0.08] bg-[#0c101d]">
              <div className="border-b border-white/[0.08] p-5">
                <h2 className="font-semibold">أكبر الديون (حاليًا)</h2>
                <p className="mt-1 text-xs text-white/30">Top debts now</p>
              </div>

              <div className="grid gap-3 p-5 md:grid-cols-2">
                {report.topDebts.length === 0 ? (
                  <div className="col-span-full p-8 text-center text-white/30">لا يوجد ديون</div>
                ) : (
                  report.topDebts.map((player) => (
                    <div key={player.id} className="rounded-lg border border-white/[0.08] bg-[#090d18] p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/10 text-rose-300">
                          <Users size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{player.name}</p>
                          <p dir="ltr" className="mt-1 text-xs text-white/30">
                            @{player.username}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-emerald-500/[0.06] p-3">
                          <p className="text-white/30">المحفظة</p>
                          <p dir="ltr" className="mt-1 text-emerald-300">
                            {formatMoney(player.walletBalance)}
                          </p>
                        </div>

                        <div className="rounded-lg bg-rose-500/[0.06] p-3">
                          <p className="text-white/30">الدين</p>
                          <p dir="ltr" className="mt-1 text-rose-300">
                            {formatMoney(player.debtBalance)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>
          </section>
        </>
      )}
    </div>
  );
}