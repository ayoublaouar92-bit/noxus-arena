import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Camera,
  CircleDollarSign,
  Crown,
  PlusCircle,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { handleUnauthorized } from "../lib/auth";
import { useLanguage } from "../lib/i18n";

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

type VipRow = {
  playerId: number;
  storeSpent: number;
  roundsPlayed: number;
  spendPoints: number;
  points: number;
  automaticVip: boolean;
  manualVip: boolean;
  isVip: boolean;
};

type VipSettings = {
  spendPerPoint: number;
  roundPoints: number;
  autoVipThreshold: number;
};

const fieldClass =
  "h-11 w-full rounded-lg border border-white/10 bg-[#080b16] px-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-violet-400/60";

function parseMoneyInput(input: string) {
  const digitMap: Record<string, string> = {
    "٠": "0",
    "١": "1",
    "٢": "2",
    "٣": "3",
    "٤": "4",
    "٥": "5",
    "٦": "6",
    "٧": "7",
    "٨": "8",
    "٩": "9",
    "۰": "0",
    "۱": "1",
    "۲": "2",
    "۳": "3",
    "۴": "4",
    "۵": "5",
    "۶": "6",
    "۷": "7",
    "۸": "8",
    "۹": "9",
  };
  const normalized = input
    .split("")
    .map((character) => digitMap[character] ?? character)
    .join("")
    .replace(/,/g, ".")
    .replace(/[^0-9.-]/g, "");
  return Number(normalized);
}

