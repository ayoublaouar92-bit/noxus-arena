import { FormEvent, useEffect, useMemo, useState } from "react";
import { KeyRound, RefreshCw, ShieldCheck, UserRound } from "lucide-react";
import type { StaffUser } from "../lib/staff-ui";

type LoginProps = { onAuthenticated: (user: StaffUser) => void };
const fieldClass = "h-12 w-full rounded-xl border border-white/15 bg-black/55 px-4 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-rose-400/80 focus:ring-2 focus:ring-rose-500/15";

export default function Login({ onAuthenticated }: LoginProps) {
  const api = (window as any).api;
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const selectedUser = useMemo(() => users.find((user) => user.id === selectedUserId) ?? null, [selectedUserId, users]);

  async function loadUsers() {
    try {
      setLoading(true); setError("");
      const result = (await api.listStaffUsers()) as StaffUser[];
      const activeUsers = result.filter((user) => Number(user.active) === 1);
      setUsers(activeUsers);
      setSelectedUserId((current) => activeUsers.some((user) => user.id === current) ? current : (activeUsers[0]?.id ?? null));
    } catch (loadError) {
      console.error(loadError); setError("تعذر تحميل قائمة الموظفين");
    } finally { setLoading(false); }
  }
  useEffect(() => { void loadUsers(); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selectedUserId) { setError("اختر الموظف أولًا"); return; }
    if (!pin.trim()) { setError("أدخل رمز PIN"); return; }
    try {
      setSubmitting(true); setError("");
      const user = (await api.staffLogin(selectedUserId, pin.trim())) as StaffUser;
      setPin(""); onAuthenticated(user);
    } catch (loginError) {
      console.error(loginError); setPin(""); setError("رمز PIN غير صحيح لهذا الموظف");
    } finally { setSubmitting(false); }
  }

  return <main dir="rtl" className="relative grid min-h-screen place-items-center overflow-hidden bg-[#070405] p-5 text-white">
    <img src="/branding/noxus-arena-emblem.jpeg" alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center opacity-35" />
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(193,25,17,.18),transparent_30%),linear-gradient(90deg,rgba(3,2,3,.93),rgba(7,3,4,.58),rgba(3,2,3,.93))]" />
    <div className="pointer-events-none absolute inset-0 bg-black/35 backdrop-blur-[1px]" />
    <div className="relative z-10 w-full max-w-[430px]">
      <div className="mb-6 flex items-center justify-center gap-3" dir="ltr">
        <img src="/branding/noxus-logo.png" alt="Noxus Arena" className="h-16 w-16 object-contain drop-shadow-[0_0_18px_rgba(255,52,37,.82)]" />
        <div><h1 className="text-xl font-bold tracking-[.2em]">NOXUS</h1><p className="mt-1 text-[10px] tracking-[.23em] text-white/65">ARENA MANAGER</p></div>
      </div>
      <section className="overflow-hidden rounded-2xl border border-white/15 bg-[#100d0e]/85 shadow-2xl shadow-black/70 backdrop-blur-xl">
        <header className="border-b border-white/10 px-6 py-5">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl border border-rose-400/20 bg-rose-500/10 text-rose-300"><ShieldCheck size={20} /></div><div><h2 className="font-semibold">تسجيل دخول الموظف</h2><p className="mt-1 text-xs text-white/55">اختر حسابك ثم أدخل رمز PIN</p></div></div>
        </header>
        <form onSubmit={submit} className="space-y-5 p-6">
          {error && <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>}
          <div><div className="mb-2 flex items-center justify-between"><label className="text-xs font-medium text-white/70">الموظف</label><button type="button" onClick={() => void loadUsers()} disabled={loading || submitting} className="flex items-center gap-1.5 text-xs text-rose-300 disabled:opacity-40"><RefreshCw size={13} className={loading ? "animate-spin" : ""} />تحديث</button></div><div className="relative"><UserRound size={17} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/40" /><select value={selectedUserId ?? ""} onChange={(event) => { setSelectedUserId(Number(event.target.value) || null); setPin(""); setError(""); }} disabled={loading || submitting || users.length === 0} className={`${fieldClass} appearance-none pr-11 disabled:opacity-50`}>{users.length === 0 && <option value="">لا يوجد موظفون نشطون</option>}{users.map((user) => <option key={user.id} value={user.id}>{user.name} — {user.role}</option>)}</select></div></div>
          <div><label className="mb-2 block text-xs font-medium text-white/70">رمز الدخول PIN</label><div className="relative"><KeyRound size={17} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/40" /><input dir="ltr" type="password" inputMode="numeric" autoComplete="off" autoFocus value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 12))} placeholder="••••" disabled={!selectedUser || submitting} className={`${fieldClass} pr-11 text-center text-lg tracking-[.4em] disabled:opacity-50`} /></div></div>
          <button type="submit" disabled={!selectedUser || !pin || submitting} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#a70717] via-[#d4112f] to-[#ff1e50] text-sm font-semibold shadow-lg shadow-rose-950/60 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45">{submitting ? <RefreshCw size={18} className="animate-spin" /> : <KeyRound size={18} />}{submitting ? "جارٍ التحقق..." : "دخول إلى النظام"}</button>
        </form>
      </section>
      <p className="mt-5 text-center text-[11px] text-white/55">لا يمكن الوصول إلى بيانات النظام قبل تسجيل الدخول</p>
    </div>
  </main>;
}
