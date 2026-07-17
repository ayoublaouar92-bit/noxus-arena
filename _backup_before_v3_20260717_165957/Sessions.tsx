import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  Clock3,
  Gamepad2,
  ListOrdered,
  Monitor,
  Play,
  Plus,
  RefreshCw,
  Square,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";

type Device = {
  id: number;
  name: string;
  type: string;
  price: string;
  status: "Available" | "Busy";
};

type Player = {
  id: number;
  name: string;
  username: string;
  walletBalance: number;
  debtBalance: number;
};

type Session = {
  id: number;
  deviceId: number;
  playerId: number | null;
  customerName: string;
  startTime: string;
  deviceName: string;
  hourlyPrice: string;
  sessionType: "timed" | "round";
  fixedPrice: number;
  roundGroupId?: number | null;
};

type GuestDebt = {
  id: number;
  guestName: string;
  amount: number;
  paidAmount?: number;
};

type PriceOption = {
  id: number;
  name: string;
  price: number;
};

type RoundGroup = {
  id: number;
  title: string;
  fixedPrice: number;
  activeCount: number;
  waitingCount: number;
};

type QueueItem = {
  id: number;
  groupId: number;
  playerId: number;
  playerName: string;
  playerUsername: string;
  fixedPrice: number;
  groupTitle: string;
};

const fieldClass =
  "h-11 w-full rounded-lg border border-white/10 bg-[#080b16] px-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-violet-400/60";

