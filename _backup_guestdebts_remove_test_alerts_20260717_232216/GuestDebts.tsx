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

type Player = {
  id: number;
  name: string;
  username: string;
  phone: string | null;
  walletBalance: number;
  debtBalance: number;
  image: string | null;
  createdAt: string;
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
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [playerQuery, setPlayerQuery] = useState("");
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

      const [rows, playerRows] = await Promise.all([
        api.getGuestDebts({
          query: query.trim(),
          status,
          start: start || undefined,
          end: end || undefined,
          limit: 300,
        }),
        api.getPlayers(),
      ]);

      setDebts(rows);
      setPlayers(playerRows);
    } catch (e) {
      console.error(e);
      setError("ØªØ¹Ø°Ø± ØªØ­Ù…ÙŠÙ„ Ø¯ÙŠÙˆÙ† Ø§Ù„Ø¶ÙŠÙˆÙ");
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

    const playerDebtOpen = players.reduce(
      (t, p) => t + Math.max(0, Number(p.debtBalance || 0)),
      0,
    );
    const playerWalletTotal = players.reduce(
      (t, p) => t + Math.max(0, Number(p.walletBalance || 0)),
      0,
    );
    return { totalOpen, totalCollected, playerDebtOpen, playerWalletTotal };
  }, [debts, players]);

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
        setError("Ø£Ø¯Ø®Ù„ Ù…Ø¨Ù„Øº Ø§Ù„ØªØ­ØµÙŠÙ„");
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
      if (msg.includes("exceeds remaining")) setError("Ø§Ù„Ù…Ø¨Ù„Øº Ø£ÙƒØ¨Ø± Ù…Ù† Ø§Ù„Ù…ØªØ¨Ù‚ÙŠ");
      else setError("ØªØ¹Ø°Ø± ØªØ³ÙˆÙŠØ© Ø§Ù„Ø¯ÙŠÙ†");
    } finally {
      setBusy(false);
    }
  }

  const filteredPlayers = useMemo(() => {
    const q = playerQuery.trim().toLowerCase();
    return players
      .filter((p) => {
        if (!q) return Number(p.debtBalance || 0) > 0;
        return (
          p.name.toLowerCase().includes(q) ||
          p.username.toLowerCase().includes(q) ||
          String(p.phone || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => Number(b.debtBalance || 0) - Number(a.debtBalance || 0));
  }, [players, playerQuery]);

  async function topUpPlayer(player: Player) {
    const raw = window.prompt(`Ù…Ø¨Ù„Øº Ø´Ø­Ù† Ù…Ø­ÙØ¸Ø© ${player.name} Ø¨Ø§Ù„Ø¯ÙŠÙ†Ø§Ø±:`);
    if (raw === null) return;
    const amount = Number(raw.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Ø£Ø¯Ø®Ù„ Ù…Ø¨Ù„Øº Ø´Ø­Ù† ØµØ­ÙŠØ­");
      return;
    }
    try {
      setBusy(true);
      setError("");
      const result = await api.topUpPlayer({ playerId: player.id, amount, note: "Ø´Ø­Ù† Ø§Ù„Ù…Ø­ÙØ¸Ø© Ù…Ù† ØµÙØ­Ø© Ø§Ù„Ø¯ÙŠÙˆÙ† ÙˆØ§Ù„Ù…Ø­Ø§ÙØ¸" });
      window.alert(`ØªÙ… Ø´Ø­Ù† Ø§Ù„Ù…Ø­ÙØ¸Ø©\nØ§Ù„Ù…Ø¨Ù„Øº: ${money(result.amount)}\nØ§Ù„Ø±ØµÙŠØ¯ Ø§Ù„Ø¬Ø¯ÙŠØ¯: ${money(result.walletBalance)}`);
      await load(true);
    } catch (e) {
      console.error(e);
      setError("ØªØ¹Ø°Ø± Ø´Ø­Ù† Ø§Ù„Ù…Ø­ÙØ¸Ø©");
    } finally {
      setBusy(false);
    }
  }

  async function correctPlayerWallet(player: Player) {
    const current = Math.max(0, Number(player.walletBalance || 0));
    const raw = window.prompt(`Ø§Ù„Ø±ØµÙŠØ¯ Ø§Ù„Ø­Ø§Ù„ÙŠ: ${money(current)}\n\nØ£Ø¯Ø®Ù„ Ø§Ù„Ø±ØµÙŠØ¯ Ø§Ù„ØµØ­ÙŠØ­:`, current.toFixed(2));
    if (raw === null) return;
    const newBalance = Number(raw.replace(",", "."));
    if (!Number.isFinite(newBalance) || newBalance < 0) {
      setError("Ø£Ø¯Ø®Ù„ Ø±ØµÙŠØ¯Ù‹Ø§ ØµØ­ÙŠØ­Ù‹Ø§");
      return;
    }
    const reason = window.prompt("Ø³Ø¨Ø¨ Ø§Ù„ØªØµØ­ÙŠØ­:", "ØªØµØ­ÙŠØ­ Ø±ØµÙŠØ¯ Ø§Ù„Ù…Ø­ÙØ¸Ø©") || "";
    if (!window.confirm(`ØªØ£ÙƒÙŠØ¯ ØªØµØ­ÙŠØ­ Ù…Ø­ÙØ¸Ø© ${player.name}ØŸ\nÙ…Ù† ${money(current)} Ø¥Ù„Ù‰ ${money(newBalance)}`)) return;
    try {
      setBusy(true);
      setError("");
      await api.setPlayerWalletBalance({ playerId: player.id, newBalance, reason });
      await load(true);
    } catch (e) {
      console.error(e);
      setError("ØªØ¹Ø°Ø± ØªØµØ­ÙŠØ­ Ø§Ù„Ù…Ø­ÙØ¸Ø©");
    } finally {
      setBusy(false);
    }
  }

  async function payPlayerDebt(player: Player, full = false) {
    const currentDebt = Math.max(0, Number(player.debtBalance || 0));
    if (currentDebt <= 0) {
      setError("Ù‡Ø°Ø§ Ø§Ù„Ù„Ø§Ø¹Ø¨ Ù„ÙŠØ³ Ø¹Ù„ÙŠÙ‡ Ø¯ÙŠÙ†");
      return;
    }
    let amount = currentDebt;
    if (!full) {
      const raw = window.prompt(`Ø§Ù„Ø¯ÙŠÙ† Ø§Ù„Ø­Ø§Ù„ÙŠ: ${money(currentDebt)}\n\nØ£Ø¯Ø®Ù„ Ø§Ù„Ù…Ø¨Ù„Øº Ø§Ù„Ø°ÙŠ Ø¯ÙØ¹Ù‡ Ø§Ù„Ù„Ø§Ø¹Ø¨:`);
      if (raw === null) return;
      amount = Number(raw.replace(",", "."));
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > currentDebt) {
      setError("Ù…Ø¨Ù„Øº Ø§Ù„ØªØ³Ø¯ÙŠØ¯ ØºÙŠØ± ØµØ­ÙŠØ­");
      return;
    }
    if (!window.confirm(`ØªØ£ÙƒÙŠØ¯ ØªØ­ØµÙŠÙ„ ${money(amount)} Ù…Ù† ${player.name}ØŸ\nØ§Ù„Ù…ØªØ¨Ù‚ÙŠ: ${money(currentDebt - amount)}`)) return;
    try {
      setBusy(true);
      setError("");
      await api.payPlayerDebt({ playerId: player.id, amount, note: full ? "ØªØ³Ø¯ÙŠØ¯ ÙƒØ§Ù…Ù„ Ù„Ø¯ÙŠÙ† Ø§Ù„Ù„Ø§Ø¹Ø¨" : "ØªØ³Ø¯ÙŠØ¯ Ø¬Ø²Ø¦ÙŠ Ù„Ø¯ÙŠÙ† Ø§Ù„Ù„Ø§Ø¹Ø¨" });
      await load(true);
    } catch (e) {
      console.error(e);
      setError("ØªØ¹Ø°Ø± ØªØ³Ø¯ÙŠØ¯ Ø¯ÙŠÙ† Ø§Ù„Ù„Ø§Ø¹Ø¨");
    } finally {
      setBusy(false);
    }
  }

  async function addManualDebt(event: FormEvent) {
    event.preventDefault();

    if (!canAddManual) {
      window.alert("Ø¥Ø¶Ø§ÙØ© Ø¯ÙŠÙ† ÙŠØ¯ÙˆÙŠ: Admin ÙÙ‚Ø·");
      window.location.hash = "#/staff";
      return;
    }

    try {
      setBusy(true);
      setError("");

      const amount = Number(addAmount || 0);
      if (!addName.trim()) {
        setError("Ø§Ø³Ù… Ø§Ù„Ø¶ÙŠÙ Ù…Ø·Ù„ÙˆØ¨");
        return;
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        setError("Ù…Ø¨Ù„Øº Ø§Ù„Ø¯ÙŠÙ† ØºÙŠØ± ØµØ­ÙŠØ­");
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
      if (msg.includes("FORBIDDEN")) setError("Ù‡Ø°Ù‡ Ø§Ù„Ø¹Ù…Ù„ÙŠØ© Admin ÙÙ‚Ø·");
      else setError("ØªØ¹Ø°Ø± Ø¥Ø¶Ø§ÙØ© Ø¯ÙŠÙ† ÙŠØ¯ÙˆÙŠ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div dir="rtl" className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-sm text-violet-300">Business</p>
          <h1 className="text-3xl font-semibold">Ø§Ù„Ø¯ÙŠÙˆÙ† ÙˆØ§Ù„Ù…Ø­Ø§ÙØ¸ / Finance</h1>
          <p className="mt-2 text-sm text-white/45">Ù…Ø­Ø§ÙØ¸ Ø§Ù„Ù„Ø§Ø¹Ø¨ÙŠÙ† + Ø¯ÙŠÙˆÙ† Ø§Ù„Ù„Ø§Ø¹Ø¨ÙŠÙ† + Ø¯ÙŠÙˆÙ† Ø§Ù„Ø¶ÙŠÙˆÙ</p>
        </div>

        <button
          type="button"
          onClick={() => void load(true)}
          className="flex h-11 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm"
        >
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
          ØªØ­Ø¯ÙŠØ«
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
                  placeholder="Ø¨Ø­Ø« Ø¨Ø§Ù„Ø§Ø³Ù… Ø£Ùˆ Ø§Ù„Ù‡Ø§ØªÙ..."
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select value={status} onChange={(e) => setStatus(e.target.value as any)} className={fieldClass}>
                  <option value="Open">Open (Ù…ÙØªÙˆØ­)</option>
                  <option value="Paid">Paid (Ù…Ø¯ÙÙˆØ¹)</option>
                  <option value="All">All (Ø§Ù„ÙƒÙ„)</option>
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
                ØªØ·Ø¨ÙŠÙ‚ Ø§Ù„ÙÙ„Ø§ØªØ±
              </button>
            </form>
          </div>

          <div className="p-5">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <div className="rounded-xl border border-white/[0.08] bg-[#090d18] p-4"><p className="text-xs text-white/35">Ø¯ÙŠÙˆÙ† Ø§Ù„Ø¶ÙŠÙˆÙ Ø§Ù„Ù…ÙØªÙˆØ­Ø©</p><p dir="ltr" className="mt-2 text-lg font-semibold text-amber-300">{money(totals.totalOpen)}</p></div>
              <div className="rounded-xl border border-white/[0.08] bg-[#090d18] p-4"><p className="text-xs text-white/35">Ø¯ÙŠÙˆÙ† Ø§Ù„Ù„Ø§Ø¹Ø¨ÙŠÙ†</p><p dir="ltr" className="mt-2 text-lg font-semibold text-rose-300">{money(totals.playerDebtOpen)}</p></div>
              <div className="rounded-xl border border-white/[0.08] bg-[#090d18] p-4"><p className="text-xs text-white/35">Ù…Ø­Ø§ÙØ¸ Ø§Ù„Ù„Ø§Ø¹Ø¨ÙŠÙ†</p><p dir="ltr" className="mt-2 text-lg font-semibold text-sky-300">{money(totals.playerWalletTotal)}</p></div>
              <div className="rounded-xl border border-white/[0.08] bg-[#090d18] p-4"><p className="text-xs text-white/35">Ù…Ø­ØµÙ„ Ù…Ù† Ø§Ù„Ø¶ÙŠÙˆÙ</p><p dir="ltr" className="mt-2 text-lg font-semibold text-emerald-300">{money(totals.totalCollected)}</p></div>
            </div>

            <div className="mt-4 rounded-xl border border-sky-400/15 bg-[#090d18] p-4">
              <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div><h2 className="font-semibold">Ù…Ø­Ø§ÙØ¸ ÙˆØ¯ÙŠÙˆÙ† Ø§Ù„Ù„Ø§Ø¹Ø¨ÙŠÙ†</h2><p className="mt-1 text-xs text-white/35">Ø¨Ø­Ø«ØŒ Ø´Ø­Ù† Ù…Ø­ÙØ¸Ø©ØŒ ØªØµØ­ÙŠØ­ Ø±ØµÙŠØ¯ØŒ ÙˆØªØ³Ø¯ÙŠØ¯ Ø§Ù„Ø¯ÙŠÙ† Ø¬Ø²Ø¦ÙŠÙ‹Ø§ Ø£Ùˆ ÙƒØ§Ù…Ù„Ù‹Ø§</p></div>
                <div className="flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-[#080b16] px-3 lg:w-80"><Search size={15} className="text-white/25" /><input value={playerQuery} onChange={(e) => setPlayerQuery(e.target.value)} placeholder="Ø¨Ø­Ø« Ø¹Ù† Ù„Ø§Ø¹Ø¨..." className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></div>
              </div>
              {filteredPlayers.length === 0 ? <div className="rounded-lg bg-white/[0.03] p-6 text-center text-sm text-white/35">Ù„Ø§ ÙŠÙˆØ¬Ø¯ Ù„Ø§Ø¹Ø¨ÙˆÙ† Ù…Ø·Ø§Ø¨Ù‚ÙˆÙ† Ø£Ùˆ Ù„Ø§ ØªÙˆØ¬Ø¯ Ø¯ÙŠÙˆÙ† Ù„Ø§Ø¹Ø¨ÙŠÙ† Ù…ÙØªÙˆØ­Ø©</div> : (
                <div className="grid gap-3 lg:grid-cols-2">{filteredPlayers.slice(0, 80).map((player) => <div key={player.id} className="rounded-lg border border-white/[0.08] bg-[#080b16] p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{player.name}</p><p className="mt-1 text-xs text-white/35">@{player.username} Â· {player.phone || "â€”"}</p></div><div className="text-left" dir="ltr"><p className="text-xs text-sky-300">Wallet {money(player.walletBalance)}</p><p className="text-xs font-semibold text-rose-300">Debt {money(player.debtBalance)}</p></div></div><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" disabled={busy} onClick={() => {
                            window.alert("زر شحن المحفظة يعمل");
                            void topUpPlayer(player);
                          }} className="h-9 rounded-lg bg-emerald-500/15 text-xs text-emerald-300 disabled:opacity-40">Ø´Ø­Ù† Ø§Ù„Ù…Ø­ÙØ¸Ø©</button><button type="button" disabled={busy} onClick={() => {
                            window.alert("زر تصحيح المحفظة يعمل");
                            void correctPlayerWallet(player);
                          }} className="h-9 rounded-lg bg-sky-500/15 text-xs text-sky-300 disabled:opacity-40">ØªØµØ­ÙŠØ­ Ø§Ù„Ù…Ø­ÙØ¸Ø©</button><button type="button" disabled={busy || Number(player.debtBalance || 0) <= 0} onClick={() => {
                            window.alert("زر التسديد الجزئي يعمل");
                            void payPlayerDebt(player, false);
                          }} className="h-9 rounded-lg bg-amber-500/15 text-xs text-amber-300 disabled:opacity-30">ØªØ³Ø¯ÙŠØ¯ Ø¬Ø²Ø¦ÙŠ</button><button type="button" disabled={busy || Number(player.debtBalance || 0) <= 0} onClick={() => {
                            window.alert("زر التسديد الكامل يعمل");
                            void payPlayerDebt(player, true);
                          }} className="h-9 rounded-lg bg-rose-500/15 text-xs text-rose-300 disabled:opacity-30">ØªØ³Ø¯ÙŠØ¯ ÙƒØ§Ù…Ù„</button></div></div>)}</div>
              )}
            </div>
            <h2 className="mt-6 mb-3 font-semibold">Ø¯ÙŠÙˆÙ† Ø§Ù„Ø¶ÙŠÙˆÙ</h2>

            <div className="mt-4 rounded-xl border border-white/[0.08] bg-[#090d18] overflow-hidden">
              {debts.length === 0 ? (
                <div className="p-8 text-center text-sm text-white/35">Ù„Ø§ ØªÙˆØ¬Ø¯ Ù†ØªØ§Ø¦Ø¬</div>
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
                            {d.phone || "â€”"} Â· {d.status} Â· {d.source}
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
                              ØªØ­ØµÙŠÙ„ / Collect
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
                                placeholder="Ù…Ù„Ø§Ø­Ø¸Ø© (Ø§Ø®ØªÙŠØ§Ø±ÙŠ)"
                              />

                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void settle(d)}
                                  className="flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 text-sm font-medium disabled:opacity-40"
                                >
                                  <CheckCircle2 size={16} />
                                  ØªØ£ÙƒÙŠØ¯
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setSettleId(null)}
                                  className="h-11 rounded-lg bg-white/[0.06] text-sm text-white/70"
                                >
                                  Ø¥Ù„ØºØ§Ø¡
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
                <h2 className="font-semibold">Ø¥Ø¶Ø§ÙØ© Ø¯ÙŠÙ† ÙŠØ¯ÙˆÙŠ</h2>
                <p className="mt-1 text-xs text-white/30">Admin ÙÙ‚Ø·</p>
              </div>

              <form onSubmit={addManualDebt} className="space-y-3 p-5">
                <input value={addName} onChange={(e) => setAddName(e.target.value)} className={fieldClass} placeholder="Ø§Ø³Ù… Ø§Ù„Ø¶ÙŠÙ" />
                <input dir="ltr" value={addPhone} onChange={(e) => setAddPhone(e.target.value)} className={fieldClass} placeholder="Phone (optional)" />
                <input value={addNotes} onChange={(e) => setAddNotes(e.target.value)} className={fieldClass} placeholder="Ù…Ù„Ø§Ø­Ø¸Ø§Øª Ø§Ù„Ù‡ÙˆÙŠØ© (Ø§Ø®ØªÙŠØ§Ø±ÙŠ)" />
                <input dir="ltr" value={addAmount} onChange={(e) => setAddAmount(e.target.value)} className={fieldClass} placeholder="Amount" />
                <input value={addNote} onChange={(e) => setAddNote(e.target.value)} className={fieldClass} placeholder="Note (optional)" />

                <button
                  type="submit"
                  disabled={busy}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-violet-600 text-sm font-medium disabled:opacity-40"
                >
                  <Plus size={16} />
                  Ø¥Ø¶Ø§ÙØ©
                </button>
              </form>
            </article>
          ) : (
            <article className="rounded-xl border border-amber-400/15 bg-[#0c101d]">
              <div className="p-5 text-sm text-amber-200">
                Ø¥Ø¶Ø§ÙØ© Ø¯ÙŠÙ† ÙŠØ¯ÙˆÙŠ Admin ÙÙ‚Ø·.
              </div>
            </article>
          )}
        </aside>
      </section>
    </div>
  );
}
