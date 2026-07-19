import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  ListOrdered,
  Monitor,
  Play,
  Plus,
  RefreshCw,
  Search,
  Square,
  Trash2,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";
import { useLanguage } from "../lib/i18n";

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
  guestPhone?: string | null;
  guestNotes?: string | null;
  startTime: string;
  deviceName: string;
  hourlyPrice: string;
  sessionType: "timed" | "round";
  fixedPrice: number;
  roundGroupId?: number | null;
};
type RoundGroup = {
  id: number;
  title: string;
  fixedPrice: number;
  activeCount: number;
};
type WaitingPlayer = {
  id: number;
  playerId: number;
  playerName: string;
  playerUsername: string;
  queueOrder: number;
};
type Participant = {
  groupId: number;
  playerId: number;
  playerName: string;
  playerUsername: string;
  deviceId: number;
  deviceName: string;
};

const fieldClass =
  "h-11 w-full rounded-lg border border-white/10 bg-[#080b16] px-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-violet-400/60";

export default function Sessions() {
  const { dir, language } = useLanguage();
  const tr = (en: string, ar: string, fr: string) =>
    language === "ar" ? ar : language === "fr" ? fr : en;
  const api = (window as any).api;
  const [devices, setDevices] = useState<Device[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [groups, setGroups] = useState<RoundGroup[]>([]);
  const [waiting, setWaiting] = useState<WaitingPlayer[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [, setTick] = useState(Date.now());

  const [groupSearch, setGroupSearch] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);
  const [groupPrice, setGroupPrice] = useState("");
  const [groupTitle, setGroupTitle] = useState("CS Round");

  const [waitingSearch, setWaitingSearch] = useState("");
  const [endingGroup, setEndingGroup] = useState<RoundGroup | null>(null);
  const [winnerIds, setWinnerIds] = useState<number[]>([]);

  const [singleDevice, setSingleDevice] = useState("");
  const [singlePlayer, setSinglePlayer] = useState("");
  const [singleCustomerType, setSingleCustomerType] = useState<"player" | "guest">("player");
  const [singleGuestName, setSingleGuestName] = useState("");
  const [singleGuestPhone, setSingleGuestPhone] = useState("");
  const [singleGuestNotes, setSingleGuestNotes] = useState("");
  const [singleKind, setSingleKind] = useState<"timed" | "round">("timed");
  const [singlePrice, setSinglePrice] = useState("");

  async function loadData(showLoading = false) {
    try {
      if (showLoading) setLoading(true);
      setError("");
      const [deviceRows, playerRows, sessionRows, roundState] =
        await Promise.all([
          api.getDevices(),
          api.getPlayers(),
          api.getActiveSessions(),
          api.getRoundState(),
        ]);
      setDevices(deviceRows);
      setPlayers(playerRows);
      setSessions(sessionRows);
      setGroups(roundState.groups || []);
      setWaiting(roundState.waitingList || []);
      setParticipants(roundState.participants || []);
    } catch (loadError) {
      console.error(loadError);
      setError("Could not load sessions data / تعذر تحميل بيانات الجلسات");
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
  const groupResults = useMemo(() => {
    const q = groupSearch.trim().toLowerCase();
    return q
      ? players.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.username.toLowerCase().includes(q),
        )
      : players;
  }, [players, groupSearch]);
  const waitingResults = useMemo(() => {
    const q = waitingSearch.trim().toLowerCase();
    if (!q) return [];
    const waitingIds = new Set(waiting.map((item) => item.playerId));
    return players
      .filter(
        (p) =>
          !waitingIds.has(p.id) &&
          (p.name.toLowerCase().includes(q) ||
            p.username.toLowerCase().includes(q)),
      )
      .slice(0, 12);
  }, [players, waiting, waitingSearch]);

  function minutes(start: string) {
    return Math.max(
      1,
      Math.ceil((Date.now() - new Date(start).getTime()) / 60000),
    );
  }
  function price(session: Session) {
    return session.sessionType === "round"
      ? Number(session.fixedPrice || 0).toFixed(2)
      : (
          (minutes(session.startTime) / 60) *
          Number(session.hourlyPrice || 0)
        ).toFixed(2);
  }
  function toggleSelected(id: number) {
    setSelectedPlayers((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  async function startGroup() {
    const fixedPrice = Number(groupPrice);
    if (!selectedPlayers.length)
      return setError("Select at least one player / اختر لاعبًا واحدًا على الأقل");
    if (!Number.isFinite(fixedPrice) || fixedPrice <= 0)
      return setError("Enter round price per player / أدخل سعر الجولة لكل لاعب");
    try {
      setBusy(true);
      setError("");
      const result = await api.startRoundGroup({
        playerIds: selectedPlayers,
        fixedPrice,
        title: groupTitle.trim() || "CS Round",
      });
      window.alert(
        `Round started / بدأت الجولة
Devices: ${result.started.length}
Waiting: ${result.queued.length}`,
      );
      setSelectedPlayers([]);
      setGroupSearch("");
      await loadData();
    } catch (actionError) {
      console.error(actionError);
      setError("Could not start group / تعذر بدء المجموعة");
    } finally {
      setBusy(false);
    }
  }

  async function addWaiting(playerId: number) {
    try {
      setBusy(true);
      await api.addWaitingPlayer(playerId);
      setWaitingSearch("");
      await loadData();
    } catch (actionError) {
      console.error(actionError);
      setError("Player is already waiting or has an active session / اللاعب موجود في الانتظار أو لديه جلسة نشطة");
    } finally {
      setBusy(false);
    }
  }
  async function removeWaiting(id: number) {
    try {
      setBusy(true);
      await api.removeWaitingPlayer(id);
      await loadData();
    } catch (actionError) {
      console.error(actionError);
      setError("Could not remove player from waiting list / تعذر حذف اللاعب من الانتظار");
    } finally {
      setBusy(false);
    }
  }

  function openWinners(group: RoundGroup) {
    setEndingGroup(group);
    setWinnerIds([]);
  }
  function toggleWinner(id: number) {
    setWinnerIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }
  async function finishAndNext() {
    if (!endingGroup) return;
    if (!window.confirm("Finish round and start next? / إنهاء الجولة وبدء التالية؟"))
      return;
    try {
      setBusy(true);
      const result = await api.finishAndStartNextRound({
        groupId: endingGroup.id,
        winnerPlayerIds: winnerIds,
      });
      window.alert(
        `Round finished / انتهت الجولة
Winners: ${result.winners}
From waiting: ${result.takenFromWaiting}
Started next: ${result.started.length}`,
      );
      setEndingGroup(null);
      setWinnerIds([]);
      await loadData();
    } catch (actionError) {
      console.error(actionError);
      setError("Could not start next round / تعذر بدء الجولة التالية");
    } finally {
      setBusy(false);
    }
  }
  async function endOnly(group: RoundGroup) {
    if (!window.confirm("End round and release devices? / إنهاء الجولة وإخلاء الأجهزة؟")) return;
    try {
      setBusy(true);
      await api.endRoundGroup(group.id);
      setEndingGroup(null);
      await loadData();
    } catch (actionError) {
      console.error(actionError);
      setError("Could not end round / تعذر إنهاء الجولة");
    } finally {
      setBusy(false);
    }
  }

  async function finishSession(
    session: Session,
    method: "cash" | "wallet" | "debt",
  ) {
    try {
      setBusy(true);
      await api.endSession({
        sessionId: session.id,
        guestPaymentMethod: session.playerId ? undefined : method,
        playerPaymentMethod: session.playerId ? method : undefined,
      });
      await loadData();
    } catch (actionError) {
      console.error(actionError);
      setError("Could not end session / تعذر إنهاء الجلسة");
    } finally {
      setBusy(false);
    }
  }

  async function startSingle(event: FormEvent) {
    event.preventDefault();
    if (!singleDevice) return setError("Select device / اختر الجهاز");
    if (singleCustomerType === "player" && !singlePlayer)
      return setError("Select player / اختر اللاعب");
    if (singleCustomerType === "guest" && !singleGuestName.trim())
      return setError("Enter guest name / أدخل اسم الضيف");

    try {
      setBusy(true);
      setError("");

      const commonData = {
        deviceId: Number(singleDevice),
        playerId: singleCustomerType === "player" ? Number(singlePlayer) : null,
        customerName:
          singleCustomerType === "guest" ? singleGuestName.trim() : undefined,
        guestPhone:
          singleCustomerType === "guest" ? singleGuestPhone.trim() : undefined,
        guestNotes:
          singleCustomerType === "guest" ? singleGuestNotes.trim() : undefined,
      };

      if (singleKind === "round") {
        const fixedPrice = Number(singlePrice);
        if (!Number.isFinite(fixedPrice) || fixedPrice <= 0)
          return setError("Enter a valid price / أدخل سعرًا صحيحًا");
        await api.startRoundSession({
          ...commonData,
          fixedPrice,
          roundTitle: "CS Round",
        });
      } else {
        await api.startSession(commonData);
      }

      setSingleDevice("");
      setSinglePlayer("");
      setSingleGuestName("");
      setSingleGuestPhone("");
      setSingleGuestNotes("");
      setSinglePrice("");
      await loadData();
    } catch (actionError) {
      console.error(actionError);
      setError("Could not start session / تعذر بدء الجلسة");
    } finally {
      setBusy(false);
    }
  }

  const groupParticipants = endingGroup
    ? participants.filter((p) => p.groupId === endingGroup.id)
    : [];

  return (
    <div dir={dir} className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-sm text-violet-300">{tr("Session Control", "التحكم في الجلسات", "Contrôle des sessions")}</p>
          <h1 className="text-3xl font-semibold">{tr("Sessions & CS Rounds", "الجلسات وجولات CS", "Sessions et manches CS")}</h1>
          <p className="mt-2 text-sm text-white/45">
            {tr("Groups, winners, and waiting list", "المجموعات والفائزون وقائمة الانتظار", "Groupes, gagnants et liste d’attente")}
          </p>
        </div>
        <button
          onClick={() => void loadData(true)}
          className="flex h-11 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm"
        >
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} />{" "}
          {tr("Refresh", "تحديث", "Actualiser")}
        </button>
      </section>
      {error && (
        <div className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-rose-200">
          {error}
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <article className="rounded-xl border border-amber-400/20 bg-[#0c101d]">
          <div className="border-b border-white/[0.08] p-5">
            <h2 className="flex items-center gap-2 font-semibold text-amber-200">
              <Users size={19} /> {tr("Start group round", "بدء جولة جماعية", "Démarrer une manche de groupe")}
            </h2>
            <p className="mt-1 text-xs text-white/35">
              {tr("Search players and set price per player", "ابحث عن اللاعبين وحدد السعر لكل لاعب", "Rechercher des joueurs et définir le prix par joueur")}
            </p>
          </div>
          <div className="p-5">
            <div className="mb-3 flex h-11 items-center gap-2 rounded-lg border border-white/10 bg-[#080b16] px-3">
              <Search size={17} className="text-white/30" />
              <input
                value={groupSearch}
                onChange={(e) => setGroupSearch(e.target.value)}
                placeholder={tr("Search player name or username", "ابحث باسم اللاعب أو اسم المستخدم", "Rechercher un joueur ou un identifiant")}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              <span className="text-xs text-white/30">
                {groupResults.length}
              </span>
            </div>
            <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
              {groupResults.map((player) => (
                <button
                  key={player.id}
                  onClick={() => toggleSelected(player.id)}
                  className={`rounded-lg border p-3 text-right ${selectedPlayers.includes(player.id) ? "border-amber-400/40 bg-amber-500/10" : "border-white/[0.08] bg-[#090d18]"}`}
                >
                  <p className="truncate text-sm">{player.name}</p>
                  <p dir="ltr" className="mt-1 truncate text-xs text-white/35">
                    @{player.username}
                  </p>
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input
                className={fieldClass}
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
                placeholder={tr("Round title", "اسم الجولة", "Nom de la manche")}
              />
              <input
                dir="ltr"
                type="number"
                min="0.01"
                step="0.01"
                className={fieldClass}
                value={groupPrice}
                onChange={(e) => setGroupPrice(e.target.value)}
                placeholder={tr("Price per player (DA)", "سعر كل لاعب (دج)", "Prix par joueur (DA)")}
              />
            </div>
            <button
              disabled={busy || !selectedPlayers.length || !groupPrice}
              onClick={() => void startGroup()}
              className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-amber-500 font-semibold text-black disabled:opacity-40"
            >
              <Play size={17} /> {tr(`Start ${selectedPlayers.length} players`, `بدء ${selectedPlayers.length} لاعب`, `Démarrer ${selectedPlayers.length} joueurs`)}</button>
          </div>
        </article>

        <aside className="rounded-xl border border-sky-400/20 bg-[#0c101d]">
          <div className="border-b border-white/[0.08] p-5">
            <h2 className="flex items-center gap-2 font-semibold text-sky-200">
              <ListOrdered size={18} /> {tr(`Waiting list (${waiting.length})`, `قائمة الانتظار (${waiting.length})`, `Liste d’attente (${waiting.length})`)}
            </h2>
            <p className="mt-1 text-xs text-white/35">
              {tr("New players are added at the bottom", "يُضاف اللاعبون الجدد في أسفل القائمة", "Les nouveaux joueurs sont ajoutés en bas")}
            </p>
          </div>
          <div className="p-5">
            <div className="flex h-11 items-center gap-2 rounded-lg border border-white/10 bg-[#080b16] px-3">
              <Search size={17} className="text-white/30" />
              <input
                value={waitingSearch}
                onChange={(e) => setWaitingSearch(e.target.value)}
                placeholder={tr("Search to add player", "ابحث لإضافة لاعب", "Rechercher pour ajouter un joueur")}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </div>
            {waitingResults.length > 0 && (
              <div className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-lg border border-white/10 bg-[#080b16] p-2">
                {waitingResults.map((player) => (
                  <button
                    key={player.id}
                    onClick={() => void addWaiting(player.id)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-white/[0.05]"
                  >
                    <span>{player.name}</span>
                    <Plus size={15} className="text-sky-300" />
                  </button>
                ))}
              </div>
            )}
            <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
              {waiting.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-3 text-sm"
                >
                  <span>
                    <b className="ml-2 text-sky-300">#{index + 1}</b>
                    {item.playerName}
                  </span>
                  <button
                    onClick={() => void removeWaiting(item.id)}
                    className="text-rose-300"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              {waiting.length === 0 && (
                <p className="py-8 text-center text-sm text-white/30">
                  {tr("Waiting list is empty", "قائمة الانتظار فارغة", "La liste d’attente est vide")}
                </p>
              )}
            </div>
          </div>
        </aside>
      </section>

      {groups.length > 0 && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => (
            <article
              key={group.id}
              className="rounded-xl border border-amber-400/20 bg-amber-500/[0.06] p-5"
            >
              <div className="flex justify-between">
                <div>
                  <h3 className="font-semibold">{group.title}</h3>
                  <p className="mt-1 text-xs text-white/40">
                    {group.activeCount} {tr("active players", "لاعبون نشطون", "joueurs actifs")}
                  </p>
                </div>
                <span className="text-amber-300">
                  {Number(group.fixedPrice).toFixed(2)} DA
                </span>
              </div>
              <button
                onClick={() => openWinners(group)}
                className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-amber-500/15 text-sm text-amber-300"
              >
                <Trophy size={16} /> {tr("Finish and choose winners", "إنهاء واختيار الفائزين", "Terminer et choisir les gagnants")}
              </button>
            </article>
          ))}
        </section>
      )}

      {endingGroup && (
        <section className="rounded-xl border border-amber-400/30 bg-[#0c101d] p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-amber-200">
                <Trophy size={19} /> {tr("Choose next-round players", "اختر لاعبي الجولة التالية", "Choisir les joueurs du prochain tour")}
              </h2>
              <p className="mt-1 text-xs text-white/40">{tr("Remaining slots will be filled from the waiting list", "سيتم ملء الأماكن المتبقية من قائمة الانتظار", "Les places restantes seront remplies depuis la liste d’attente")}
              </p>
            </div>
            <button
              onClick={() => setEndingGroup(null)}
              className="text-white/40"
            >
              {tr("Close", "إغلاق", "Fermer")}
            </button>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {groupParticipants.map((player) => (
              <button
                key={player.playerId}
                onClick={() => toggleWinner(player.playerId)}
                className={`rounded-lg border p-3 text-right ${winnerIds.includes(player.playerId) ? "border-amber-400/50 bg-amber-500/15" : "border-white/10 bg-[#090d18]"}`}
              >
                <p>{player.playerName}</p>
                <p className="mt-1 text-xs text-white/35">
                  {player.deviceName}
                </p>
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              disabled={busy}
              onClick={() => void finishAndNext()}
              className="h-11 rounded-lg bg-amber-500 font-semibold text-black disabled:opacity-40"
            >
              {tr(`Start next round (${winnerIds.length} winners)`, `بدء الجولة التالية (${winnerIds.length} فائزين)`, `Démarrer le tour suivant (${winnerIds.length} gagnants)`)}
            </button>
            <button
              disabled={busy}
              onClick={() => void endOnly(endingGroup)}
              className="h-11 rounded-lg bg-rose-500/15 text-rose-300 disabled:opacity-40"
            >
              {tr("End only & release devices", "إنهاء وإخلاء الأجهزة", "Terminer et libérer les appareils")}
            </button>
          </div>
        </section>
      )}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_350px]">
        <article className="rounded-xl border border-white/[0.08] bg-[#0c101d]">
          <div className="border-b border-white/[0.08] p-5">
            <h2 className="font-semibold">{tr("Active sessions", "الجلسات النشطة", "Sessions actives")}</h2>
          </div>
          <div className="grid gap-4 p-5 lg:grid-cols-2">
            {sessions.map((session) => (
              <article
                key={session.id}
                className="rounded-xl border border-violet-400/15 bg-[#090d18] p-4"
              >
                <div className="flex justify-between">
                  <div className="flex items-center gap-2">
                    <Monitor size={18} className="text-violet-300" />
                    <b>{session.deviceName}</b>
                  </div>
                  <span className="text-xs text-white/35">
                    {session.roundGroupId
                      ? "CS GROUP"
                      : session.sessionType.toUpperCase()}
                  </span>
                </div>
                <div className="my-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/35">{session.playerId ? tr("Player", "اللاعب", "Joueur") : tr("Guest", "ضيف", "Invité")}</span>
                    <span>{session.customerName}</span>
                  </div>
                  {!session.playerId && session.guestNotes && (
                    <div className="rounded-lg border border-amber-400/15 bg-amber-500/[0.06] p-2 text-xs text-amber-100">
                      <span className="text-amber-300">{tr("Payment note: ", "ملاحظة السداد: ", "Note de paiement : ")}</span>
                      {session.guestNotes}
                    </div>
                  )}
                  {!session.playerId && session.guestPhone && (
                    <div className="flex justify-between text-xs">
                      <span className="text-white/35">{tr("Phone", "الهاتف", "Téléphone")}</span>
                      <span dir="ltr">{session.guestPhone}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-white/35">{tr("Duration", "المدة", "Durée")}</span>
                    <span>{minutes(session.startTime)} min</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/35">{tr("Price", "السعر", "Prix")}</span>
                    <span className="text-emerald-300">
                      {price(session)} DA
                    </span>
                  </div>
                </div>
                {!session.roundGroupId &&
                  (session.playerId ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => void finishSession(session, "cash")}
                        className="h-9 rounded-lg bg-emerald-500/15 text-xs text-emerald-300"
                      >
                        <Banknote size={14} className="inline" /> {tr("Cash", "نقدًا", "Espèces")}
                      </button>
                      <button
                        onClick={() => void finishSession(session, "wallet")}
                        className="h-9 rounded-lg bg-violet-500/15 text-xs text-violet-300"
                      >
                        {tr("Wallet", "المحفظة", "Portefeuille")}
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => void finishSession(session, "cash")}
                        className="h-9 rounded-lg bg-emerald-500/15 text-xs text-emerald-300"
                      >
                        <Banknote size={14} className="inline" /> {tr("Cash", "كاش", "Espèces")}
                      </button>
                      <button
                        onClick={() => void finishSession(session, "debt")}
                        className="h-9 rounded-lg bg-rose-500/15 text-xs text-rose-300"
                      >
                        {tr("Debt", "دين", "Dette")}
                      </button>
                    </div>
                  ))}
              </article>
            ))}
            {!loading && !sessions.length && (
              <p className="col-span-full py-12 text-center text-white/30">
                {tr("No active sessions", "لا توجد جلسات", "Aucune session active")}
              </p>
            )}
          </div>
        </article>
        <form
          onSubmit={startSingle}
          className="h-fit rounded-xl border border-white/[0.08] bg-[#0c101d] p-5"
        >
          <h2 className="mb-4 flex items-center gap-2 font-semibold">
            <UserRound size={18} /> {tr("Single session", "جلسة فردية", "Session individuelle")}
          </h2>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSingleKind("timed")}
              className={`h-10 rounded-lg text-xs ${singleKind === "timed" ? "bg-violet-600" : "bg-white/[0.05]"}`}
            >
              {tr("Timed", "بالوقت", "Chronométrée")}
            </button>
            <button
              type="button"
              onClick={() => setSingleKind("round")}
              className={`h-10 rounded-lg text-xs ${singleKind === "round" ? "bg-amber-500/20 text-amber-300" : "bg-white/[0.05]"}`}
            >
              {tr("Fixed round", "جولة ثابتة", "Manche fixe")}
            </button>
          </div>
          <select
            className={fieldClass}
            value={singleDevice}
            onChange={(e) => setSingleDevice(e.target.value)}
          >
            <option value="">{tr("Select device", "اختر الجهاز", "Sélectionner un appareil")}</option>
            {availableDevices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSingleCustomerType("player")}
              className={`h-10 rounded-lg text-xs ${singleCustomerType === "player" ? "bg-cyan-500/20 text-cyan-300" : "bg-white/[0.05]"}`}
            >{tr("Player", "لاعب", "Joueur")}</button>
            <button
              type="button"
              onClick={() => setSingleCustomerType("guest")}
              className={`h-10 rounded-lg text-xs ${singleCustomerType === "guest" ? "bg-emerald-500/20 text-emerald-300" : "bg-white/[0.05]"}`}
            >
              {tr("Guest", "ضيف", "Invité")}
            </button>
          </div>

          {singleCustomerType === "player" ? (
            <select
              className={`${fieldClass} mt-3`}
              value={singlePlayer}
              onChange={(e) => setSinglePlayer(e.target.value)}
            >
              <option value="">{tr("Select player", "اختر اللاعب", "Sélectionner un joueur")}</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="mt-3 space-y-3">
              <input
                className={fieldClass}
                value={singleGuestName}
                onChange={(e) => setSingleGuestName(e.target.value)}
                placeholder={tr("Guest name", "اسم الضيف", "Nom de l’invité")}
              />
              <input
                dir="ltr"
                className={fieldClass}
                value={singleGuestPhone}
                onChange={(e) => setSingleGuestPhone(e.target.value)}
                placeholder={tr("Phone (optional)", "الهاتف اختياري", "Téléphone (facultatif)")}
              />
              <input
                className={fieldClass}
                value={singleGuestNotes}
                onChange={(e) => setSingleGuestNotes(e.target.value)}
                placeholder={tr("Note (optional)", "ملاحظة اختيارية", "Note (facultative)")}
              />
            </div>
          )}
          {singleKind === "round" && (
            <input
              dir="ltr"
              type="number"
              className={`${fieldClass} mt-3`}
              value={singlePrice}
              onChange={(e) => setSinglePrice(e.target.value)}
              placeholder="Price / السعر DA"
            />
          )}
          <button
            disabled={busy}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-violet-600 disabled:opacity-40"
          >
            <Play size={16} /> Start session / بدء الجلسة</button>
        </form>
      </section>
    </div>
  );
}
