import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Gamepad2,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { StaffUser } from "../lib/staff-ui";

type LoginProps = {
  onAuthenticated: (user: StaffUser) => void;
};

const fieldClass =
  "h-12 w-full rounded-xl border border-white/10 bg-[#080b16] px-4 text-sm text-white outline-none transition focus:border-violet-400/70 focus:ring-2 focus:ring-violet-500/10";

export default function Login({ onAuthenticated }: LoginProps) {
  const api = (window as any).api;
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, users],
  );

  async function loadUsers() {
    try {
      setLoading(true);
      setError("");
      const result = (await api.listStaffUsers()) as StaffUser[];
      const activeUsers = result.filter((user) => Number(user.active) === 1);
      setUsers(activeUsers);
      setSelectedUserId((current) =>
        activeUsers.some((user) => user.id === current)
          ? current
          : (activeUsers[0]?.id ?? null),
      );
    } catch (error) {
      console.error(error);
      setError("تعذر تحميل قائمة الموظفين");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selectedUserId) {
      setError("اختر الموظف أولًا");
      return;
    }
    if (!pin.trim()) {
      setError("أدخل رمز PIN");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      const user = (await api.staffLogin(
        selectedUserId,
        pin.trim(),
      )) as StaffUser;
      setPin("");
      onAuthenticated(user);
    } catch (error) {
      console.error(error);
      setPin("");
      setError("رمز PIN غير صحيح لهذا الموظف");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      dir="rtl"
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050711] p-5 text-white"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-violet-600/10 blur-[140px]" />
        <div className="absolute -bottom-56 left-1/4 h-[560px] w-[560px] rounded-full bg-fuchsia-600/[0.07] blur-[160px]" />
        <div className="absolute left-1/2 top-1/3 h-80 w-80 -translate-x-1/2 rounded-full bg-cyan-500/[0.04] blur-[130px]" />
      </div>

      <div className="relative z-10 w-full max-w-[460px]">
        <div className="mb-7 flex items-center justify-center gap-3">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-[0_0_45px_rgba(139,92,246,0.3)]">
            <Gamepad2 size={27} />
            <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[#050711] bg-cyan-300" />
          </div>
          <div className="text-left" dir="ltr">
            <h1 className="text-xl font-bold tracking-[0.18em]">NOXUS</h1>
            <p className="mt-1 text-[10px] tracking-[0.22em] text-white/35">
              ARENA MANAGER
            </p>
          </div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0b0f1c]/95 shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="border-b border-white/[0.07] px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h2 className="font-semibold">تسجيل دخول الموظف</h2>
                <p className="mt-1 text-xs text-white/35">
                  اختر حسابك ثم أدخل رمز PIN
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-5 p-6">
            {error && (
              <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-medium text-white/55">
                  الموظف / Staff
                </label>
                <button
                  type="button"
                  onClick={() => void loadUsers()}
                  disabled={loading || submitting}
                  className="flex items-center gap-1.5 text-xs text-violet-300 disabled:opacity-40"
                >
                  <RefreshCw
                    size={13}
                    className={loading ? "animate-spin" : ""}
                  />
                  تحديث
                </button>
              </div>

              <div className="relative">
                <UserRound
                  size={17}
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/30"
                />
                <select
                  value={selectedUserId ?? ""}
                  onChange={(event) => {
                    setSelectedUserId(Number(event.target.value) || null);
                    setPin("");
                    setError("");
                  }}
                  disabled={loading || submitting || users.length === 0}
                  className={`${fieldClass} appearance-none pr-11 disabled:opacity-50`}
                >
                  {users.length === 0 && (
                    <option value="">لا يوجد موظفون نشطون</option>
                  )}
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} — {user.role}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-white/55">
                رمز الدخول / PIN
              </label>
              <div className="relative">
                <KeyRound
                  size={17}
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/30"
                />
                <input
                  dir="ltr"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  autoFocus
                  value={pin}
                  onChange={(event) =>
                    setPin(event.target.value.replace(/\D/g, "").slice(0, 12))
                  }
                  placeholder="••••"
                  disabled={!selectedUser || submitting}
                  className={`${fieldClass} pr-11 text-center text-lg tracking-[0.4em] placeholder:tracking-normal disabled:opacity-50`}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!selectedUser || !pin || submitting}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-sm font-semibold shadow-lg shadow-violet-950/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {submitting ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                <KeyRound size={18} />
              )}
              {submitting ? "جاري التحقق..." : "دخول إلى النظام"}
            </button>
          </form>
        </section>

        <p className="mt-5 text-center text-[11px] text-white/25">
          لا يمكن الوصول إلى بيانات النظام قبل تسجيل الدخول
        </p>
      </div>
    </div>
  );
}
