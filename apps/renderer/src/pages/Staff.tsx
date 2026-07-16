import { FormEvent, useEffect, useMemo, useState } from "react";
import { KeyRound, LogOut, RefreshCw, Shield, UserPlus } from "lucide-react";
import { isAdmin } from "../lib/staff-ui";

type StaffUser = {
  id: number;
  name: string;
  role: "Admin" | "Staff";
  active: number;
  createdAt: string;
};

type AuditItem = {
  id: number;
  staffUserId: number | null;
  staffName: string | null;
  staffRole: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  details: string | null;
  createdAt: string;
};

const fieldClass =
  "h-11 w-full rounded-lg border border-white/10 bg-[#080b16] px-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-violet-400/60";

export default function Staff() {
  const api = (window as any).api;

  const [current, setCurrent] = useState<StaffUser | null>(null);
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [audit, setAudit] = useState<AuditItem[]>([]);

  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"Admin" | "Staff">("Staff");
  const [newPin, setNewPin] = useState("");

  const canManageUsers = useMemo(() => isAdmin(current), [current]);

  async function loadAll(showLoading = false) {
    try {
      if (showLoading) setLoading(true);
      setError("");

      const [c, u, a] = await Promise.all([
        api.getCurrentStaff(),
        api.listStaffUsers(),
        api.getAuditLog(),
      ]);

      setCurrent(c);
      setUsers(u);
      setAudit(a);
    } catch (e) {
      console.error(e);
      setError("تعذر تحميل بيانات الموظفين");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll(true);
  }, []);

  async function login(event: FormEvent) {
    event.preventDefault();

    try {
      setBusy(true);
      setError("");

      const user = await api.staffLogin(pin);
      setCurrent(user);
      setPin("");

      await loadAll();
    } catch (e: any) {
      console.error(e);
      setError("PIN غير صحيح");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try {
      setBusy(true);
      setError("");
      await api.staffLogout();
      setCurrent(null);
      await loadAll();
    } catch (e) {
      console.error(e);
      setError("تعذر تسجيل الخروج");
    } finally {
      setBusy(false);
    }
  }

  async function createUser(event: FormEvent) {
    event.preventDefault();

    if (!canManageUsers) {
      setError("فقط Admin يستطيع إنشاء مستخدمين");
      return;
    }

    try {
      setBusy(true);
      setError("");

      await api.createStaffUser({
        name: newName.trim(),
        role: newRole,
        pin: newPin.trim(),
      });

      setNewName("");
      setNewPin("");
      setNewRole("Staff");

      await loadAll();
    } catch (e: any) {
      console.error(e);
      const msg = String(e?.message || "");
      if (msg.includes("UNAUTHORIZED")) setError("سجّل الدخول أولًا");
      else if (msg.includes("FORBIDDEN")) setError("فقط Admin يستطيع إنشاء مستخدمين");
      else setError("تعذر إنشاء المستخدم");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(user: StaffUser) {
    if (!canManageUsers) {
      setError("فقط Admin يستطيع تفعيل/تعطيل المستخدمين");
      return;
    }

    try {
      setBusy(true);
      setError("");

      await api.setStaffUserActive({
        userId: user.id,
        active: !(Number(user.active) === 1),
      });

      await loadAll();
    } catch (e: any) {
      console.error(e);
      const msg = String(e?.message || "");
      if (msg.includes("FORBIDDEN")) setError("فقط Admin يستطيع تفعيل/تعطيل المستخدمين");
      else setError("تعذر تعديل حالة المستخدم");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div dir="rtl" className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-sm text-violet-300">Security</p>
          <h1 className="text-3xl font-semibold">الموظفين / Staff</h1>
          <p className="mt-2 text-sm text-white/45">
            تسجيل دخول PIN + Admin/Staff + سجل عمليات
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadAll(true)}
          className="flex h-11 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm"
        >
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
          تحديث
        </button>
      </section>

      {error && (
        <div className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {!canManageUsers && current && (
        <div className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          إدارة المستخدمين (Create/Disable) Admin فقط.
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <article className="rounded-xl border border-white/[0.08] bg-[#0c101d]">
          <div className="border-b border-white/[0.08] p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="text-violet-300" />
              <div>
                <h2 className="font-semibold">الحساب الحالي</h2>
                <p className="mt-1 text-xs text-white/30">Current session</p>
              </div>
            </div>

            {current ? (
              <button
                type="button"
                onClick={() => void logout()}
                disabled={busy}
                className="flex h-10 items-center gap-2 rounded-lg bg-rose-500/10 px-3 text-sm text-rose-300 disabled:opacity-40"
              >
                <LogOut size={16} />
                خروج
              </button>
            ) : null}
          </div>

          <div className="p-5">
            {current ? (
              <div className="rounded-xl border border-white/[0.08] bg-[#090d18] p-4">
                <p className="text-sm font-semibold">{current.name}</p>
                <p className="mt-1 text-xs text-white/35">
                  Role: {current.role} · Active: {Number(current.active) === 1 ? "Yes" : "No"}
                </p>
              </div>
            ) : (
              <form onSubmit={login} className="space-y-4">
                <p className="text-sm text-white/45">أدخل PIN لتسجيل الدخول. (الأدمن الافتراضي: 0000)</p>

                <input
                  dir="ltr"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="PIN"
                  className={fieldClass}
                />

                <button
                  type="submit"
                  disabled={busy}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-violet-600 text-sm font-medium disabled:opacity-40"
                >
                  <KeyRound size={17} />
                  دخول
                </button>
              </form>
            )}
          </div>
        </article>

        <aside className="space-y-6">
          {canManageUsers && (
            <article className="rounded-xl border border-violet-400/15 bg-[#0c101d]">
              <div className="border-b border-white/[0.08] p-5">
                <div className="flex items-center gap-3">
                  <UserPlus className="text-violet-300" />
                  <div>
                    <h2 className="font-semibold">إضافة مستخدم</h2>
                    <p className="mt-1 text-xs text-white/30">Admin only</p>
                  </div>
                </div>
              </div>

              <form onSubmit={createUser} className="space-y-4 p-5">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="اسم المستخدم"
                  className={fieldClass}
                />

                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className={fieldClass}
                >
                  <option value="Staff">Staff</option>
                  <option value="Admin">Admin</option>
                </select>

                <input
                  dir="ltr"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="PIN (min 4)"
                  className={fieldClass}
                />

                <button
                  type="submit"
                  disabled={busy}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-violet-600 text-sm font-medium disabled:opacity-40"
                >
                  <UserPlus size={17} />
                  إنشاء
                </button>
              </form>
            </article>
          )}

          <article className="rounded-xl border border-white/[0.08] bg-[#0c101d]">
            <div className="border-b border-white/[0.08] p-5">
              <h2 className="font-semibold">المستخدمون</h2>
              <p className="mt-1 text-xs text-white/30">Users</p>
            </div>

            <div className="divide-y divide-white/[0.06]">
              {users.map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{u.name}</p>
                    <p className="mt-1 text-xs text-white/35">
                      {u.role} · {Number(u.active) === 1 ? "Active" : "Inactive"}
                    </p>
                  </div>

                  {canManageUsers ? (
                    <button
                      type="button"
                      onClick={() => void toggleActive(u)}
                      disabled={busy}
                      className="h-9 rounded-lg bg-white/[0.05] px-3 text-xs text-white/65 disabled:opacity-40"
                    >
                      {Number(u.active) === 1 ? "تعطيل" : "تفعيل"}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </article>
        </aside>
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-[#0c101d]">
        <div className="border-b border-white/[0.08] p-5">
          <h2 className="font-semibold">سجل العمليات / Audit</h2>
          <p className="mt-1 text-xs text-white/30">Last 300 actions</p>
        </div>

        <div className="max-h-[520px] overflow-y-auto divide-y divide-white/[0.06]">
          {audit.map((a) => (
            <div key={a.id} className="p-4">
              <p className="text-sm font-medium">
                {a.action}{" "}
                <span className="text-xs text-white/35">· {a.staffName || "System"}</span>
              </p>

              <p className="mt-1 text-xs text-white/35">
                {a.entity || "-"} {a.entityId ? `#${a.entityId}` : ""}{" "}
                {a.details ? `· ${a.details}` : ""}
              </p>

              <p className="mt-1 text-[10px] text-white/25">
                {new Date(a.createdAt).toLocaleString("ar-DZ")}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}