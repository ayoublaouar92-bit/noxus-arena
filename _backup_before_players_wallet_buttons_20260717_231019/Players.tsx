import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import {
  Camera,
  CircleDollarSign,
  Crown,
  PlusCircle,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";

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

export default function Players() {
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

  async function topUp(player: Player) {
    const raw = window.prompt(`مبلغ شحن محفظة ${player.name} بالدينار:`);
    if (!raw) return;
    const amount = Number(raw.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("أدخل مبلغًا صحيحًا");
      return;
    }
    try {
      setSaving(true);
      const result = await api.topUpPlayer({ playerId: player.id, amount });
      window.alert(
        `تم استلام ${result.amount} DA\nسداد الدين: ${result.debtPaid} DA\nإضافة للمحفظة: ${result.walletAdded} DA`,
      );
      await loadPlayers();
    } catch (actionError) {
      console.error(actionError);
      setError("تعذر شحن المحفظة");
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
    <div dir="rtl" className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-sm text-violet-300">Players & VIP</p>
          <h1 className="text-3xl font-semibold">اللاعبون ونظام VIP</h1>
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
        <article className="rounded-xl border border-white/[0.08] bg-[#0c101d] p-5">
          <Users className="text-violet-300" />
          <p className="mt-4 text-2xl font-semibold">{players.length}</p>
          <p className="text-xs text-white/35">إجمالي اللاعبين</p>
        </article>
        <article className="rounded-xl border border-amber-400/20 bg-amber-500/[0.06] p-5">
          <Crown className="text-amber-300" />
          <p className="mt-4 text-2xl font-semibold">{vipCount}</p>
          <p className="text-xs text-white/35">أعضاء VIP</p>
        </article>
        <article className="rounded-xl border border-white/[0.08] bg-[#0c101d] p-5">
          <Wallet className="text-emerald-300" />
          <p className="mt-4 text-2xl font-semibold">
            {totalWallet.toFixed(2)} DA
          </p>
          <p className="text-xs text-white/35">أموال المحافظ</p>
        </article>
        <article className="rounded-xl border border-white/[0.08] bg-[#0c101d] p-5">
          <CircleDollarSign className="text-rose-300" />
          <p className="mt-4 text-2xl font-semibold">
            {totalDebt.toFixed(2)} DA
          </p>
          <p className="text-xs text-white/35">إجمالي الديون</p>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <article className="rounded-xl border border-white/[0.08] bg-[#0c101d]">
          <div className="flex flex-col gap-4 border-b border-white/[0.08] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold">مجتمع اللاعبين</h2>
              <p className="mt-1 text-xs text-white/30">Player Community</p>
            </div>
            <div className="flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-[#080b16] px-3">
              <Search size={16} className="text-white/30" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="بحث"
                className="bg-transparent text-sm outline-none"
              />
            </div>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-2 2xl:grid-cols-3">
            {loading && <p className="text-white/35">جارٍ التحميل...</p>}
            {!loading &&
              filteredPlayers.map((player) => {
                const vip = vipMap.get(player.id);
                return (
                  <article
                    key={player.id}
                    className={`overflow-hidden rounded-xl border bg-[#090d18] ${vip?.isVip ? "border-amber-400/35" : "border-white/[0.08]"}`}
                  >
                    <div
                      className={`h-14 ${vip?.isVip ? "bg-gradient-to-l from-amber-500/25 to-violet-600/15" : "bg-gradient-to-l from-violet-600/20 to-cyan-500/10"}`}
                    />
                    <div className="px-4 pb-4">
                      <div className="-mt-7 mb-3 flex items-center justify-between">
                        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border-4 border-[#090d18] bg-violet-600 font-bold">
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
                        {vip?.isVip && (
                          <span className="flex items-center gap-1 rounded-lg bg-amber-500/15 px-2 py-1 text-xs font-semibold text-amber-300">
                            <Crown size={13} /> VIP
                          </span>
                        )}
                      </div>
                      <h3 className="truncate font-semibold">{player.name}</h3>
                      <p dir="ltr" className="mt-1 text-xs text-violet-300">
                        @{player.username}
                      </p>
                      <div className="my-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-emerald-500/[0.07] p-2">
                          <p className="text-white/35">المحفظة</p>
                          <p className="mt-1 text-emerald-300">
                            {Number(player.walletBalance).toFixed(2)} DA
                          </p>
                        </div>
                        <div className="rounded-lg bg-rose-500/[0.07] p-2">
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
                      <div className="mt-3 grid grid-cols-2 gap-2">
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
                placeholder="الاسم الكامل"
              />
              <input
                dir="ltr"
                className={fieldClass}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Username"
              />
              <input
                dir="ltr"
                className={fieldClass}
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Phone"
              />
              <input
                dir="ltr"
                type="number"
                min="0"
                step="0.01"
                className={fieldClass}
                value={initialDeposit}
                onChange={(event) => setInitialDeposit(event.target.value)}
                placeholder="الرصيد الأولي"
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
    </div>
  );
}
