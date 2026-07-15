import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CircleDollarSign,
  CreditCard,
  Receipt,
  RefreshCw,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";

type BillingSummary = {
  sessionRevenue: number;
  tournamentRevenue: number;
  earnedRevenue: number;
  walletTopUps: number;
  cashSessions: number;
  sessionWalletPaid: number;
  sessionDebtAdded: number;
  tournamentWalletPaid: number;
  tournamentDebtAdded: number;
  walletLiability: number;
  playerDebt: number;
  guestOpenDebt: number;
  totalOutstandingDebt: number;
  guestDebtCollected: number;
  cashInflow: number;
  expenses: number;
  netCash: number;
};

type DailyRevenue = {
  day: string;
  sessionRevenue: number;
  tournamentRevenue: number;
  cashPaid: number;
  walletPaid: number;
  debtAdded: number;
  totalRevenue: number;
};

type LedgerItem = {
  id: string;
  source: string;
  type: string;
  title: string;
  subtitle: string;
  amount: number;
  direction:
    | "In"
    | "Out"
    | "Revenue";
  createdAt: string;
};

type Expense = {
  id: number;
  title: string;
  category: string;
  amount: number;
  note: string | null;
  spentAt: string;
  createdAt: string;
};

const emptySummary:
  BillingSummary = {
  sessionRevenue: 0,
  tournamentRevenue: 0,
  earnedRevenue: 0,
  walletTopUps: 0,
  cashSessions: 0,
  sessionWalletPaid: 0,
  sessionDebtAdded: 0,
  tournamentWalletPaid: 0,
  tournamentDebtAdded: 0,
  walletLiability: 0,
  playerDebt: 0,
  guestOpenDebt: 0,
  totalOutstandingDebt: 0,
  guestDebtCollected: 0,
  cashInflow: 0,
  expenses: 0,
  netCash: 0,
};

const fieldClass =
  "h-11 w-full rounded-lg border border-white/10 bg-[#080b16] px-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-violet-400/60";

