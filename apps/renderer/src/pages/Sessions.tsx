import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  Clock3,
  CreditCard,
  ListOrdered,
  Monitor,
  Play,
  Plus,
  RefreshCw,
  Search,
  Square,
  ShoppingBag,
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
  image?: string | null;
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
  playerImage?: string | null;
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
  "h-11 w-full rounded-lg border border-white/10 bg-[#1C1C1C] px-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-amber-400/60";

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
  const [showWaitingPicker, setShowWaitingPicker] = useState(false);
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
  const [selectedDeviceCard, setSelectedDeviceCard] = useState<Device | null>(null);

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
      setError("Could not load sessions data / ØªØ¹Ø°Ø± ØªØ­Ù…ÙŠÙ„ Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø¬Ù„Ø³Ø§Øª");
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
      return setError("Select at least one player / Ø§Ø®ØªØ± Ù„Ø§Ø¹Ø¨Ù‹Ø§ ÙˆØ§Ø­Ø¯Ù‹Ø§ Ø¹Ù„Ù‰ Ø§Ù„Ø£Ù‚Ù„");
    if (!Number.isFinite(fixedPrice) || fixedPrice <= 0)
      return setError("Enter round price per player / Ø£Ø¯Ø®Ù„ Ø³Ø¹Ø± Ø§Ù„Ø¬ÙˆÙ„Ø© Ù„ÙƒÙ„ Ù„Ø§Ø¹Ø¨");
    try {
      setBusy(true);
      setError("");
      const result = await api.startRoundGroup({
        playerIds: selectedPlayers,
        fixedPrice,
        title: groupTitle.trim() || "CS Round",
      });
      window.alert(
        `Round started / Ø¨Ø¯Ø£Øª Ø§Ù„Ø¬ÙˆÙ„Ø©
Devices: ${result.started.length}
Waiting: ${result.queued.length}`,
      );
      setSelectedPlayers([]);
      setGroupSearch("");
      await loadData();
    } catch (actionError) {
      console.error(actionError);
      setError("Could not start group / ØªØ¹Ø°Ø± Ø¨Ø¯Ø¡ Ø§Ù„Ù…Ø¬Ù…ÙˆØ¹Ø©");
    } finally {
      setBusy(false);
    }
  }

  async function addWaiting(playerId: number) {
    try {
      setBusy(true);
      await api.addWaitingPlayer(playerId);
      setWaitingSearch("");
      setShowWaitingPicker(false);
      await loadData();
    } catch (actionError) {
      console.error(actionError);
      setError("Player is already waiting or has an active session / Ø§Ù„Ù„Ø§Ø¹Ø¨ Ù…ÙˆØ¬ÙˆØ¯ ÙÙŠ Ø§Ù„Ø§Ù†ØªØ¸Ø§Ø± Ø£Ùˆ Ù„Ø¯ÙŠÙ‡ Ø¬Ù„Ø³Ø© Ù†Ø´Ø·Ø©");
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
      setError("Could not remove player from waiting list / ØªØ¹Ø°Ø± Ø­Ø°Ù Ø§Ù„Ù„Ø§Ø¹Ø¨ Ù…Ù† Ø§Ù„Ø§Ù†ØªØ¸Ø§Ø±");
    } finally {
      setBusy(false);
    }
  }

  async function seatWaitingPlayers() {
    if (!waiting.length) return;
    if (!window.confirm(tr("Move waiting players to available devices in queue order? They will start timed sessions at each device's hourly price.", "Ù†Ù‚Ù„ Ù„Ø§Ø¹Ø¨ÙŠ Ø§Ù„Ø§Ù†ØªØ¸Ø§Ø± Ø¥Ù„Ù‰ Ø§Ù„Ø£Ø¬Ù‡Ø²Ø© Ø§Ù„Ù…ØªØ§Ø­Ø© Ø­Ø³Ø¨ Ø§Ù„ØªØ±ØªÙŠØ¨ØŸ Ø³ØªØ¨Ø¯Ø£ Ø¬Ù„Ø³Ø§Øª Ø¨Ø§Ù„ÙˆÙ‚Øª Ø­Ø³Ø¨ Ø³Ø¹Ø± ÙƒÙ„ Ø¬Ù‡Ø§Ø².", "Placer les joueurs en attente sur les appareils disponibles dans lâ€™ordre ?"))) return;
    try {
      setBusy(true);
      setError("");
      const result = await api.seatWaitingPlayers();
      window.alert(tr(`Started ${result.started} player(s). ${result.remaining} remain in waiting.`, `ØªÙ… ØªØ´ØºÙŠÙ„ ${result.started} Ù„Ø§Ø¹Ø¨. Ø¨Ù‚ÙŠ ${result.remaining} ÙÙŠ Ø§Ù„Ø§Ù†ØªØ¸Ø§Ø±.`, `${result.started} joueur(s) dÃ©marrÃ©(s). ${result.remaining} restent en attente.`));
      await loadData();
    } catch (actionError) {
      console.error(actionError);
      setError("Could not move waiting players to available devices / ØªØ¹Ø°Ø± Ù†Ù‚Ù„ Ù„Ø§Ø¹Ø¨ÙŠ Ø§Ù„Ø§Ù†ØªØ¸Ø§Ø± Ø¥Ù„Ù‰ Ø§Ù„Ø£Ø¬Ù‡Ø²Ø© Ø§Ù„Ù…ØªØ§Ø­Ø©");
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
    if (!window.confirm("Finish round and start next? / Ø¥Ù†Ù‡Ø§Ø¡ Ø§Ù„Ø¬ÙˆÙ„Ø© ÙˆØ¨Ø¯Ø¡ Ø§Ù„ØªØ§Ù„ÙŠØ©ØŸ"))
      return;
    try {
      setBusy(true);
      const result = await api.finishAndStartNextRound({
        groupId: endingGroup.id,
        winnerPlayerIds: winnerIds,
      });
      window.alert(
        `Round finished / Ø§Ù†ØªÙ‡Øª Ø§Ù„Ø¬ÙˆÙ„Ø©
Winners: ${result.winners}
From waiting: ${result.takenFromWaiting}
Started next: ${result.started.length}`,
      );
      setEndingGroup(null);
      setWinnerIds([]);
      await loadData();
    } catch (actionError) {
      console.error(actionError);
      setError("Could not start next round / ØªØ¹Ø°Ø± Ø¨Ø¯Ø¡ Ø§Ù„Ø¬ÙˆÙ„Ø© Ø§Ù„ØªØ§Ù„ÙŠØ©");
    } finally {
      setBusy(false);
    }
  }
  async function endOnly(group: RoundGroup) {
    if (!window.confirm("End round and release devices? / Ø¥Ù†Ù‡Ø§Ø¡ Ø§Ù„Ø¬ÙˆÙ„Ø© ÙˆØ¥Ø®Ù„Ø§Ø¡ Ø§Ù„Ø£Ø¬Ù‡Ø²Ø©ØŸ")) return;
    try {
      setBusy(true);
      await api.endRoundGroup(group.id);
      setEndingGroup(null);
      await loadData();
    } catch (actionError) {
      console.error(actionError);
      setError("Could not end round / ØªØ¹Ø°Ø± Ø¥Ù†Ù‡Ø§Ø¡ Ø§Ù„Ø¬ÙˆÙ„Ø©");
    } finally {
      setBusy(false);
    }
  }

  async function finishSession(
    session: Session,
    method: "cash" | "wallet" | "debt",
  ) {
    const isCash = method === "cash";
    const message = isCash
      ? tr(
          `Confirm cash payment for ${session.customerName}?\nAmount: ${price(session)} DA`,
          `ØªØ£ÙƒÙŠØ¯ Ø§Ù„Ø¯ÙØ¹ ÙƒØ§Ø´ Ù„Ù„Ø§Ø¹Ø¨ ${session.customerName}ØŸ\nØ§Ù„Ù…Ø¨Ù„Øº: ${price(session)} Ø¯Ø¬`,
          `Confirmer le paiement en espÃ¨ces pour ${session.customerName} ?\nMontant : ${price(session)} DA`,
        )
      : tr(
          `Confirm Debt for ${session.customerName}?\nAmount: ${price(session)} DA\nWallet credit will be used first; any remaining amount becomes debt.`,
          `ØªØ£ÙƒÙŠØ¯ Ø§Ù„Ø¯ÙŠÙ† Ù„Ù„Ø§Ø¹Ø¨ ${session.customerName}ØŸ\nØ§Ù„Ù…Ø¨Ù„Øº: ${price(session)} Ø¯Ø¬\nØ³ÙŠØªÙ… Ø§Ù„Ø®ØµÙ… Ù…Ù† Ø§Ù„Ù…Ø­ÙØ¸Ø© Ø£ÙˆÙ„Ø§Ù‹ØŒ Ø«Ù… ÙŠÙØ³Ø¬Ù„ Ø§Ù„Ø¨Ø§Ù‚ÙŠ ÙƒØ¯ÙŠÙ†.`,
          `Confirmer la dette pour ${session.customerName} ?\nMontant : ${price(session)} DA\nLe solde du portefeuille sera utilisÃ© avant la dette.`,
        );
    if (!window.confirm(message)) return;
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
      setError("Could not end session / ØªØ¹Ø°Ø± Ø¥Ù†Ù‡Ø§Ø¡ Ø§Ù„Ø¬Ù„Ø³Ø©");
    } finally {
      setBusy(false);
    }
  }

  async function startSingle(event: FormEvent) {
    event.preventDefault();
    if (!singleDevice) return setError("Select device / Ø§Ø®ØªØ± Ø§Ù„Ø¬Ù‡Ø§Ø²");
    if (singleCustomerType === "player" && !singlePlayer)
      return setError("Select player / Ø§Ø®ØªØ± Ø§Ù„Ù„Ø§Ø¹Ø¨");
    if (singleCustomerType === "guest" && !singleGuestName.trim())
      return setError("Enter guest name / Ø£Ø¯Ø®Ù„ Ø§Ø³Ù… Ø§Ù„Ø¶ÙŠÙ");

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
          return setError("Enter a valid price / Ø£Ø¯Ø®Ù„ Ø³Ø¹Ø±Ù‹Ø§ ØµØ­ÙŠØ­Ù‹Ø§");
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
      setSelectedDeviceCard(null);
      await loadData();
    } catch (actionError) {
      console.error(actionError);
      setError("Could not start session / ØªØ¹Ø°Ø± Ø¨Ø¯Ø¡ Ø§Ù„Ø¬Ù„Ø³Ø©");
    } finally {
      setBusy(false);
    }
  }

  function openSessionStore(session: Session) {
    const playerQuery = session.playerId ? `playerId=${session.playerId}&` : "";
    window.location.hash = `#/store?${playerQuery}sessionId=${session.id}&returnTo=sessions`;
  }

  const groupParticipants = endingGroup
    ? participants.filter((p) => p.groupId === endingGroup.id)
    : [];

  const sessionForDevice = (deviceId: number) =>
    sessions.find((session) => session.deviceId === deviceId);
  const pcs = devices.filter((device) => !/playstation|ps[0-9]/i.test(device.type));
  const playstations = devices.filter((device) => /playstation|ps[0-9]/i.test(device.type));
  const renderDeviceGroup = (title: string, groupDevices: Device[], accent: "cyan" | "violet") => (
    <section className="session-device-section">
      <h2 className={`session-device-heading ${accent}`}>
        <Monitor size={21} /> {title} ({groupDevices.length})
      </h2>
      <div className="session-device-grid">
        {groupDevices.map((device) => {
          const session = sessionForDevice(device.id);
          const busyDevice = device.status === "Busy" || Boolean(session);
          const maintenance = !busyDevice && device.status !== "Available";
          const statusText = busyDevice ? tr("In Use", "Ù…Ø´ØºÙˆÙ„", "UtilisÃ©") : maintenance ? tr("Maintenance", "ØµÙŠØ§Ù†Ø©", "Maintenance") : tr("Available", "Ù…ØªØ§Ø­", "Disponible");
          return (
            <div
              key={device.id}
              role={!busyDevice && !maintenance ? "button" : undefined}
              tabIndex={!busyDevice && !maintenance ? 0 : undefined}
              onClick={() => {
                if (!busyDevice && !maintenance) {
                  setSingleDevice(String(device.id));
                  setSelectedDeviceCard(device);
                }
              }}
              onKeyDown={(event) => {
                if (!busyDevice && !maintenance && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  setSingleDevice(String(device.id));
                  setSelectedDeviceCard(device);
                }
              }}
              className={`session-device-card ${busyDevice ? "busy" : maintenance ? "maintenance" : "available"}`}
            >
              <div className="session-device-card-top">
                <span className={`device-icon ${accent}`}><Monitor size={24} /></span>
                <span className={`device-status ${busyDevice ? "busy" : maintenance ? "maintenance" : "available"}`}><i /></span>
              </div>
              <div className="session-device-name">{device.name}</div>
              <div className="session-device-type">{device.type || tr("Gaming device", "Ø¬Ù‡Ø§Ø² Ø£Ù„Ø¹Ø§Ø¨", "Appareil gaming")}</div>
              {session ? (
                <div className="session-running-info">
                  <div className="session-user"><span className="session-avatar">{session.playerImage ? <img src={session.playerImage} alt="" /> : <UserRound size={18} />}</span><span>{session.customerName}</span></div>
                  <div className="session-running-footer"><span className="session-time"><Clock3 size={20}/>{String(Math.floor(minutes(session.startTime) / 60)).padStart(2, "0")}:{String(minutes(session.startTime) % 60).padStart(2, "0")}:00</span><span className="session-price">{price(session)} DA</span></div>
                  <button type="button" onClick={(event) => { event.stopPropagation(); openSessionStore(session); }} className="session-store-action"><ShoppingBag size={14}/>{tr("Store", "Ø§Ù„Ù…ØªØ¬Ø±", "Magasin")}</button>
                  {!session.roundGroupId && <div className="session-payments">
                    <button type="button" onClick={(event) => { event.stopPropagation(); void finishSession(session, "cash"); }} className="pay-action cash"><Banknote size={20}/>{tr("Cash", "ÙƒØ§Ø´", "EspÃ¨ces")}</button>
                    {session.playerId && <button type="button" onClick={(event) => { event.stopPropagation(); void finishSession(session, "wallet"); }} className="pay-action debt"><CreditCard size={20}/>{tr("Debt", "Ø¯ÙŠÙ†", "Dette")}</button>}
                    {!session.playerId && <button type="button" onClick={(event) => { event.stopPropagation(); void finishSession(session, "debt"); }} className="pay-action debt"><CreditCard size={20}/>{tr("Debt", "Ø¯ÙŠÙ†", "Dette")}</button>}
                  </div>}
                </div>
              ) : (
                <div className="session-card-empty">{maintenance ? tr("This device is unavailable", "Ù‡Ø°Ø§ Ø§Ù„Ø¬Ù‡Ø§Ø² ØºÙŠØ± Ù…ØªØ§Ø­", "Cet appareil est indisponible") : tr("Click to start a session", "Ø§Ø¶ØºØ· Ù„Ø¨Ø¯Ø¡ Ø¬Ù„Ø³Ø©", "Cliquer pour dÃ©marrer")}</div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );

  return (
    <div dir={dir} className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-sm text-amber-300">{tr("Session Control", "Ø§Ù„ØªØ­ÙƒÙ… ÙÙŠ Ø§Ù„Ø¬Ù„Ø³Ø§Øª", "ContrÃ´le des sessions")}</p>
          <h1 className="text-3xl font-semibold">{tr("Sessions & CS Rounds", "Ø§Ù„Ø¬Ù„Ø³Ø§Øª ÙˆØ¬ÙˆÙ„Ø§Øª CS", "Sessions et manches CS")}</h1>
          <p className="mt-2 text-sm text-white/45">
            {tr("Groups, winners, and waiting list", "Ø§Ù„Ù…Ø¬Ù…ÙˆØ¹Ø§Øª ÙˆØ§Ù„ÙØ§Ø¦Ø²ÙˆÙ† ÙˆÙ‚Ø§Ø¦Ù…Ø© Ø§Ù„Ø§Ù†ØªØ¸Ø§Ø±", "Groupes, gagnants et liste dâ€™attente")}
          </p>
        </div>
        <button
          onClick={() => void loadData(true)}
          className="flex h-11 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm"
        >
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} />{" "}
          {tr("Refresh", "ØªØ­Ø¯ÙŠØ«", "Actualiser")}
        </button>
      </section>
      {error && (
        <div className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-rose-200">
          {error}
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <article className="session-control-panel session-group-panel rounded-xl border border-amber-400/20 bg-[#202020]">
          <div className="border-b border-white/[0.08] p-5">
            <h2 className="flex items-center gap-2 font-semibold text-amber-200">
              <Users size={19} /> {tr("Start group round", "Ø¨Ø¯Ø¡ Ø¬ÙˆÙ„Ø© Ø¬Ù…Ø§Ø¹ÙŠØ©", "DÃ©marrer une manche de groupe")}
            </h2>
            <p className="mt-1 text-xs text-white/35">
              {tr("Search players and set price per player", "Ø§Ø¨Ø­Ø« Ø¹Ù† Ø§Ù„Ù„Ø§Ø¹Ø¨ÙŠÙ† ÙˆØ­Ø¯Ø¯ Ø§Ù„Ø³Ø¹Ø± Ù„ÙƒÙ„ Ù„Ø§Ø¹Ø¨", "Rechercher des joueurs et dÃ©finir le prix par joueur")}
            </p>
          </div>
          <div className="p-5">
            <div className="mb-3 flex h-11 items-center gap-2 rounded-lg border border-white/10 bg-[#1C1C1C] px-3">
              <Search size={17} className="text-white/30" />
              <input
                value={groupSearch}
                onChange={(e) => setGroupSearch(e.target.value)}
                placeholder={tr("Search player name or username", "Ø§Ø¨Ø­Ø« Ø¨Ø§Ø³Ù… Ø§Ù„Ù„Ø§Ø¹Ø¨ Ø£Ùˆ Ø§Ø³Ù… Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…", "Rechercher un joueur ou un identifiant")}
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
                  className={`rounded-lg border p-3 text-right ${selectedPlayers.includes(player.id) ? "border-amber-400/40 bg-amber-500/10" : "border-white/[0.08] bg-[#202020]"}`}
                >
                  <p className="flex items-center gap-2 truncate text-sm">{player.image ? <img src={player.image} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" /> : <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-amber-500/15 text-[10px] text-amber-200">{player.name.slice(0, 1)}</span>}{player.name}</p>
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
                placeholder={tr("Round title", "Ø§Ø³Ù… Ø§Ù„Ø¬ÙˆÙ„Ø©", "Nom de la manche")}
              />
              <input
                dir="ltr"
                type="number"
                min="0.01"
                step="0.01"
                className={fieldClass}
                value={groupPrice}
                onChange={(e) => setGroupPrice(e.target.value)}
                placeholder={tr("Price per player (DA)", "Ø³Ø¹Ø± ÙƒÙ„ Ù„Ø§Ø¹Ø¨ (Ø¯Ø¬)", "Prix par joueur (DA)")}
              />
            </div>
            <button
              disabled={busy || !selectedPlayers.length || !groupPrice}
              onClick={() => void startGroup()}
              className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-amber-500 font-semibold text-white disabled:bg-[#8d1830] disabled:text-white"
            >
              <Play size={17} /> {tr(`Start ${selectedPlayers.length} players`, `Ø¨Ø¯Ø¡ ${selectedPlayers.length} Ù„Ø§Ø¹Ø¨`, `DÃ©marrer ${selectedPlayers.length} joueurs`)}</button>
          </div>
        </article>

        <aside className="session-control-panel session-waiting-panel rounded-xl border border-amber-400/20 bg-[#202020]">
          <div className="border-b border-white/[0.08] p-5">
            <h2 className="flex items-center gap-2 font-semibold text-amber-200">
              <ListOrdered size={18} /> {tr(`Waiting list (${waiting.length})`, `Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ø§Ù†ØªØ¸Ø§Ø± (${waiting.length})`, `Liste dâ€™attente (${waiting.length})`)}
            </h2>
            <p className="mt-1 text-xs text-white/35">
              {tr("New players are added at the bottom", "ÙŠÙØ¶Ø§Ù Ø§Ù„Ù„Ø§Ø¹Ø¨ÙˆÙ† Ø§Ù„Ø¬Ø¯Ø¯ ÙÙŠ Ø£Ø³ÙÙ„ Ø§Ù„Ù‚Ø§Ø¦Ù…Ø©", "Les nouveaux joueurs sont ajoutÃ©s en bas")}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowWaitingPicker((open) => !open)}
                className="flex h-9 items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 text-xs font-semibold text-amber-200 hover:bg-amber-500/20"
              >
                <Plus size={15} /> {tr("Add player", "Ø¥Ø¶Ø§ÙØ© Ù„Ø§Ø¹Ø¨", "Ajouter un joueur")}
              </button>
              <button
                type="button"
                disabled={busy || waiting.length === 0}
                onClick={() => void seatWaitingPlayers()}
                className="flex h-9 items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Play size={14} /> {tr("Fill available devices", "Ù…Ù„Ø¡ Ø§Ù„Ø£Ø¬Ù‡Ø²Ø© Ø§Ù„Ù…ØªØ§Ø­Ø©", "Remplir les appareils disponibles")}
              </button>
            </div>
          </div>
          <div className="p-5">
            {showWaitingPicker && <div className="flex h-11 items-center gap-2 rounded-lg border border-white/10 bg-[#1C1C1C] px-3">
              <Search size={17} className="text-white/30" />
              <input
                value={waitingSearch}
                onChange={(e) => setWaitingSearch(e.target.value)}
                placeholder={tr("Search to add player", "Ø§Ø¨Ø­Ø« Ù„Ø¥Ø¶Ø§ÙØ© Ù„Ø§Ø¹Ø¨", "Rechercher pour ajouter un joueur")}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </div>}
            {showWaitingPicker && waitingResults.length > 0 && (
              <div className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-lg border border-white/10 bg-[#1C1C1C] p-2">
                {waitingResults.map((player) => (
                  <button
                    key={player.id}
                    onClick={() => void addWaiting(player.id)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-white/[0.05]"
                  >
                    <span>{player.name}</span>
                    <Plus size={15} className="text-amber-300" />
                  </button>
                ))}
              </div>
            )}
            {showWaitingPicker && waitingSearch.trim() && waitingResults.length === 0 && (
              <p className="mt-3 text-center text-xs text-white/35">{tr("No eligible player found", "Ù„Ø§ ÙŠÙˆØ¬Ø¯ Ù„Ø§Ø¹Ø¨ Ù…ØªØ§Ø­ Ù„Ù„Ø¥Ø¶Ø§ÙØ©", "Aucun joueur disponible")}</p>
            )}
            <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
              {waiting.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-3 text-sm"
                >
                  <span>
                    <b className="ml-2 text-amber-300">#{index + 1}</b>
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
                  {tr("Waiting list is empty", "Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ø§Ù†ØªØ¸Ø§Ø± ÙØ§Ø±ØºØ©", "La liste dâ€™attente est vide")}
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
                    {group.activeCount} {tr("active players", "Ù„Ø§Ø¹Ø¨ÙˆÙ† Ù†Ø´Ø·ÙˆÙ†", "joueurs actifs")}
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
                <Trophy size={16} /> {tr("Finish and choose winners", "Ø¥Ù†Ù‡Ø§Ø¡ ÙˆØ§Ø®ØªÙŠØ§Ø± Ø§Ù„ÙØ§Ø¦Ø²ÙŠÙ†", "Terminer et choisir les gagnants")}
              </button>
            </article>
          ))}
        </section>
      )}

      {endingGroup && (
        <section className="rounded-xl border border-amber-400/30 bg-[#202020] p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-amber-200">
                <Trophy size={19} /> {tr("Choose next-round players", "Ø§Ø®ØªØ± Ù„Ø§Ø¹Ø¨ÙŠ Ø§Ù„Ø¬ÙˆÙ„Ø© Ø§Ù„ØªØ§Ù„ÙŠØ©", "Choisir les joueurs du prochain tour")}
              </h2>
              <p className="mt-1 text-xs text-white/40">{tr("Remaining slots will be filled from the waiting list", "Ø³ÙŠØªÙ… Ù…Ù„Ø¡ Ø§Ù„Ø£Ù…Ø§ÙƒÙ† Ø§Ù„Ù…ØªØ¨Ù‚ÙŠØ© Ù…Ù† Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ø§Ù†ØªØ¸Ø§Ø±", "Les places restantes seront remplies depuis la liste dâ€™attente")}
              </p>
            </div>
            <button
              onClick={() => setEndingGroup(null)}
              className="text-white/40"
            >
              {tr("Close", "Ø¥ØºÙ„Ø§Ù‚", "Fermer")}
            </button>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {groupParticipants.map((player) => (
              <button
                key={player.playerId}
                onClick={() => toggleWinner(player.playerId)}
                className={`rounded-lg border p-3 text-right ${winnerIds.includes(player.playerId) ? "border-amber-400/50 bg-amber-500/15" : "border-white/10 bg-[#202020]"}`}
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
              {tr(`Start next round (${winnerIds.length} winners)`, `Ø¨Ø¯Ø¡ Ø§Ù„Ø¬ÙˆÙ„Ø© Ø§Ù„ØªØ§Ù„ÙŠØ© (${winnerIds.length} ÙØ§Ø¦Ø²ÙŠÙ†)`, `DÃ©marrer le tour suivant (${winnerIds.length} gagnants)`)}
            </button>
            <button
              disabled={busy}
              onClick={() => void endOnly(endingGroup)}
              className="h-11 rounded-lg bg-rose-500/15 text-rose-300 disabled:opacity-40"
            >
              {tr("End only & release devices", "Ø¥Ù†Ù‡Ø§Ø¡ ÙˆØ¥Ø®Ù„Ø§Ø¡ Ø§Ù„Ø£Ø¬Ù‡Ø²Ø©", "Terminer et libÃ©rer les appareils")}
            </button>
          </div>
        </section>
      )}

      <section className="sessions-board">
        <div className="sessions-board-head">
          <div>
            <p className="sessions-eyebrow">{tr("Single session", "Ø¬Ù„Ø³Ø© ÙØ±Ø¯ÙŠØ©", "Session individuelle")}</p>
            <h2>{tr("Choose a device", "Ø§Ø®ØªØ± Ø¬Ù‡Ø§Ø²Ù‹Ø§", "Choisir un appareil")}</h2>
            <p>{tr("All devices are visible. Select an available device to add a player or a guest.", "ÙƒÙ„ Ø§Ù„Ø£Ø¬Ù‡Ø²Ø© Ø¸Ø§Ù‡Ø±Ø©. Ø§Ø®ØªØ± Ø¬Ù‡Ø§Ø²Ù‹Ø§ Ù…ØªØ§Ø­Ù‹Ø§ Ù„Ø¥Ø¶Ø§ÙØ© Ù„Ø§Ø¹Ø¨ Ø£Ùˆ Ø¶ÙŠÙ.", "Tous les appareils sont visibles. SÃ©lectionnez un appareil disponible.")}</p>
          </div>
          <div className="sessions-legend"><span><i className="dot available" />{tr("Available", "Ù…ØªØ§Ø­", "Disponible")}</span><span><i className="dot busy" />{tr("In Use", "Ù…Ø´ØºÙˆÙ„", "UtilisÃ©")}</span><span><i className="dot maintenance" />{tr("Maintenance", "ØµÙŠØ§Ù†Ø©", "Maintenance")}</span></div>
        </div>
        {renderDeviceGroup(tr("PCs", "Ø£Ø¬Ù‡Ø²Ø© PC", "PCs"), pcs, "cyan")}
        {playstations.length > 0 && renderDeviceGroup(tr("PlayStations", "Ø£Ø¬Ù‡Ø²Ø© PlayStation", "PlayStations"), playstations, "violet")}
      </section>

      {selectedDeviceCard && (
        <div className="session-modal-backdrop" onMouseDown={() => setSelectedDeviceCard(null)}>
          <form onSubmit={startSingle} onMouseDown={(event) => event.stopPropagation()} className="session-start-modal">
            <div className="session-modal-head"><div><p>{tr("New session", "Ø¬Ù„Ø³Ø© Ø¬Ø¯ÙŠØ¯Ø©", "Nouvelle session")}</p><h2>{selectedDeviceCard.name}</h2><span>{selectedDeviceCard.type}</span></div><button type="button" onClick={() => setSelectedDeviceCard(null)}>Ã—</button></div>
            <div className="session-type-toggle"><button type="button" onClick={() => setSingleKind("timed")} className={singleKind === "timed" ? "selected" : ""}>{tr("Timed", "Ø¨Ø§Ù„ÙˆÙ‚Øª", "ChronomÃ©trÃ©e")}</button><button type="button" onClick={() => setSingleKind("round")} className={singleKind === "round" ? "selected round" : ""}>{tr("Fixed round", "Ø¬ÙˆÙ„Ø© Ø«Ø§Ø¨ØªØ©", "Manche fixe")}</button></div>
            <div className="session-type-toggle"><button type="button" onClick={() => setSingleCustomerType("player")} className={singleCustomerType === "player" ? "selected player" : ""}>{tr("Player", "Ù„Ø§Ø¹Ø¨", "Joueur")}</button><button type="button" onClick={() => setSingleCustomerType("guest")} className={singleCustomerType === "guest" ? "selected guest" : ""}>{tr("Guest", "Ø¶ÙŠÙ", "InvitÃ©")}</button></div>
            {singleCustomerType === "player" ? <select className={fieldClass} value={singlePlayer} onChange={(event) => setSinglePlayer(event.target.value)}><option value="">{tr("Select player", "Ø§Ø®ØªØ± Ø§Ù„Ù„Ø§Ø¹Ø¨", "SÃ©lectionner un joueur")}</option>{players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select> : <div className="session-guest-fields"><input className={fieldClass} value={singleGuestName} onChange={(event) => setSingleGuestName(event.target.value)} placeholder={tr("Guest name", "Ø§Ø³Ù… Ø§Ù„Ø¶ÙŠÙ", "Nom de lâ€™invitÃ©")} /><input dir="ltr" className={fieldClass} value={singleGuestPhone} onChange={(event) => setSingleGuestPhone(event.target.value)} placeholder={tr("Phone (optional)", "Ø§Ù„Ù‡Ø§ØªÙ Ø§Ø®ØªÙŠØ§Ø±ÙŠ", "TÃ©lÃ©phone (facultatif)")} /><input className={fieldClass} value={singleGuestNotes} onChange={(event) => setSingleGuestNotes(event.target.value)} placeholder={tr("Note (optional)", "Ù…Ù„Ø§Ø­Ø¸Ø© Ø§Ø®ØªÙŠØ§Ø±ÙŠØ©", "Note (facultative)")} /></div>}
            {singleKind === "round" && <input dir="ltr" type="number" min="0.01" step="0.01" className={fieldClass} value={singlePrice} onChange={(event) => setSinglePrice(event.target.value)} placeholder={tr("Price (DA)", "Ø§Ù„Ø³Ø¹Ø± (Ø¯Ø¬)", "Prix (DA)")} />}
            <button disabled={busy} className="session-start-button"><Play size={17} /> {tr("Start session", "Ø¨Ø¯Ø¡ Ø§Ù„Ø¬Ù„Ø³Ø©", "DÃ©marrer la session")}</button>
          </form>
        </div>
      )}
      <style>{`
        .sessions-board{background:#1C1C1C;border:1px solid #303030;border-radius:14px;padding:18px;color:#F4F7FA}.sessions-board-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:22px}.sessions-eyebrow{color:#ffd166;font-size:12px;font-weight:700;margin:0 0 4px;text-transform:uppercase;letter-spacing:.08em}.sessions-board h2{font-size:22px;font-weight:700;margin:0}.sessions-board-head p:not(.sessions-eyebrow){color:#9BA7B3;font-size:13px;margin:5px 0 0}.sessions-legend{display:flex;gap:12px;flex-wrap:wrap;color:#9BA7B3;font-size:12px}.sessions-legend span{display:flex;align-items:center;gap:5px}.dot{width:7px;height:7px;border-radius:50%;display:inline-block}.dot.available{background:#16D878}.dot.busy{background:#D80627}.dot.maintenance{background:#ffd166}.session-device-section+ .session-device-section{border-top:1px solid #282828;margin-top:18px;padding-top:18px}.session-device-heading{display:flex;gap:10px;align-items:center;font-size:16px;margin:0 0 13px}.session-device-heading.cyan{color:#ff174d}.session-device-heading.cyan svg{color:#ffd166}.session-device-heading.violet svg{color:#ffd166}.session-device-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(205px,1fr));gap:13px}.session-device-card{position:relative;min-height:177px;text-align:left;border:1px solid #3a3563;border-radius:10px;background:radial-gradient(circle at 50% 20%,rgba(125,69,225,.15),transparent 27%),linear-gradient(145deg,#141624,#0c0f1b);padding:14px;color:#F4F7FA;box-shadow:inset 0 0 22px rgba(47,33,118,.1);transition:.18s}.session-device-card.available{cursor:pointer}.session-device-card.available:hover{transform:translateY(-2px);border-color:#7e58d7;box-shadow:0 10px 22px rgba(67,37,160,.25)}.session-device-card:disabled{cursor:default}.session-device-card-top{height:58px;position:relative;display:flex;justify-content:flex-end}.device-icon{position:absolute;left:50%;top:0;transform:translateX(-50%);display:grid;place-items:center;width:52px;height:52px;border:1px solid #7e50d9;border-radius:15px;background:radial-gradient(circle at 50% 35%,rgba(149,85,255,.25),rgba(17,14,40,.86));color:#bb66ff;box-shadow:0 0 12px rgba(147,75,255,.26)}.device-icon svg{width:27px;height:27px;stroke-width:1.8}.device-icon.cyan,.device-icon.violet{color:#bb66ff;background:radial-gradient(circle at 50% 35%,rgba(149,85,255,.25),rgba(17,14,40,.86))}.device-status{display:grid;place-items:center;width:14px;height:14px;padding:0;border:0;background:transparent}.device-status i{display:block;width:10px;height:10px;border-radius:50%;background:currentColor}.device-status.available{color:#16D878}.device-status.available i{box-shadow:0 0 8px #16D878,0 0 15px rgba(22,216,120,.78)}.device-status.busy{color:#ff3b59}.device-status.busy i{box-shadow:0 0 8px #ff3b59,0 0 15px rgba(255,59,89,.78)}.device-status.maintenance{color:#f5c451}.device-status.maintenance i{box-shadow:0 0 8px #f5c451}.session-device-name{margin-top:0;font-weight:700;font-size:15px}.session-device-type{color:#9BA7B3;font-size:12px;margin-top:3px}.session-running-info{margin-top:18px}.session-user{display:flex;align-items:center;gap:9px;font-size:13px;font-weight:650}.session-avatar{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;overflow:hidden;border:1px solid #a85b43;background:linear-gradient(145deg,#b76246,#281618);color:#fff}.session-avatar img{width:100%;height:100%;object-fit:cover}.session-running-footer{display:flex;justify-content:space-between;align-items:center;border-top:1px solid #283044;margin-top:12px;padding-top:10px;font-size:13px}.session-time{display:flex;align-items:center;gap:5px}.session-time svg{color:#b456ff;width:14px;height:14px}.session-price{color:#16D878;font-weight:800;font-size:13px}.session-store-action{width:100%;height:31px;margin-top:10px;border:1px solid #b8831d;border-radius:7px;background:linear-gradient(100deg,rgba(75,46,10,.64),rgba(25,24,24,.9));color:#f5c451;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:6px;cursor:pointer}.session-store-action svg{width:14px;height:14px}.session-store-action:hover{background:#3a2c0c}.session-payments{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px}.pay-action{height:32px;border:1px solid;border-radius:7px;background:#111;display:flex;gap:5px;align-items:center;justify-content:center;font-size:11px;font-weight:800;cursor:pointer}.pay-action svg{width:14px;height:14px}.pay-action.cash{color:#16D878;border-color:#167a49;background:#08271d}.pay-action.debt{color:#ff3b59;border-color:#8d1830;background:#240d16}.session-card-empty{margin-top:40px;color:#9BA7B3;font-size:12px;text-align:center}.session-device-section+ .session-device-section{border-top:1px solid #303030;margin-top:18px;padding-top:18px}.session-modal-backdrop{position:fixed;inset:0;z-index:80;display:grid;place-items:center;background:rgba(0,0,0,.72);padding:16px}.session-start-modal{width:min(460px,100%);background:#181818;border:1px solid #333;border-radius:14px;padding:20px;box-shadow:0 20px 60px #000}.session-modal-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px}.session-modal-head p{margin:0;color:#ff174d;font-size:12px;font-weight:700}.session-modal-head h2{margin:3px 0;font-size:21px}.session-modal-head span{color:#9BA7B3;font-size:12px}.session-modal-head button{border:0;background:transparent;color:#9BA7B3;font-size:29px;line-height:1;cursor:pointer}.session-type-toggle{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0}.session-type-toggle button{height:39px;border:1px solid #313131;border-radius:8px;background:#1C1C1C;color:#9BA7B3;font-size:12px}.session-type-toggle button.selected{border-color:#ffd166;background:#102734;color:#ffd166}.session-type-toggle button.round{border-color:#ff174d;background:#102734;color:#ffd166}.session-type-toggle button.player{border-color:#ffd166;background:#102734;color:#ffd166}.session-type-toggle button.guest{border-color:#167a49;background:#10291d;color:#16D878}.session-guest-fields{display:grid;gap:10px}.session-start-modal input,.session-start-modal select{background:#1C1C1C!important;border-color:#303030!important}.session-start-button{width:100%;height:44px;margin-top:14px;border:0;border-radius:8px;background:#ffd166;color:#fff;font-weight:700;display:flex;gap:8px;align-items:center;justify-content:center}.session-start-button:disabled{opacity:.45}@media(max-width:640px){.sessions-board-head{display:block}.sessions-legend{margin-top:12px}.session-device-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.session-device-card{min-height:168px;padding:11px}}

        .session-control-panel{background:#1C1C1C!important;border-color:#303030!important;box-shadow:none}.session-control-panel>div:first-child{border-color:#303030!important}.session-control-panel .bg-[#1C1C1C],.session-control-panel .bg-[#202020]{background:#1C1C1C!important}.session-control-panel .border-white\/10{border-color:#343434!important}.session-group-panel h2{color:#ff174d!important}.session-group-panel .bg-amber-500{background:#ff174d!important}.session-group-panel .border-amber-400\/40{border-color:#ff174d!important;background:#092634!important}.session-waiting-panel h2{color:#ff174d!important}.session-waiting-panel .text-amber-300{color:#ff174d!important}.session-avatar{overflow:hidden}.session-avatar img{width:100%;height:100%;object-fit:cover}.session-running-footer span:last-child{color:#42e990;font-weight:700}

        .session-waiting-panel button[type="button"]:not(.pay-action){transition:.16s}.session-waiting-panel .bg-amber-500\/10{background:#092737!important}.session-waiting-panel .border-amber-400\/30{border-color:#ff174d!important}

        .session-payments{gap:8px!important;margin-top:14px!important}.pay-action{min-height:32px;padding:0 10px;border:1px solid #ff174d;border-radius:7px;background:#0b2633;color:#ff174d;font-size:12px!important;font-weight:700;cursor:pointer}.pay-action:hover{filter:brightness(1.16)}.pay-action.cash{border-color:#237b50;background:#0a281a;color:#66e6a5}.pay-action.debt{border-color:#873044;background:#2a0d14;color:#ff8298}.session-device-card.busy{cursor:default}
      `}</style>

    </div>
  );
}



