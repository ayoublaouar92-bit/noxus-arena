import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CircleDot,
  Gamepad2,
  Monitor,
  Plus,
  RefreshCw,
  Search,
  Server,
  Wifi,
  WifiOff,
  Pencil,
  Trash2,
  X,
  Save,
} from "lucide-react";

type Device = {
  id: number;
  name: string;
  type: string;
  ip: string | null;
  mac: string | null;
  price: string;
  status: "Available" | "Busy";
};

type DeviceFilter = "All" | "Available" | "Busy";

const inputClass =
  "h-11 w-full rounded-lg border border-white/10 bg-[#080b16] px-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/10";

function normalizeMac(value: string) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/-/g, ":");
}

export default function Devices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<DeviceFilter>("All");

  // add form
  const [name, setName] = useState("");
  const [type, setType] = useState("PC");
  const [ip, setIp] = useState("");
  const [mac, setMac] = useState("");
  const [price, setPrice] = useState("");

  // edit modal
  const [editing, setEditing] = useState<Device | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("PC");
  const [editIp, setEditIp] = useState("");
  const [editMac, setEditMac] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editStatus, setEditStatus] = useState<"Available" | "Busy">("Available");

  const api = (window as any).api;

  async function loadDevices() {
    try {
      setError("");
      setLoading(true);

      const result = await api.getDevices();
      setDevices(result);
    } catch (loadError) {
      console.error(loadError);
      setError("تعذر تحميل الأجهزة / Failed to load devices");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDevices();
  }, []);

  async function addDevice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setError("أدخل اسم الجهاز / Device name is required");
      return;
    }

    if (!price || Number(price) < 0) {
      setError("أدخل سعرًا صحيحًا / Enter a valid price");
      return;
    }

    try {
      setSaving(true);
      setError("");

      await api.addDevice({
        name: name.trim(),
        type,
        ip: ip.trim(),
        mac: normalizeMac(mac),
        price: String(Number(price)),
      });

      setName("");
      setType("PC");
      setIp("");
      setMac("");
      setPrice("");

      await loadDevices();
    } catch (saveError: any) {
      console.error(saveError);
      const msg = String(saveError?.message || "");
      if (msg.includes("UNAUTHORIZED") || msg.includes("FORBIDDEN")) {
        setError("هذه العملية Admin فقط");
      } else {
        setError("تعذرت إضافة الجهاز / Failed to add device");
      }
    } finally {
      setSaving(false);
    }
  }

  function openEdit(device: Device) {
    setEditing(device);
    setEditName(device.name || "");
    setEditType(device.type || "PC");
    setEditIp(device.ip || "");
    setEditMac(device.mac || "");
    setEditPrice(String(device.price || "0"));
    setEditStatus(device.status || "Available");
  }

  function closeEdit() {
    setEditing(null);
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;

    if (!editName.trim()) {
      setError("اسم الجهاز مطلوب");
      return;
    }

    if (!editPrice || Number(editPrice) < 0) {
      setError("أدخل سعرًا صحيحًا");
      return;
    }

    try {
      setSaving(true);
      setError("");

      await api.updateDevice({
        deviceId: editing.id,
        name: editName.trim(),
        type: editType,
        ip: editIp.trim(),
        mac: normalizeMac(editMac),
        price: String(Number(editPrice)),
        status: editStatus,
      });

      closeEdit();
      await loadDevices();
    } catch (e: any) {
      console.error(e);
      const msg = String(e?.message || "");
      if (msg.includes("UNAUTHORIZED") || msg.includes("FORBIDDEN")) {
        setError("هذه العملية Admin فقط");
      } else if (msg.includes("active session")) {
        setError("لا يمكن تغيير الحالة لأن الجهاز لديه جلسة نشطة");
      } else {
        setError("تعذر حفظ التعديل");
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteDevice(device: Device) {
    const ok = window.confirm(`حذف الجهاز نهائيًا؟\n${device.name}`);
    if (!ok) return;

    try {
      setSaving(true);
      setError("");

      await api.deleteDevice(device.id);
      await loadDevices();
    } catch (e: any) {
      console.error(e);
      const msg = String(e?.message || "");
      if (msg.includes("UNAUTHORIZED") || msg.includes("FORBIDDEN")) {
        setError("هذه العملية Admin فقط");
      } else if (msg.includes("session history")) {
        setError("لا يمكن حذف جهاز لديه سجل جلسات");
      } else {
        setError("تعذر حذف الجهاز");
      }
    } finally {
      setSaving(false);
    }
  }

  const filteredDevices = useMemo(() => {
    const query = search.trim().toLowerCase();

    return devices.filter((device) => {
      const matchesFilter = filter === "All" || device.status === filter;

      const matchesSearch =
        !query ||
        device.name.toLowerCase().includes(query) ||
        device.type.toLowerCase().includes(query) ||
        device.ip?.toLowerCase().includes(query) ||
        device.mac?.toLowerCase().includes(query);

      return matchesFilter && matchesSearch;
    });
  }, [devices, filter, search]);

  const availableCount = devices.filter((device) => device.status === "Available").length;
  const busyCount = devices.filter((device) => device.status === "Busy").length;

  const usageRate =
    devices.length === 0 ? 0 : Math.round((busyCount / devices.length) * 100);

  const stats = [
    {
      label: "كل الأجهزة",
      english: "Total Devices",
      value: devices.length,
      icon: Server,
      color: "text-violet-300",
      surface: "bg-violet-500/10",
    },
    {
      label: "متاحة",
      english: "Available",
      value: availableCount,
      icon: Wifi,
      color: "text-emerald-300",
      surface: "bg-emerald-500/10",
    },
    {
      label: "مشغولة",
      english: "In Use",
      value: busyCount,
      icon: Gamepad2,
      color: "text-rose-300",
      surface: "bg-rose-500/10",
    },
    {
      label: "نسبة الاستخدام",
      english: "Usage Rate",
      value: `${usageRate}%`,
      icon: CircleDot,
      color: "text-sky-300",
      surface: "bg-sky-500/10",
    },
  ];

  return (
    <div dir="rtl" className="space-y-6">
      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm text-violet-300">
            <Monitor size={16} />
            Arena Control
          </div>

          <h1 className="text-3xl font-semibold tracking-tight">
            الأجهزة
            <span dir="ltr" className="mr-3 text-lg font-normal text-white/35">
              / Devices
            </span>
          </h1>

          <p className="mt-2 text-sm text-white/45">
            إدارة أجهزة القاعة، الأسعار وحالة الاتصال
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadDevices()}
          disabled={loading}
          className="flex h-11 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 text-sm text-white/70 transition hover:border-violet-400/30 hover:bg-violet-500/10 hover:text-white disabled:opacity-50"
        >
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
          تحديث / Refresh
        </button>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <article
              key={stat.english}
              className="rounded-xl border border-white/[0.08] bg-[#0c101d] p-5"
            >
              <div className="flex items-start justify-between">
                <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${stat.surface}`}>
                  <Icon size={21} className={stat.color} />
                </div>
                <span className="text-2xl font-semibold">{stat.value}</span>
              </div>

              <p className="mt-5 text-sm font-medium">{stat.label}</p>
              <p dir="ltr" className="mt-1 text-xs text-white/35">
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

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 rounded-xl border border-white/[0.08] bg-[#0c101d]">
          <div className="border-b border-white/[0.08] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-semibold">قائمة الأجهزة</h2>
                <p dir="ltr" className="mt-1 text-xs text-white/35">
                  Device Collection
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex h-10 min-w-64 items-center gap-2 rounded-lg border border-white/10 bg-[#080b16] px-3">
                  <Search size={17} className="shrink-0 text-white/30" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="بحث / Search devices"
                    className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/25"
                  />
                </div>

                <select
                  value={filter}
                  onChange={(event) => setFilter(event.target.value as DeviceFilter)}
                  className="h-10 rounded-lg border border-white/10 bg-[#080b16] px-3 text-sm text-white outline-none"
                >
                  <option value="All">الكل / All</option>
                  <option value="Available">متاح / Available</option>
                  <option value="Busy">مشغول / Busy</option>
                </select>
              </div>
            </div>
          </div>

          <div className="p-5">
            {loading ? (
              <div className="flex min-h-72 items-center justify-center text-sm text-white/40">
                جارٍ تحميل الأجهزة...
              </div>
            ) : filteredDevices.length === 0 ? (
              <div className="flex min-h-72 flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300">
                  <Monitor size={27} />
                </div>

                <p className="font-medium">لا توجد أجهزة</p>

                <p dir="ltr" className="mt-2 text-sm text-white/35">
                  No devices match the current filters
                </p>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {filteredDevices.map((device) => {
                  const available = device.status === "Available";

                  return (
                    <article
                      key={device.id}
                      className="group rounded-xl border border-white/[0.08] bg-[#090d18] p-4 transition hover:-translate-y-0.5 hover:border-violet-400/30"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300">
                            {device.type === "PC" ? <Monitor size={21} /> : <Gamepad2 size={21} />}
                          </div>

                          <div className="min-w-0">
                            <h3 dir="ltr" className="truncate font-semibold">
                              {device.name}
                            </h3>
                            <p dir="ltr" className="mt-1 text-xs text-white/35">
                              {device.type}
                            </p>
                          </div>
                        </div>

                        <span
                          className={
                            available
                              ? "flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300"
                              : "flex items-center gap-1.5 rounded-md bg-rose-500/10 px-2 py-1 text-xs text-rose-300"
                          }
                        >
                          {available ? <Wifi size={13} /> : <WifiOff size={13} />}
                          {available ? "متاح" : "مشغول"}
                        </span>
                      </div>

                      <div className="my-4 h-px bg-white/[0.08]" />

                      <dl className="space-y-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-white/35">IP Address</dt>
                          <dd dir="ltr" className="truncate text-white/75">
                            {device.ip || "Not set"}
                          </dd>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-white/35">MAC</dt>
                          <dd dir="ltr" className="truncate text-white/75">
                            {device.mac || "Not set"}
                          </dd>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-white/35">السعر / Hour</dt>
                          <dd className="font-medium text-violet-300">
                            {device.price || "0"} DA
                          </dd>
                        </div>
                      </dl>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => openEdit(device)}
                          className="flex h-10 items-center justify-center gap-2 rounded-lg bg-white/[0.05] text-sm text-white/75 disabled:opacity-40"
                        >
                          <Pencil size={16} />
                          Edit
                        </button>

                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void deleteDevice(device)}
                          className="flex h-10 items-center justify-center gap-2 rounded-lg bg-rose-500/10 text-sm text-rose-300 disabled:opacity-40"
                        >
                          <Trash2 size={16} />
                          Delete
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <aside className="h-fit rounded-xl border border-violet-400/15 bg-[#0c101d]">
          <div className="border-b border-white/[0.08] p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300">
                <Plus size={20} />
              </div>

              <div>
                <h2 className="font-semibold">إضافة جهاز</h2>
                <p dir="ltr" className="mt-1 text-xs text-white/35">
                  Add New Device (Admin)
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={addDevice} className="space-y-4 p-5">
            <label className="block">
              <span className="mb-2 block text-xs text-white/45">
                اسم الجهاز / Device Name
              </span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="PC-01"
                className={inputClass}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs text-white/45">
                النوع / Device Type
              </span>
              <select
                value={type}
                onChange={(event) => setType(event.target.value)}
                className={inputClass}
              >
                <option value="PC">Gaming PC</option>
                <option value="PS5">PlayStation 5</option>
                <option value="Xbox">Xbox Series</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs text-white/45">IP Address</span>
              <input
                dir="ltr"
                value={ip}
                onChange={(event) => setIp(event.target.value)}
                placeholder="192.168.1.10"
                className={inputClass}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs text-white/45">MAC Address</span>
              <input
                dir="ltr"
                value={mac}
                onChange={(event) => setMac(event.target.value)}
                placeholder="00:00:00:00:00:00"
                className={inputClass}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs text-white/45">
                السعر بالساعة / Price per Hour
              </span>

              <div className="relative">
                <input
                  dir="ltr"
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  placeholder="100"
                  className={`${inputClass} pl-14`}
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-white/35">
                  DA
                </span>
              </div>
            </label>

            <button
              type="submit"
              disabled={saving}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-violet-600 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <RefreshCw size={17} className="animate-spin" /> : <Plus size={17} />}
              {saving ? "جارٍ الحفظ..." : "إضافة الجهاز / Add Device"}
            </button>
          </form>
        </aside>
      </section>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-xl border border-violet-400/20 bg-[#0c101d]">
            <div className="flex items-center justify-between border-b border-white/[0.08] p-5">
              <div>
                <h2 className="font-semibold">تعديل الجهاز</h2>
                <p dir="ltr" className="mt-1 text-xs text-white/35">
                  #{editing.id} {editing.name}
                </p>
              </div>

              <button
                type="button"
                onClick={closeEdit}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.05]"
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={saveEdit} className="space-y-4 p-5">
              <input value={editName} onChange={(e) => setEditName(e.target.value)} className={inputClass} placeholder="Name" />

              <select value={editType} onChange={(e) => setEditType(e.target.value)} className={inputClass}>
                <option value="PC">Gaming PC</option>
                <option value="PS5">PlayStation 5</option>
                <option value="Xbox">Xbox Series</option>
              </select>

              <input dir="ltr" value={editIp} onChange={(e) => setEditIp(e.target.value)} className={inputClass} placeholder="IP" />
              <input dir="ltr" value={editMac} onChange={(e) => setEditMac(e.target.value)} className={inputClass} placeholder="MAC" />

              <input
                dir="ltr"
                type="number"
                min="0"
                step="0.01"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                className={inputClass}
                placeholder="Price"
              />

              <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as any)} className={inputClass}>
                <option value="Available">Available</option>
                <option value="Busy">Busy</option>
              </select>

              <button
                type="submit"
                disabled={saving}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-violet-600 text-sm font-medium disabled:opacity-50"
              >
                {saving ? <RefreshCw size={17} className="animate-spin" /> : <Save size={17} />}
                حفظ / Save
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}