function normalizeNumber(
  value: string
) {
  const digitMap:
    Record<string, string> = {
    "&": "1",
    "é": "2",
    '"': "3",
    "'": "4",
    "(": "5",
    "-": "6",
    "è": "7",
    "_": "8",
    "ç": "9",
    "à": "0",

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
    .map(
      (character) =>
        digitMap[character] ??
        character
    )
    .join("")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");

  const parts =
    normalized.split(".");

  if (parts.length > 1) {
    normalized =
      `${parts[0]}.` +
      parts.slice(1).join("");
  }

  return normalized;
}

function formatMoney(
  value: number
) {
  return `${Number(
    value || 0
  ).toFixed(2)} DA`;
}

export default function Billing() {
  const [summary, setSummary] =
    useState<BillingSummary>(
      emptySummary
    );

  const [
    dailyRevenue,
    setDailyRevenue,
  ] = useState<DailyRevenue[]>([]);

  const [ledger, setLedger] =
    useState<LedgerItem[]>([]);

  const [expenses, setExpenses] =
    useState<Expense[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [
    deletingId,
    setDeletingId,
  ] = useState<number | null>(
    null
  );

  const [error, setError] =
    useState("");

  const [title, setTitle] =
    useState("");

  const [category, setCategory] =
    useState("Utilities");

  const [amount, setAmount] =
    useState("");

  const [note, setNote] =
    useState("");

  const [spentAt, setSpentAt] =
    useState(() => {
      const date = new Date();

      return date
        .toISOString()
        .slice(0, 16);
    });

  const api = (window as any).api;

  async function loadData(
    showLoading = false
  ) {
    try {
      if (showLoading) {
        setLoading(true);
      }

      setError("");

      const [
        summaryResult,
        dailyResult,
        ledgerResult,
        expenseResult,
      ] = await Promise.all([
        api.getBillingSummary(),

        api.getBillingDailyRevenue(),

        api.getBillingLedger(),

        api.getExpenses(),
      ]);

      setSummary(summaryResult);
      setDailyRevenue(dailyResult);
      setLedger(ledgerResult);
      setExpenses(expenseResult);
    } catch (loadError) {
      console.error(loadError);

      setError(
        "تعذر تحميل البيانات المالية"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData(true);
  }, []);

  async function addExpense(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const cleanTitle =
      title.trim();

    const numericAmount =
      Number(amount);

    if (!cleanTitle) {
      setError(
        "أدخل اسم المصروف"
      );

      return;
    }

    if (
      !Number.isFinite(
        numericAmount
      ) ||
      numericAmount <= 0
    ) {
      setError(
        "أدخل مبلغًا صحيحًا"
      );

      return;
    }

    try {
      setSaving(true);
      setError("");

      await api.addExpense({
        title: cleanTitle,
        category,
        amount: numericAmount,
        note: note.trim(),

        spentAt:
          new Date(
            spentAt
          ).toISOString(),
      });

      setTitle("");
      setAmount("");
      setNote("");

      await loadData();
    } catch (saveError) {
      console.error(saveError);

      setError(
        "تعذر تسجيل المصروف"
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteExpense(
    expense: Expense
  ) {
    const confirmed =
      window.confirm(
        `هل تريد حذف ${expense.title}؟`
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(expense.id);

      await api.deleteExpense(
        expense.id
      );

      await loadData();
    } catch (deleteError) {
      console.error(deleteError);

      setError(
        "تعذر حذف المصروف"
      );
    } finally {
      setDeletingId(null);
    }
  }

  const currentMonthExpenses =
    useMemo(() => {
      const now = new Date();

      return expenses
        .filter((expense) => {
          const date = new Date(
            expense.spentAt
          );

          return (
            date.getMonth() ===
              now.getMonth() &&
            date.getFullYear() ===
              now.getFullYear()
          );
        })
        .reduce(
          (total, expense) =>
            total +
            Number(
              expense.amount || 0
            ),
          0
        );
    }, [expenses]);

  const statCards = [
    {
      label:
        "الإيرادات المكتسبة",
      english:
        "Earned Revenue",

      value:
        summary.earnedRevenue,

      icon: TrendingUp,

      color:
        "text-emerald-300",

      surface:
        "bg-emerald-500/10",
    },
    {
      label:
        "التدفق النقدي",

      english:
        "Cash Inflow",

      value:
        summary.cashInflow,

      icon: Banknote,

      color:
        "text-sky-300",

      surface:
        "bg-sky-500/10",
    },
    {
      label:
        "الديون المستحقة",

      english:
        "Outstanding Debt",

      value:
        summary.totalOutstandingDebt,

      icon:
        CircleDollarSign,

      color:
        "text-rose-300",

      surface:
        "bg-rose-500/10",
    },
    {
      label:
        "صافي النقد",

      english:
        "Net Cash",

      value:
        summary.netCash,

      icon: Wallet,

      color:
        summary.netCash >= 0
          ? "text-violet-300"
          : "text-rose-300",

      surface:
        "bg-violet-500/10",
    },
  ];

  return (
    <div
      dir="rtl"
      className="space-y-6"
    >
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-sm text-violet-300">
            Financial Control
          </p>

          <h1 className="text-3xl font-semibold">
            الفوترة / Billing
          </h1>

          <p className="mt-2 text-sm text-white/45">
            الإيرادات والمصروفات
            والديون والتدفق النقدي
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            void loadData(true)
          }
          disabled={loading}
          className="flex h-11 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm"
        >
          <RefreshCw
            size={17}
            className={
              loading
                ? "animate-spin"
                : ""
            }
          />

          تحديث
        </button>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;

          return (
            <article
              key={stat.english}
              className="rounded-xl border border-white/[0.08] bg-[#0c101d] p-5"
            >
              <div className="flex items-start justify-between">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-lg ${stat.surface}`}
                >
                  <Icon
                    size={21}
                    className={
                      stat.color
                    }
                  />
                </div>

                <p
                  dir="ltr"
                  className="text-xl font-semibold"
                >
                  {formatMoney(
                    stat.value
                  )}
                </p>
              </div>

              <p className="mt-5 text-sm">
                {stat.label}
              </p>

              <p className="mt-1 text-xs text-white/30">
                {stat.english}
              </p>
            </article>
          );
        })}
      </section>

      {error && (
        <div className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_370px]">
        <div className="space-y-6">
          <article className="rounded-xl border border-white/[0.08] bg-[#0c101d]">
            <div className="border-b border-white/[0.08] p-5">
              <h2 className="font-semibold">
                التفاصيل المالية
              </h2>

              <p className="mt-1 text-xs text-white/30">
                Financial Breakdown
              </p>
            </div>

            <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-lg bg-white/[0.03] p-4">
                <p className="text-xs text-white/35">
                  إيرادات الجلسات
                </p>

                <p className="mt-2 text-emerald-300">
                  {formatMoney(
                    summary.sessionRevenue
                  )}
                </p>
              </div>

              <div className="rounded-lg bg-white/[0.03] p-4">
                <p className="text-xs text-white/35">
                  إيرادات البطولات
                </p>

                <p className="mt-2 text-violet-300">
                  {formatMoney(
                    summary.tournamentRevenue
                  )}
                </p>
              </div>

              <div className="rounded-lg bg-white/[0.03] p-4">
                <p className="text-xs text-white/35">
                  شحن المحافظ
                </p>

                <p className="mt-2 text-sky-300">
                  {formatMoney(
                    summary.walletTopUps
                  )}
                </p>
              </div>

              <div className="rounded-lg bg-white/[0.03] p-4">
                <p className="text-xs text-white/35">
                  أموال المحافظ الحالية
                </p>

                <p className="mt-2 text-amber-300">
                  {formatMoney(
                    summary.walletLiability
                  )}
                </p>
              </div>

              <div className="rounded-lg bg-white/[0.03] p-4">
                <p className="text-xs text-white/35">
                  ديون اللاعبين
                </p>

                <p className="mt-2 text-rose-300">
                  {formatMoney(
                    summary.playerDebt
                  )}
                </p>
              </div>

              <div className="rounded-lg bg-white/[0.03] p-4">
                <p className="text-xs text-white/35">
                  ديون Guest
                </p>

                <p className="mt-2 text-rose-300">
                  {formatMoney(
                    summary.guestOpenDebt
                  )}
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-white/[0.08] bg-[#0c101d]">
            <div className="border-b border-white/[0.08] p-5">
              <h2 className="font-semibold">
                الإيرادات اليومية
              </h2>

              <p className="mt-1 text-xs text-white/30">
                Last 30 Days
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead className="text-xs text-white/30">
                  <tr className="border-b border-white/[0.07]">
                    <th className="p-4 text-right">
                      اليوم
                    </th>

                    <th className="p-4 text-right">
                      الجلسات
                    </th>

                    <th className="p-4 text-right">
                      البطولات
                    </th>

                    <th className="p-4 text-right">
                      الديون
                    </th>

                    <th className="p-4 text-right">
                      الإجمالي
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {dailyRevenue.length ===
                  0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="p-10 text-center text-white/30"
                      >
                        لا توجد بيانات
                      </td>
                    </tr>
                  ) : (
                    dailyRevenue.map(
                      (day) => (
                        <tr
                          key={day.day}
                          className="border-b border-white/[0.05]"
                        >
                          <td className="p-4">
                            {new Date(
                              `${day.day}T00:00:00`
                            ).toLocaleDateString(
                              "ar-DZ"
                            )}
                          </td>

                          <td
                            dir="ltr"
                            className="p-4 text-emerald-300"
                          >
                            {formatMoney(
                              day.sessionRevenue
                            )}
                          </td>

                          <td
                            dir="ltr"
                            className="p-4 text-violet-300"
                          >
                            {formatMoney(
                              day.tournamentRevenue
                            )}
                          </td>

                          <td
                            dir="ltr"
                            className="p-4 text-rose-300"
                          >
                            {formatMoney(
                              day.debtAdded
                            )}
                          </td>

                          <td
                            dir="ltr"
                            className="p-4 font-semibold"
                          >
                            {formatMoney(
                              day.totalRevenue
                            )}
                          </td>
                        </tr>
                      )
                    )
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className="rounded-xl border border-white/[0.08] bg-[#0c101d]">
            <div className="border-b border-white/[0.08] p-5">
              <h2 className="font-semibold">
                السجل المالي
              </h2>

              <p className="mt-1 text-xs text-white/30">
                Financial Ledger
              </p>
            </div>

            <div className="divide-y divide-white/[0.06]">
              {ledger.length === 0 ? (
                <div className="p-10 text-center text-white/30">
                  لا توجد عمليات
                </div>
              ) : (
                ledger
                  .slice(0, 40)
                  .map((item) => {
                    const isOut =
                      item.direction ===
                      "Out";

                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-4 p-4"
                      >
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                            isOut
                              ? "bg-rose-500/10 text-rose-300"
                              : "bg-emerald-500/10 text-emerald-300"
                          }`}
                        >
                          {isOut ? (
                            <ArrowUpRight
                              size={18}
                            />
                          ) : (
                            <ArrowDownLeft
                              size={18}
                            />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {item.title}
                          </p>

                          <p className="mt-1 truncate text-xs text-white/30">
                            {item.subtitle} ·{" "}
                            {item.source}
                          </p>
                        </div>

                        <div className="text-left">
                          <p
                            dir="ltr"
                            className={
                              isOut
                                ? "font-semibold text-rose-300"
                                : "font-semibold text-emerald-300"
                            }
                          >
                            {isOut
                              ? "-"
                              : "+"}
                            {formatMoney(
                              item.amount
                            )}
                          </p>

                          <p className="mt-1 text-[10px] text-white/25">
                            {new Date(
                              item.createdAt
                            ).toLocaleString(
                              "ar-DZ"
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </article>
        </div>

        <aside className="space-y-6">
          <article className="rounded-xl border border-violet-400/15 bg-[#0c101d]">
            <div className="border-b border-white/[0.08] p-5">
              <div className="flex items-center gap-3">
                <Receipt className="text-violet-300" />

                <div>
                  <h2 className="font-semibold">
                    تسجيل مصروف
                  </h2>

                  <p className="mt-1 text-xs text-white/30">
                    Add Expense
                  </p>
                </div>
              </div>
            </div>

            <form
              onSubmit={addExpense}
              className="space-y-4 p-5"
            >
              <input
                value={title}
                onChange={(event) =>
                  setTitle(
                    event.target.value
                  )
                }
                placeholder="اسم المصروف"
                className={fieldClass}
              />

              <select
                value={category}
                onChange={(event) =>
                  setCategory(
                    event.target.value
                  )
                }
                className={fieldClass}
              >
                <option value="Utilities">
                  Utilities
                </option>

                <option value="Internet">
                  Internet
                </option>

                <option value="Rent">
                  Rent
                </option>

                <option value="Maintenance">
                  Maintenance
                </option>

                <option value="Equipment">
                  Equipment
                </option>

                <option value="Salaries">
                  Salaries
                </option>

                <option value="Other">
                  Other
                </option>
              </select>

              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(event) =>
                  setAmount(
                    normalizeNumber(
                      event.target.value
                    )
                  )
                }
                placeholder="المبلغ DA"
                className={fieldClass}
              />

              <input
                type="datetime-local"
                value={spentAt}
                onChange={(event) =>
                  setSpentAt(
                    event.target.value
                  )
                }
                className={fieldClass}
              />

              <textarea
                value={note}
                onChange={(event) =>
                  setNote(
                    event.target.value
                  )
                }
                placeholder="ملاحظة اختيارية"
                rows={3}
                className="w-full resize-none rounded-lg border border-white/10 bg-[#080b16] p-3 text-sm outline-none"
              />

              <button
                type="submit"
                disabled={saving}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-violet-600 text-sm font-medium disabled:opacity-50"
              >
                {saving ? (
                  <RefreshCw
                    size={17}
                    className="animate-spin"
                  />
                ) : (
                  <CreditCard
                    size={17}
                  />
                )}

                تسجيل المصروف
              </button>
            </form>
          </article>

          <article className="rounded-xl border border-white/[0.08] bg-[#0c101d]">
            <div className="border-b border-white/[0.08] p-5">
              <h2 className="font-semibold">
                المصروفات
              </h2>

              <p className="mt-1 text-xs text-white/30">
                هذا الشهر:{" "}
                {formatMoney(
                  currentMonthExpenses
                )}
              </p>
            </div>

            <div className="max-h-[500px] divide-y divide-white/[0.06] overflow-y-auto">
              {expenses.length === 0 ? (
                <div className="p-8 text-center text-sm text-white/30">
                  لا توجد مصروفات
                </div>
              ) : (
                expenses.map(
                  (expense) => (
                    <div
                      key={expense.id}
                      className="flex items-center gap-3 p-4"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-300">
                        <Receipt
                          size={16}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">
                          {expense.title}
                        </p>

                        <p className="mt-1 text-xs text-white/30">
                          {
                            expense.category
                          }
                        </p>
                      </div>

                      <div className="text-left">
                        <p
                          dir="ltr"
                          className="text-sm text-rose-300"
                        >
                          {formatMoney(
                            expense.amount
                          )}
                        </p>

                        <button
                          type="button"
                          onClick={() =>
                            void deleteExpense(
                              expense
                            )
                          }
                          disabled={
                            deletingId ===
                            expense.id
                          }
                          className="mt-1 text-white/25 hover:text-rose-300"
                        >
                          {deletingId ===
                          expense.id ? (
                            <RefreshCw
                              size={13}
                              className="animate-spin"
                            />
                          ) : (
                            <Trash2
                              size={13}
                            />
                          )}
                        </button>
                      </div>
                    </div>
                  )
                )
              )}
            </div>
          </article>
        </aside>
      </section>
    </div>
  );
}