export default function Sessions() {
  const api = (window as any).api;
  const [devices, setDevices] = useState<Device[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [guestDebts, setGuestDebts] = useState<GuestDebt[]>([]);
  const [priceOptions, setPriceOptions] = useState<PriceOption[]>([]);
  const [groups, setGroups] = useState<RoundGroup[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [endingId, setEndingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [, setTick] = useState(Date.now());

  const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);
  const [groupPriceOptionId, setGroupPriceOptionId] = useState("");
  const [groupTitle, setGroupTitle] = useState("CS Round");
  const [newPriceName, setNewPriceName] = useState("");
  const [newPriceValue, setNewPriceValue] = useState("");

  const [mode, setMode] = useState<"player" | "guest">("player");
  const [startKind, setStartKind] = useState<"timed" | "round">("timed");
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestNotes, setGuestNotes] = useState("");
  const [singleRoundPrice, setSingleRoundPrice] = useState("");

  async function loadData(showLoading = false) {
    try {
      if (showLoading) setLoading(true);
      setError("");
      const [
        deviceRows,
        playerRows,
        sessionRows,
        debtRows,
        optionRows,
        roundState,
      ] = await Promise.all([
        api.getDevices(),
        api.getPlayers(),
        api.getActiveSessions(),
        api.getGuestDebts(),
        api.getRoundPriceOptions(),
        api.getRoundState(),
      ]);
      setDevices(deviceRows);
      setPlayers(playerRows);
      setSessions(sessionRows);
      setGuestDebts(debtRows);
      setPriceOptions(optionRows);
      setGroups(roundState.groups || []);
      setQueue(roundState.queue || []);
    } catch (loadError) {
      console.error(loadError);
      setError("تعذر تحميل بيانات الجلسات");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData(true);
    const clock = window.setInterval(() => setTick(Date.now()), 1000);
    const refresh = window.setInterval(() => void loadData(), 5000);
    return () => {
      window.clearInterval(clock);
      window.clearInterval(refresh);
    };
  }, []);

  const availableDevices = useMemo(
    () => devices.filter((device) => device.status === "Available"),
    [devices],
  );

  function getMinutes(startTime: string) {
    return Math.max(
      1,
      Math.ceil((Date.now() - new Date(startTime).getTime()) / 60000),
    );
  }

  function getSessionPrice(session: Session) {
    if (session.sessionType === "round")
      return Number(session.fixedPrice || 0).toFixed(2);
    return (
      (getMinutes(session.startTime) / 60) *
      Number(session.hourlyPrice || 0)
    ).toFixed(2);
  }

  function toggleGroupPlayer(playerId: number) {
    setSelectedPlayers((current) =>
      current.includes(playerId)
        ? current.filter((id) => id !== playerId)
        : [...current, playerId],
    );
  }

  async function addPriceOption(event: FormEvent) {
    event.preventDefault();
    const price = Number(newPriceValue);
    if (!newPriceName.trim() || !Number.isFinite(price) || price <= 0) {
      setError("أدخل اسمًا وسعرًا صحيحًا للخيار");
      return;
    }
    try {
      setBusy(true);
      await api.addRoundPriceOption({ name: newPriceName.trim(), price });
      setNewPriceName("");
      setNewPriceValue("");
      await loadData();
    } catch (actionError) {
      console.error(actionError);
      setError("تعذرت إضافة خيار السعر");
    } finally {
      setBusy(false);
    }
  }

  async function deletePriceOption(optionId: number) {
    if (!window.confirm("حذف خيار السعر؟")) return;
    try {
      setBusy(true);
      await api.deleteRoundPriceOption(optionId);
      if (groupPriceOptionId === String(optionId)) setGroupPriceOptionId("");
      await loadData();
    } catch (actionError) {
      console.error(actionError);
      setError("تعذر حذف خيار السعر");
    } finally {
      setBusy(false);
    }
  }

  async function startGroup() {
    if (selectedPlayers.length === 0) {
      setError("اختر لاعبًا واحدًا على الأقل");
      return;
    }
    if (!groupPriceOptionId) {
      setError("اختر سعر الجولة");
      return;
    }
    try {
      setBusy(true);
      setError("");
      const result = await api.startRoundGroup({
        playerIds: selectedPlayers,
        priceOptionId: Number(groupPriceOptionId),
        title: groupTitle.trim() || "CS Round",
      });
      window.alert(
        `بدأت الجولة\nعلى الأجهزة: ${result.started.length}\nفي الانتظار: ${result.queued.length}`,
      );
      setSelectedPlayers([]);
      await loadData();
    } catch (actionError) {
      console.error(actionError);
      setError(
        "تعذر بدء المجموعة. قد يكون أحد اللاعبين مشغولًا أو في الانتظار.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function endGroup(group: RoundGroup) {
    const confirmed = window.confirm(
      `إنهاء ${group.title} وإخلاء أجهزتها؟\nسيتم الخصم من المحافظ وإضافة الباقي إلى الديون.`,
    );
    if (!confirmed) return;
    try {
      setBusy(true);
      const result = await api.endRoundGroup(group.id);
      window.alert(
        `تم إنهاء الجولة\nالجلسات: ${result.finishedSessions}\nمن المحافظ: ${Number(result.walletPaidTotal).toFixed(2)} DA\nإلى الديون: ${Number(result.debtAddedTotal).toFixed(2)} DA`,
      );
      await loadData();
    } catch (actionError) {
      console.error(actionError);
      setError("تعذر إنهاء المجموعة");
    } finally {
      setBusy(false);
    }
  }

  async function startSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDeviceId) return setError("اختر جهازًا");
    if (mode === "player" && !selectedPlayerId) return setError("اختر لاعبًا");
    if (mode === "guest" && !guestName.trim())
      return setError("أدخل اسم Guest");

    try {
      setBusy(true);
      const common = {
        deviceId: Number(selectedDeviceId),
        playerId: mode === "player" ? Number(selectedPlayerId) : null,
        customerName: mode === "guest" ? guestName.trim() : undefined,
        guestPhone: mode === "guest" ? guestPhone.trim() : undefined,
        guestNotes: mode === "guest" ? guestNotes.trim() : undefined,
      };
      if (startKind === "round") {
        const fixedPrice = Number(singleRoundPrice);
        if (!Number.isFinite(fixedPrice) || fixedPrice <= 0) {
          setError("أدخل سعر الجولة");
          return;
        }
        await api.startRoundSession({
          ...common,
          fixedPrice,
          roundTitle: "CS Round",
        });
      } else {
        await api.startSession(common);
      }
      setSelectedDeviceId("");
      setSelectedPlayerId("");
      setGuestName("");
      setGuestPhone("");
      setGuestNotes("");
      setSingleRoundPrice("");
      await loadData();
    } catch (actionError) {
      console.error(actionError);
      setError("تعذر بدء الجلسة");
    } finally {
      setBusy(false);
    }
  }

  async function finishSession(
    session: Session,
    method: "cash" | "wallet" | "debt" = "wallet",
  ) {
    try {
      setEndingId(session.id);
      const result = await api.endSession({
        sessionId: session.id,
        guestPaymentMethod: session.playerId ? undefined : method,
        playerPaymentMethod: session.playerId ? method : undefined,
      });
      window.alert(
        `الإجمالي: ${result.total} DA\nالمحفظة: ${result.walletPaid} DA\nالدين: ${result.debtAdded} DA\nنقدًا: ${result.cashPaid} DA`,
      );
      await loadData();
    } catch (actionError) {
      console.error(actionError);
      setError("تعذر إنهاء الجلسة");
    } finally {
      setEndingId(null);
    }
  }

  const openGuestDebt = guestDebts.reduce(
    (total, debt) =>
      total +
      Math.max(0, Number(debt.amount || 0) - Number(debt.paidAmount || 0)),
    0,
  );

  return (
    <div dir="rtl" className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-sm text-violet-300">Session Control</p>
          <h1 className="text-3xl font-semibold">الجلسات / Sessions</h1>
          <p className="mt-2 text-sm text-white/45">
            الجلسات العادية وجولات CS الجماعية
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadData(true)}
          className="flex h-11 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm"
        >
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} />{" "}
          تحديث
        </button>
      </section>

      {error && (
        <div className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-amber-400/20 bg-[#0c101d]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] p-5">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-amber-200">
              <Users size={19} /> جولة CS جماعية
            </h2>
            <p className="mt-1 text-xs text-white/35">
              توزيع تلقائي حسب ترتيب الأجهزة، والباقي يدخل قائمة الانتظار
            </p>
          </div>
          <span className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
            {availableDevices.length} جهاز متاح
          </span>
        </div>

        <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium">
                اختر اللاعبين ({selectedPlayers.length})
              </p>
              <button
                type="button"
                onClick={() =>
                  setSelectedPlayers(
                    selectedPlayers.length === players.length
                      ? []
                      : players.map((player) => player.id),
                  )
                }
                className="text-xs text-violet-300"
              >
                {selectedPlayers.length === players.length
                  ? "إلغاء الكل"
                  : "اختيار الكل"}
              </button>
            </div>
            <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
              {players.map((player) => {
                const selected = selectedPlayers.includes(player.id);
                return (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => toggleGroupPlayer(player.id)}
                    className={`rounded-lg border p-3 text-right transition ${
                      selected
                        ? "border-amber-400/40 bg-amber-500/10"
                        : "border-white/[0.08] bg-[#090d18]"
                    }`}
                  >
                    <p className="truncate text-sm font-medium">
                      {player.name}
                    </p>
                    <p
                      dir="ltr"
                      className="mt-1 truncate text-xs text-white/35"
                    >
                      @{player.username}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <input
              className={fieldClass}
              value={groupTitle}
              onChange={(event) => setGroupTitle(event.target.value)}
              placeholder="اسم الجولة"
            />
            <select
              className={fieldClass}
              value={groupPriceOptionId}
              onChange={(event) => setGroupPriceOptionId(event.target.value)}
            >
              <option value="">اختر سعر كل لاعب</option>
              {priceOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} — {Number(option.price).toFixed(2)} DA
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={
                busy || selectedPlayers.length === 0 || !groupPriceOptionId
              }
              onClick={() => void startGroup()}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-amber-500 font-semibold text-black disabled:opacity-40"
            >
              <Play size={17} /> بدء المجموعة وتوزيعها
            </button>
          </div>
        </div>

        <div className="grid gap-5 border-t border-white/[0.08] p-5 xl:grid-cols-2">
          <form
            onSubmit={addPriceOption}
            className="rounded-lg border border-white/[0.08] bg-[#090d18] p-4"
          >
            <p className="mb-3 text-sm font-medium">خيارات أسعار الجولات</p>
            <div className="grid gap-2 sm:grid-cols-[1fr_150px_44px]">
              <input
                className={fieldClass}
                value={newPriceName}
                onChange={(event) => setNewPriceName(event.target.value)}
                placeholder="مثال: جولة 200"
              />
              <input
                dir="ltr"
                type="number"
                min="0.01"
                step="0.01"
                className={fieldClass}
                value={newPriceValue}
                onChange={(event) => setNewPriceValue(event.target.value)}
                placeholder="DA"
              />
              <button
                type="submit"
                disabled={busy}
                className="flex h-11 items-center justify-center rounded-lg bg-violet-600 disabled:opacity-40"
              >
                <Plus size={18} />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {priceOptions.map((option) => (
                <span
                  key={option.id}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs"
                >
                  {option.name}: {Number(option.price).toFixed(2)} DA
                  <button
                    type="button"
                    onClick={() => void deletePriceOption(option.id)}
                    className="text-rose-300"
                  >
                    <Trash2 size={13} />
                  </button>
                </span>
              ))}
              {priceOptions.length === 0 && (
                <span className="text-xs text-white/35">أضف أول خيار سعر</span>
              )}
            </div>
          </form>

          <div className="rounded-lg border border-white/[0.08] bg-[#090d18] p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-medium">
              <ListOrdered size={16} /> قائمة الانتظار
            </p>
            <div className="max-h-40 space-y-2 overflow-y-auto">
              {queue.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2 text-xs"
                >
                  <span>
                    {index + 1}. {item.playerName}
                  </span>
                  <span className="text-amber-300">
                    {Number(item.fixedPrice).toFixed(2)} DA
                  </span>
                </div>
              ))}
              {queue.length === 0 && (
                <p className="text-xs text-white/35">
                  لا يوجد لاعبون في الانتظار
                </p>
              )}
            </div>
          </div>
        </div>

        {groups.length > 0 && (
          <div className="grid gap-3 border-t border-white/[0.08] p-5 md:grid-cols-2 xl:grid-cols-3">
            {groups.map((group) => (
              <article
                key={group.id}
                className="rounded-lg border border-amber-400/20 bg-amber-500/[0.06] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium">{group.title}</h3>
                    <p className="mt-1 text-xs text-white/40">
                      نشط: {group.activeCount} · انتظار: {group.waitingCount}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-amber-300">
                    {Number(group.fixedPrice).toFixed(2)} DA
                  </span>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void endGroup(group)}
                  className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-rose-500/15 text-xs font-medium text-rose-300 disabled:opacity-40"
                >
                  <Square size={15} /> إنهاء الجولة وإخلاء الأجهزة
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_370px]">
        <article className="rounded-xl border border-white/[0.08] bg-[#0c101d]">
          <div className="flex items-center justify-between border-b border-white/[0.08] p-5">
            <div>
              <h2 className="font-semibold">الجلسات النشطة</h2>
              <p className="mt-1 text-xs text-white/30">Live Sessions</p>
            </div>
            <span className="rounded-lg bg-violet-500/10 px-3 py-1 text-xs text-violet-300">
              {sessions.length} Live
            </span>
          </div>
          <div className="grid gap-4 p-5 lg:grid-cols-2">
            {loading && <p className="text-white/35">جارٍ التحميل...</p>}
            {!loading && sessions.length === 0 && (
              <p className="col-span-full py-16 text-center text-white/35">
                لا توجد جلسات نشطة
              </p>
            )}
            {sessions.map((session) => (
              <article
                key={session.id}
                className="rounded-xl border border-violet-400/15 bg-[#090d18] p-5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300">
                      <Monitor size={19} />
                    </div>
                    <div>
                      <h3 className="font-semibold">{session.deviceName}</h3>
                      <p className="mt-1 text-xs text-emerald-300">● Running</p>
                    </div>
                  </div>
                  <span className="text-xs text-white/35">
                    {session.roundGroupId
                      ? "CS GROUP"
                      : session.sessionType === "round"
                        ? "ROUND"
                        : "TIMED"}
                  </span>
                </div>
                <div className="my-4 h-px bg-white/[0.08]" />
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/35">اللاعب</span>
                    <span>{session.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/35">المدة</span>
                    <span className="text-sky-300">
                      {getMinutes(session.startTime)} min
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/35">السعر</span>
                    <span className="text-emerald-300">
                      {getSessionPrice(session)} DA
                    </span>
                  </div>
                </div>
                {session.roundGroupId ? (
                  <button
                    type="button"
                    disabled={endingId === session.id}
                    onClick={() => void finishSession(session, "wallet")}
                    className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-amber-500/15 text-xs text-amber-300 disabled:opacity-40"
                  >
                    <Square size={15} /> إنهاء والخصم من المحفظة
                  </button>
                ) : session.playerId ? (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => void finishSession(session, "cash")}
                      className="flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-500/15 text-xs text-emerald-300"
                    >
                      <Banknote size={15} /> نقدًا
                    </button>
                    <button
                      type="button"
                      onClick={() => void finishSession(session, "wallet")}
                      className="flex h-10 items-center justify-center gap-2 rounded-lg bg-violet-600 text-xs"
                    >
                      <Square size={15} /> المحفظة
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => void finishSession(session, "cash")}
                      className="flex h-10 items-center justify-center rounded-lg bg-emerald-500/15 text-xs text-emerald-300"
                    >
                      نقدًا
                    </button>
                    <button
                      type="button"
                      onClick={() => void finishSession(session, "debt")}
                      className="flex h-10 items-center justify-center gap-2 rounded-lg bg-rose-500/15 text-xs text-rose-300"
                    >
                      <AlertTriangle size={14} /> دين
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </article>

        <aside className="h-fit rounded-xl border border-violet-400/15 bg-[#0c101d]">
          <div className="border-b border-white/[0.08] p-5">
            <h2 className="font-semibold">جلسة فردية جديدة</h2>
            <p className="mt-1 text-xs text-white/30">Timed / Fixed Round</p>
          </div>
          <form onSubmit={startSession} className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStartKind("timed")}
                className={`h-10 rounded-lg text-xs ${startKind === "timed" ? "bg-violet-600" : "bg-white/[0.05] text-white/40"}`}
              >
                بالوقت
              </button>
              <button
                type="button"
                onClick={() => setStartKind("round")}
                className={`h-10 rounded-lg text-xs ${startKind === "round" ? "bg-amber-500/20 text-amber-300" : "bg-white/[0.05] text-white/40"}`}
              >
                سعر ثابت
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("player")}
                className={`flex h-10 items-center justify-center gap-2 rounded-lg text-xs ${mode === "player" ? "bg-violet-600" : "bg-white/[0.05] text-white/40"}`}
              >
                <UserRound size={15} /> لاعب
              </button>
              <button
                type="button"
                onClick={() => setMode("guest")}
                className={`flex h-10 items-center justify-center gap-2 rounded-lg text-xs ${mode === "guest" ? "bg-violet-600" : "bg-white/[0.05] text-white/40"}`}
              >
                <Gamepad2 size={15} /> Guest
              </button>
            </div>
            <select
              className={fieldClass}
              value={selectedDeviceId}
              onChange={(event) => setSelectedDeviceId(event.target.value)}
            >
              <option value="">اختر الجهاز</option>
              {availableDevices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name} — {device.price} DA/h
                </option>
              ))}
            </select>
            {mode === "player" ? (
              <select
                className={fieldClass}
                value={selectedPlayerId}
                onChange={(event) => setSelectedPlayerId(event.target.value)}
              >
                <option value="">اختر اللاعب</option>
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <input
                  className={fieldClass}
                  value={guestName}
                  onChange={(event) => setGuestName(event.target.value)}
                  placeholder="اسم Guest"
                />
                <input
                  dir="ltr"
                  className={fieldClass}
                  value={guestPhone}
                  onChange={(event) => setGuestPhone(event.target.value)}
                  placeholder="Phone"
                />
                <textarea
                  className="w-full resize-none rounded-lg border border-white/10 bg-[#080b16] p-3 text-sm outline-none"
                  rows={3}
                  value={guestNotes}
                  onChange={(event) => setGuestNotes(event.target.value)}
                  placeholder="ملاحظات"
                />
              </>
            )}
            {startKind === "round" && (
              <input
                dir="ltr"
                type="number"
                min="0.01"
                step="0.01"
                className={fieldClass}
                value={singleRoundPrice}
                onChange={(event) => setSingleRoundPrice(event.target.value)}
                placeholder="السعر الثابت DA"
              />
            )}
            <button
              type="submit"
              disabled={busy || !selectedDeviceId}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-violet-600 text-sm font-medium disabled:opacity-40"
            >
              <Play size={17} /> بدء الجلسة
            </button>
          </form>
          <div className="border-t border-white/[0.08] p-5 text-xs text-white/40">
            <div className="flex justify-between">
              <span>ديون Guest المفتوحة</span>
              <span className="text-rose-300">
                {openGuestDebt.toFixed(2)} DA
              </span>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