export default function Players() {
  const { dir, language } = useLanguage();
  const tr = (en: string, ar: string, fr: string) =>
    language === "ar" ? ar : language === "fr" ? fr : en;
  const api = (window as any).api;
  const [players, setPlayers] = useState<Player[]>([]);
  const [vipRows, setVipRows] = useState<VipRow[]>([]);
  const [vipSettings, setVipSettings] = useState<VipSettings>({
    spendPerPoint: 100,
    roundPoints: 10,
    autoVipThreshold: 100,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [topUpTarget, setTopUpTarget] = useState<Player | null>(null);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [editTarget, setEditTarget] = useState<Player | null>(null);
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editImage, setEditImage] = useState("");
  const [summaryView, setSummaryView] = useState<
    "all" | "vip" | "wallet" | "debt" | null
  >(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [initialDeposit, setInitialDeposit] = useState("");
  const [image, setImage] = useState("");
  const [settingsDraft, setSettingsDraft] = useState<VipSettings>(vipSettings);

  async function loadPlayers(showLoading = false) {
    try {
      if (showLoading) setLoading(true);
      setError("");
      const [playerRows, vipOverview] = await Promise.all([
        api.getPlayers(),
        api.getVipOverview(),
      ]);
      setPlayers(playerRows);
      setVipRows(vipOverview.players || []);
      setVipSettings(vipOverview.settings);
      setSettingsDraft(vipOverview.settings);
    } catch (loadError) {
      console.error(loadError);
      setError("تعذر تحميل اللاعبين وبيانات VIP");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPlayers(true);
  }, []);

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) {
      setError("اختر صورة صالحة لا تتجاوز 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  function chooseEditImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) {
      setError("اختر صورة صالحة لا تتجاوز 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setEditImage(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  function openEditPlayer(player: Player) {
    setError("");
    setEditTarget(player);
    setEditName(player.name);
    setEditUsername(player.username);
    setEditPhone(player.phone || "");
    setEditImage(player.image || "");
  }

  async function submitPlayerEdit(event: FormEvent) {
    event.preventDefault();
    if (!editTarget) return;
    if (!editName.trim() || !editUsername.trim()) {
      setError("الاسم واسم المستخدم مطلوبان");
      return;
    }
    try {
      setSaving(true);
      await api.updatePlayer({
        playerId: editTarget.id,
        name: editName.trim(),
        username: editUsername.trim().replace(/^@/, ""),
        phone: editPhone.trim(),
        image: editImage || null,
      });
      setEditTarget(null);
      await loadPlayers();
    } catch (actionError: any) {
      console.error(actionError);
      const message = String(actionError?.message || actionError || "");
      setError(
        message.includes("Username already exists")
          ? "اسم المستخدم مستخدم بالفعل"
          : "تعذر حفظ تعديلات اللاعب",
      );
    } finally {
      setSaving(false);
    }
  }

  async function addPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !username.trim()) {
      setError("الاسم واسم المستخدم مطلوبان");
      return;
    }
    try {
      setSaving(true);
      await api.addPlayer({
        name: name.trim(),
        username: username.trim().replace(/^@/, ""),
        phone: phone.trim(),
        initialDeposit: Number(initialDeposit || 0),
        image,
      });
      setName("");
      setUsername("");
      setPhone("");
      setInitialDeposit("");
      setImage("");
      await loadPlayers();
    } catch (saveError) {
      console.error(saveError);
      setError("تعذرت إضافة اللاعب أو اسم المستخدم موجود مسبقًا");
    } finally {
      setSaving(false);
    }
  }

  function topUp(player: Player) {
    setError("");
    setTopUpTarget(player);
    setTopUpAmount("");
  }

  async function submitTopUp(event: FormEvent) {
    event.preventDefault();
    if (!topUpTarget) return;
    const amount = parseMoneyInput(topUpAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("أدخل مبلغًا صحيحًا");
      return;
    }
    try {
      setSaving(true);
      await api.topUpPlayer({
        playerId: topUpTarget.id,
        amount,
        note: "شحن المحفظة من صفحة اللاعبين",
      });
      setTopUpTarget(null);
      setTopUpAmount("");
      window.alert(`تم شحن المحفظة بمبلغ ${amount.toFixed(2)} DA`);
      await loadPlayers();
    } catch (actionError: any) {
      console.error(actionError);
      if (handleUnauthorized(actionError)) return;
      const message = String(actionError?.message || actionError || "");
      setError(
        message.includes("SHIFT_REQUIRED")
          ? "يجب فتح وردية قبل شحن محفظة اللاعب"
          : "تعذر شحن المحفظة",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deletePlayer(player: Player) {
    if (!window.confirm(`هل تريد حذف ${player.name}؟`)) return;
    try {
      setSaving(true);
      await api.deletePlayer(player.id);
      await loadPlayers();
    } catch (actionError) {
      console.error(actionError);
      setError("لا يمكن حذف لاعب لديه سجل جلسات أو مبيعات");
    } finally {
      setSaving(false);
    }
  }

  async function toggleManualVip(player: Player, vip: VipRow | undefined) {
    try {
      setSaving(true);
      await api.setManualVip({ playerId: player.id, enabled: !vip?.manualVip });
      await loadPlayers();
    } catch (actionError) {
      console.error(actionError);
      setError("تعذر تعديل VIP اليدوي");
    } finally {
      setSaving(false);
    }
  }

  async function saveVipSettings(event: FormEvent) {
    event.preventDefault();
    const next = {
      spendPerPoint: Number(settingsDraft.spendPerPoint),
      roundPoints: Number(settingsDraft.roundPoints),
      autoVipThreshold: Number(settingsDraft.autoVipThreshold),
    };
    if (
      !Number.isFinite(next.spendPerPoint) ||
      next.spendPerPoint <= 0 ||
      !Number.isFinite(next.roundPoints) ||
      next.roundPoints < 0 ||
      !Number.isFinite(next.autoVipThreshold) ||
      next.autoVipThreshold < 0
    ) {
      setError("إعدادات VIP غير صحيحة");
      return;
    }
    try {
      setSaving(true);
      await api.updateVipSettings(next);
      await loadPlayers();
    } catch (actionError) {
      console.error(actionError);
      setError("تعذر حفظ إعدادات VIP");
    } finally {
      setSaving(false);
    }
  }

  const vipMap = useMemo(
    () => new Map(vipRows.map((row) => [row.playerId, row])),
    [vipRows],
  );

  const filteredPlayers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return players;
    return players.filter(
      (player) =>
        player.name.toLowerCase().includes(query) ||
        player.username.toLowerCase().includes(query) ||
        player.phone?.toLowerCase().includes(query),
    );
  }, [players, search]);

  const totalWallet = players.reduce(
    (total, player) => total + Number(player.walletBalance || 0),
    0,
  );
  const totalDebt = players.reduce(
    (total, player) => total + Number(player.debtBalance || 0),
    0,
  );
  const vipCount = vipRows.filter((row) => row.isVip).length;

  const summaryPlayers = useMemo(() => {
    if (summaryView === "vip") {
      const vipIds = new Set(
        vipRows.filter((row) => row.isVip).map((row) => row.playerId),
      );
      return players.filter((player) => vipIds.has(player.id));
    }
    if (summaryView === "wallet") {
      return players.filter((player) => Number(player.walletBalance || 0) > 0);
    }
    if (summaryView === "debt") {
      return players.filter((player) => Number(player.debtBalance || 0) > 0);
    }
    return players;
  }, [players, summaryView, vipRows]);

  const summaryTitle =
    summaryView === "vip"
      ? tr("VIP members", "أعضاء VIP", "Membres VIP")
      : summaryView === "wallet"
        ? "Wallet balances / أموال المحافظ"
        : summaryView === "debt"
          ? "Player debts / ديون اللاعبين"
          : tr("All players", "كل اللاعبين", "Tous les joueurs");

  function initials(value: string) {
    return value
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }

  return (
    <div dir={dir} className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-sm text-violet-300">
            {tr("Players & VIP", "اللاعبون وVIP", "Joueurs et VIP")}
          </p>
          <h1 className="text-3xl font-semibold">
            {tr("Players & VIP", "اللاعبون ونظام VIP", "Joueurs et VIP")}
          </h1>
          <p className="mt-2 text-sm text-white/45">
            VIP تلقائي حسب المشتريات والجولات، أو يدوي حتى تلغيه
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadPlayers(true)}
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <button
          type="button"
          onClick={() => setSummaryView("all")}
          className="rounded-xl border border-white/[0.08] bg-[#0c101d] p-5 text-right transition hover:border-violet-400/30 hover:bg-violet-500/[0.06]"
        >
          <Users className="text-violet-300" />
          <p className="mt-4 text-2xl font-semibold">{players.length}</p>
          <p className="text-xs text-white/35">
            {tr("Total players", "إجمالي اللاعبين", "Total des joueurs")}
          </p>
        </button>
        <button
          type="button"
          onClick={() => setSummaryView("vip")}
          className="rounded-xl border border-amber-400/20 bg-amber-500/[0.06] p-5 text-right transition hover:border-amber-300/50 hover:bg-amber-500/[0.1]"
        >
          <Crown className="text-amber-300" />
          <p className="mt-4 text-2xl font-semibold">{vipCount}</p>
          <p className="text-xs text-white/35">
            {tr("VIP members", "أعضاء VIP", "Membres VIP")}
          </p>
        </button>
        <button
          type="button"
          onClick={() => setSummaryView("wallet")}
          className="rounded-xl border border-white/[0.08] bg-[#0c101d] p-5 text-right transition hover:border-emerald-400/30 hover:bg-emerald-500/[0.06]"
        >
          <Wallet className="text-emerald-300" />
          <p className="mt-4 text-2xl font-semibold">
            {totalWallet.toFixed(2)} DA
          </p>
          <p className="text-xs text-white/35">
            {tr("Wallet funds", "أموال المحافظ", "Fonds des portefeuilles")}
          </p>
        </button>
        <button
          type="button"
          onClick={() => setSummaryView("debt")}
          className="rounded-xl border border-white/[0.08] bg-[#0c101d] p-5 text-right transition hover:border-rose-400/30 hover:bg-rose-500/[0.06]"
        >
          <CircleDollarSign className="text-rose-300" />
          <p className="mt-4 text-2xl font-semibold">
            {totalDebt.toFixed(2)} DA
          </p>
          <p className="text-xs text-white/35">
            {tr("Total debts", "إجمالي الديون", "Total des dettes")}
          </p>
        </button>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <article className="rounded-xl border border-white/[0.08] bg-[#0c101d]">
          <div className="flex flex-col gap-4 border-b border-white/[0.08] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold">
                {tr(
                  "Player community",
                  "مجتمع اللاعبين",
                  "Communauté des joueurs",
                )}
              </h2>
              <p className="mt-1 text-xs text-white/30">
                {tr(
                  "Player community",
                  "مجتمع اللاعبين",
                  "Communauté des joueurs",
                )}
              </p>
            </div>
            <div className="flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-[#080b16] px-3">
              <Search size={16} className="text-white/30" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={tr(
                  "Search players",
                  "ابحث عن لاعب",
                  "Rechercher des joueurs",
                )}
                className="bg-transparent text-sm outline-none"
              />
            </div>
          </div>
          <div className="player-card-grid grid gap-4 p-5 md:grid-cols-2 2xl:grid-cols-3">
            {loading && <p className="text-white/35">جارٍ التحميل...</p>}
            {!loading &&
              filteredPlayers.map((player) => {
                const vip = vipMap.get(player.id);
                return (
                  <article
                    key={player.id}
                    className={`player-card overflow-hidden rounded-xl border bg-[#090d18] ${vip?.isVip ? "vip" : "regular"}`}
                  >
                    <div
                      className="player-card-banner h-14"
                    />
                    <div className="player-card-body px-4 pb-4">
                      <div className="player-card-profile -mt-7 mb-3 flex items-center justify-between">
                        <div className="player-card-avatar flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border-4 border-[#090d18] bg-violet-600 font-bold">
                          {player.image ? (
                            <img
                              src={player.image}
                              alt={player.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            initials(player.name)
                          )}
                        </div>
                        <span className="player-status flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold">
                          {vip?.isVip ? <><Crown size={13} /> VIP</> : "REGULAR"}
                        </span>
                      </div>
                      <h3 className="truncate font-semibold">{player.name}</h3>
                      <p dir="ltr" className="mt-1 text-xs text-violet-300">
                        @{player.username}
                      </p>
                      <div className="my-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="player-wallet rounded-lg bg-emerald-500/[0.07] p-2">
                          <p className="text-white/35">المحفظة</p>
                          <p className="mt-1 text-emerald-300">
                            {Number(player.walletBalance).toFixed(2)} DA
                          </p>
                        </div>
                        <div className="player-debt rounded-lg bg-rose-500/[0.07] p-2">
                          <p className="text-white/35">الدين</p>
                          <p className="mt-1 text-rose-300">
                            {Number(player.debtBalance).toFixed(2)} DA
                          </p>
                        </div>
                      </div>
                      <div className="rounded-lg bg-white/[0.04] p-3 text-xs">
                        <div className="flex justify-between">
                          <span className="text-white/35">نقاط VIP</span>
                          <span className="text-amber-300">
                            {vip?.points || 0}
                          </span>
                        </div>
                        <div className="mt-2 flex justify-between">
                          <span className="text-white/35">المشتريات</span>
                          <span>
                            {Number(vip?.storeSpent || 0).toFixed(2)} DA
                          </span>
                        </div>
                        <div className="mt-2 flex justify-between">
                          <span className="text-white/35">الجولات</span>
                          <span>{vip?.roundsPlayed || 0}</span>
                        </div>
                      </div>
                      <div className="player-card-actions mt-3 grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => openEditPlayer(player)}
                          className="flex h-9 items-center justify-center gap-1 rounded-lg bg-violet-500/15 text-xs text-violet-200"
                        >
                          <Pencil size={14} /> تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => void topUp(player)}
                          className="flex h-9 items-center justify-center gap-1 rounded-lg bg-emerald-500/15 text-xs text-emerald-300"
                        >
                          <PlusCircle size={14} /> شحن
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleManualVip(player, vip)}
                          className={`flex h-9 items-center justify-center gap-1 rounded-lg text-xs ${vip?.manualVip ? "bg-rose-500/15 text-rose-300" : "bg-amber-500/15 text-amber-300"}`}
                        >
                          <Crown size={14} />{" "}
                          {vip?.manualVip ? "إلغاء VIP اليدوي" : "إضافة VIP"}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => void deletePlayer(player)}
                        className="mt-2 flex h-9 w-full items-center justify-center gap-1 rounded-lg bg-white/[0.04] text-xs text-white/35"
                      >
                        <Trash2 size={14} /> حذف اللاعب
                      </button>
                    </div>
                  </article>
                );
              })}
          </div>
        </article>

        <aside className="space-y-5">
          <form
            onSubmit={addPlayer}
            className="rounded-xl border border-violet-400/15 bg-[#0c101d] p-5"
          >
            <h2 className="mb-4 flex items-center gap-2 font-semibold">
              <UserPlus size={18} /> لاعب جديد
            </h2>
            <div className="space-y-3">
              <input
                className={fieldClass}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={tr("Full name", "الاسم الكامل", "Nom complet")}
              />
              <input
                dir="ltr"
                className={fieldClass}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder={tr(
                  "Username",
                  "اسم المستخدم",
                  "Nom d’utilisateur",
                )}
              />
              <input
                dir="ltr"
                className={fieldClass}
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder={tr("Phone", "الهاتف", "Téléphone")}
              />
              <input
                dir="ltr"
                type="number"
                min="0"
                step="0.01"
                className={fieldClass}
                value={initialDeposit}
                onChange={(event) => setInitialDeposit(event.target.value)}
                placeholder={tr(
                  "Opening balance",
                  "الرصيد الأولي",
                  "Solde initial",
                )}
              />
              <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-white/15 text-xs text-white/45">
                <Camera size={16} />{" "}
                {image ? "تم اختيار الصورة" : "صورة اختيارية"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={chooseImage}
                  className="hidden"
                />
              </label>
              <button
                type="submit"
                disabled={saving}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-violet-600 text-sm disabled:opacity-40"
              >
                <UserPlus size={17} /> إضافة اللاعب
              </button>
            </div>
          </form>

          <form
            onSubmit={saveVipSettings}
            className="rounded-xl border border-amber-400/20 bg-amber-500/[0.05] p-5"
          >
            <h2 className="flex items-center gap-2 font-semibold text-amber-200">
              <Crown size={18} /> إعدادات VIP
            </h2>
            <p className="mt-2 text-xs leading-5 text-white/40">
              الافتراضي: كل 100 دج من مشتريات المتجر = نقطة، وكل جولة = 10 نقاط.
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-xs text-white/45">
                دج لكل نقطة
                <input
                  dir="ltr"
                  type="number"
                  min="1"
                  className={`${fieldClass} mt-1`}
                  value={settingsDraft.spendPerPoint}
                  onChange={(event) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      spendPerPoint: Number(event.target.value),
                    })
                  }
                />
              </label>
              <label className="block text-xs text-white/45">
                نقاط كل جولة
                <input
                  dir="ltr"
                  type="number"
                  min="0"
                  className={`${fieldClass} mt-1`}
                  value={settingsDraft.roundPoints}
                  onChange={(event) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      roundPoints: Number(event.target.value),
                    })
                  }
                />
              </label>
              <label className="block text-xs text-white/45">
                نقاط الوصول إلى VIP
                <input
                  dir="ltr"
                  type="number"
                  min="0"
                  className={`${fieldClass} mt-1`}
                  value={settingsDraft.autoVipThreshold}
                  onChange={(event) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      autoVipThreshold: Number(event.target.value),
                    })
                  }
                />
              </label>
              <button
                type="submit"
                disabled={saving}
                className="h-11 w-full rounded-lg bg-amber-500 font-semibold text-black disabled:opacity-40"
              >
                حفظ إعدادات VIP
              </button>
            </div>
          </form>
        </aside>
      </section>

      {editTarget &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            onClick={() => !saving && setEditTarget(null)}
          >
            <form
              onSubmit={submitPlayerEdit}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-lg rounded-xl border border-violet-400/25 bg-[#0c101d] p-5 shadow-2xl"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <Pencil size={19} className="text-violet-300" /> تعديل
                    معلومات اللاعب
                  </h2>
                  <p className="mt-1 text-xs text-white/40">
                    يمكنك تعديل البيانات الشخصية فقط. الأرصدة والديون تبقى مسجلة
                    ماليًا.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setEditTarget(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06] text-white/55 hover:bg-white/[0.1]"
                  aria-label="إغلاق"
                >
                  <X size={17} />
                </button>
              </div>

              <div className="mt-5 space-y-3">
                <label className="block text-xs text-white/45">
                  الاسم الكامل
                  <input
                    autoFocus
                    className={`${fieldClass} mt-1`}
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                  />
                </label>
                <label className="block text-xs text-white/45">
                  اسم المستخدم
                  <input
                    dir="ltr"
                    className={`${fieldClass} mt-1`}
                    value={editUsername}
                    onChange={(event) => setEditUsername(event.target.value)}
                  />
                </label>
                <label className="block text-xs text-white/45">
                  رقم الهاتف
                  <input
                    dir="ltr"
                    className={`${fieldClass} mt-1`}
                    value={editPhone}
                    onChange={(event) => setEditPhone(event.target.value)}
                  />
                </label>
                <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-violet-500/20 text-xs font-semibold">
                      {editImage ? (
                        <img
                          src={editImage}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        initials(editName || editTarget.name)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-white/55">صورة اللاعب</p>
                      <p className="mt-1 text-[11px] text-white/30">
                        صورة اختيارية، بحد أقصى 2MB
                      </p>
                    </div>
                    <label className="cursor-pointer rounded-lg bg-white/[0.07] px-3 py-2 text-xs text-white/70 hover:bg-white/[0.12]">
                      تغيير الصورة
                      <input
                        type="file"
                        accept="image/*"
                        onChange={chooseEditImage}
                        className="hidden"
                      />
                    </label>
                    {editImage && (
                      <button
                        type="button"
                        onClick={() => setEditImage("")}
                        className="text-xs text-rose-300 hover:text-rose-200"
                      >
                        حذف
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setEditTarget(null)}
                  className="h-11 rounded-lg border border-white/10 bg-white/[0.04] text-sm disabled:opacity-40"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-11 rounded-lg bg-violet-600 text-sm font-medium disabled:opacity-40"
                >
                  {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
                </button>
              </div>
            </form>
          </div>,
          document.body,
        )}

      {topUpTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => !saving && setTopUpTarget(null)}
        >
          <form
            onSubmit={submitTopUp}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md rounded-xl border border-emerald-400/20 bg-[#0c101d] p-5 shadow-2xl"
          >
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Wallet size={19} className="text-emerald-300" /> شحن محفظة اللاعب
            </h2>
            <p className="mt-2 text-sm text-white/45">
              {topUpTarget.name} · الرصيد الحالي{" "}
              {Number(topUpTarget.walletBalance || 0).toFixed(2)} DA
            </p>
            <label className="mt-5 block text-xs text-white/45">
              مبلغ الشحن
              <input
                autoFocus
                dir="ltr"
                value={topUpAmount}
                onChange={(event) => setTopUpAmount(event.target.value)}
                className={`${fieldClass} mt-2`}
                placeholder="0.00"
              />
            </label>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => setTopUpTarget(null)}
                className="h-11 rounded-lg border border-white/10 bg-white/[0.04] text-sm disabled:opacity-40"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-11 rounded-lg bg-emerald-600 text-sm font-medium disabled:opacity-40"
              >
                {saving ? "جاري الشحن..." : "تأكيد الشحن"}
              </button>
            </div>
          </form>
        </div>
      )}

      {summaryView &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            onClick={() => setSummaryView(null)}
          >
            <div
              className="max-h-[82vh] w-full max-w-3xl overflow-hidden rounded-xl border border-white/10 bg-[#0c101d] shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 p-5">
                <div>
                  <h2 className="text-lg font-semibold">{summaryTitle}</h2>
                  <p className="mt-1 text-xs text-white/35">
                    {summaryPlayers.length} players
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSummaryView(null)}
                  className="rounded-lg bg-white/[0.06] px-3 py-2 text-sm text-white/70 hover:bg-white/[0.1]"
                >
                  Close
                </button>
              </div>
              <div className="max-h-[65vh] overflow-y-auto p-4">
                {summaryPlayers.length === 0 ? (
                  <div className="py-12 text-center text-sm text-white/35">
                    No players found
                  </div>
                ) : (
                  <div className="space-y-2">
                    {summaryPlayers.map((player) => {
                      const vip = vipMap.get(player.id);
                      return (
                        <div
                          key={player.id}
                          className="grid gap-3 rounded-lg border border-white/[0.07] bg-[#080b16] p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                              {player.name}
                            </p>
                            <p
                              dir="ltr"
                              className="mt-1 text-xs text-violet-300"
                            >
                              @{player.username}
                            </p>
                            {player.phone && (
                              <p
                                dir="ltr"
                                className="mt-1 text-xs text-white/30"
                              >
                                {player.phone}
                              </p>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs sm:w-56">
                            <div className="rounded-lg bg-emerald-500/[0.07] p-2">
                              <p className="text-white/35">
                                {tr("Wallet", "المحفظة", "Portefeuille")}
                              </p>
                              <p className="text-emerald-300">
                                {Number(player.walletBalance || 0).toFixed(2)}{" "}
                                DA
                              </p>
                            </div>
                            <div className="rounded-lg bg-rose-500/[0.07] p-2">
                              <p className="text-white/35">
                                {tr("Debt", "الدين", "Dette")}
                              </p>
                              <p className="text-rose-300">
                                {Number(player.debtBalance || 0).toFixed(2)} DA
                              </p>
                            </div>
                          </div>
                          <div className="text-left text-xs sm:w-32">
                            {vip?.isVip ? (
                              <span className="rounded-lg bg-amber-500/15 px-2 py-1 text-amber-300">
                                VIP
                              </span>
                            ) : (
                              <span className="text-white/25">
                                {tr("Regular", "عادي", "Normal")}
                              </span>
                            )}
                            <p className="mt-2 text-white/35">
                              Points: {vip?.points || 0}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}

      <style>{`
        .player-card-grid{grid-template-columns:repeat(auto-fill,minmax(250px,1fr))!important}
        .player-card{position:relative;min-height:500px!important;border:4px solid #ff174d!important;border-radius:13px!important;background:#09090b!important;color:#f4f7fa!important;box-shadow:none!important}
        .player-card.regular{border-color:#ff174d!important}.player-card.vip{border-color:#ffd166!important}.player-card-banner{display:none!important}.player-card-body{padding:14px!important}.player-card-profile{margin:0 0 12px!important;flex-direction:row-reverse!important;align-items:flex-start!important}.player-card-avatar{width:140px!important;height:140px!important;flex:none!important;border:1px solid #ff174d!important;border-radius:16px!important;background:#09090b!important;color:#ff174d!important}.player-card.vip .player-card-avatar{border-color:#ffd166!important;color:#ffd166!important}.player-status{margin-top:6px;border:1px solid #ff174d!important;background:transparent!important;color:#ff174d!important}.player-card.vip .player-status{border-color:#ffd166!important;color:#ffd166!important}.player-card h3{font-size:19px!important}.player-card .text-violet-300{color:#9ba7b3!important}.player-wallet,.player-debt{border:1px solid #303034!important;background:#151518!important}.player-wallet p:last-child{color:#16d878!important}.player-debt p:last-child{color:#ff174d!important}.player-card .bg-white\/\[0\.04\]{border:1px solid #303034!important;background:#151518!important}.player-card .text-amber-300{color:#ffd166!important}.player-card-actions{grid-template-columns:repeat(3,minmax(0,1fr))!important}.player-card-actions button{border:1px solid #343438!important;background:#17171a!important;color:#f4f7fa!important}.player-card-actions button:last-child{border-color:#ff174d!important;color:#ff174d!important}.player-card>div:last-child>button{border:1px solid #ff174d!important;background:#17171a!important;color:#ff174d!important}@media(max-width:640px){.player-card-grid{grid-template-columns:1fr!important}.player-card{min-height:auto!important}}
      `}</style>
    </div>
  );
}
