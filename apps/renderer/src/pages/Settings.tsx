import { FormEvent, useEffect, useMemo, useState } from "react";
import { RefreshCw, Settings as SettingsIcon, SlidersHorizontal, Save } from "lucide-react";
import { handleUnauthorized } from "../lib/auth";
import { isAdmin, loadCurrentStaff, type StaffUser } from "../lib/staff-ui";

type AppSettings = {
  currency: string;
  roundingMode: "minute" | "quarter_hour" | "hour";
  minimumMinutes: number;
  defaultGuestPayment: "cash" | "debt";
};

const fieldClass =
  "h-11 w-full rounded-lg border border-white/10 bg-[#080b16] px-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-violet-400/60";

function normalizeInt(value: string) {
  const map: Record<string, string> = {
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

  return value
    .split("")
    .map((c) => map[c] ?? c)
    .join("")
    .replace(/[^\d]/g, "");
}

export default function Settings() {
  const api = (window as any).api;

  const [current, setCurrent] = useState<StaffUser | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [settings, setSettings] = useState<AppSettings>({
    currency: "DA",
    roundingMode: "minute",
    minimumMinutes: 1,
    defaultGuestPayment: "cash",
  });

  const canEdit = useMemo(() => isAdmin(current), [current]);

  async function loadSettings(showLoading = false) {
    try {
      if (showLoading) setLoading(true);
      setError("");

      const [staffUser, result] = await Promise.all([
        loadCurrentStaff(api),
        api.getSettings(),
      ]);

      setCurrent(staffUser);
      setSettings(result);
    } catch (e) {
      console.error(e);
      setError("تعذر تحميل الإعدادات");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSettings(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();

    if (!canEdit) {
      window.alert("هذه الصفحة Admin فقط");
      window.location.hash = "#/staff";
      return;
    }

    try {
      setSaving(true);
      setError("");

      const result = await api.updateSettings({
        currency: settings.currency,
        roundingMode: settings.roundingMode,
        minimumMinutes: settings.minimumMinutes,
        defaultGuestPayment: settings.defaultGuestPayment,
      });

      setSettings(result);
      window.alert("تم حفظ الإعدادات");
    } catch (e: any) {
      console.error(e);
      if (handleUnauthorized(e)) return;
      setError("تعذر حفظ الإعدادات");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div dir="rtl" className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-sm text-violet-300">System Settings</p>
          <h1 className="text-3xl font-semibold">الإعدادات / Settings</h1>
          <p className="mt-2 text-sm text-white/45">
            {canEdit ? "Admin mode" : "Admin فقط (Staff للعرض فقط)"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadSettings(true)}
          disabled={loading}
          className="flex h-11 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm"
        >
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
          تحديث
        </button>
      </section>

      {!canEdit && (
        <div className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          هذه الصفحة Admin فقط. لتسجيل الدخول: Staff → PIN
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <article className="rounded-xl border border-white/[0.08] bg-[#0c101d]">
          <div className="border-b border-white/[0.08] p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300">
                <SlidersHorizontal size={18} />
              </div>
              <div>
                <h2 className="font-semibold">إعدادات الحساب</h2>
                <p className="mt-1 text-xs text-white/30">Pricing & rules</p>
              </div>
            </div>
          </div>

          <form onSubmit={save} className="space-y-4 p-5">
            <label className="block">
              <span className="mb-2 block text-xs text-white/45">العملة / Currency</span>
              <input
                value={settings.currency}
                onChange={(e) => setSettings((prev) => ({ ...prev, currency: e.target.value }))}
                className={fieldClass}
                disabled={!canEdit}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs text-white/45">تقريب مدة الجلسة / Rounding</span>
              <select
                value={settings.roundingMode}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    roundingMode: e.target.value as AppSettings["roundingMode"],
                  }))
                }
                className={fieldClass}
                disabled={!canEdit}
              >
                <option value="minute">بالدقيقة (Minute)</option>
                <option value="quarter_hour">ربع ساعة (15 min)</option>
                <option value="hour">بالساعة (Hour)</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs text-white/45">
                الحد الأدنى للجلسة (دقائق) / Minimum minutes
              </span>
              <input
                dir="ltr"
                type="text"
                inputMode="numeric"
                value={String(settings.minimumMinutes)}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    minimumMinutes: Number(normalizeInt(e.target.value) || "1"),
                  }))
                }
                className={fieldClass}
                disabled={!canEdit}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs text-white/45">
                Guest الدفع الافتراضي / Default guest payment
              </span>
              <select
                value={settings.defaultGuestPayment}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    defaultGuestPayment: e.target.value as AppSettings["defaultGuestPayment"],
                  }))
                }
                className={fieldClass}
                disabled={!canEdit}
              >
                <option value="cash">Cash (نقدًا)</option>
                <option value="debt">Debt (تسجيل دين)</option>
              </select>
            </label>

            <button
              type="submit"
              disabled={!canEdit || saving}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-violet-600 text-sm font-medium disabled:opacity-50"
            >
              {saving ? <RefreshCw size={17} className="animate-spin" /> : <Save size={17} />}
              حفظ الإعدادات
            </button>
          </form>
        </article>

        <article className="h-fit rounded-xl border border-violet-400/15 bg-[#0c101d]">
          <div className="border-b border-white/[0.08] p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300">
                <SettingsIcon size={18} />
              </div>
              <div>
                <h2 className="font-semibold">ملاحظات</h2>
                <p className="mt-1 text-xs text-white/30">Important</p>
              </div>
            </div>
          </div>

          <div className="space-y-3 p-5 text-sm text-white/50">
            <p>- فقط Admin يمكنه تعديل الإعدادات.</p>
            <p>- Staff يستطيع مشاهدة القيم فقط.</p>
          </div>
        </article>
      </section>
    </div>
  );
}