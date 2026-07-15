import {
  Activity,
  ArrowUpLeft,
  Banknote,
  Clock3,
  Gamepad2,
  Monitor,
  Radio,
  RefreshCw,
  Timer,
  Users,
  Zap,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { Link } from "react-router-dom";

type Device = {
  id: number;
  name: string;
  type: string;
  price: string;
  status: "Available" | "Busy";
};

type Session = {
  id: number;
  deviceId: number;
  deviceName: string;
  customerName: string;
  startTime: string;
  hourlyPrice: string;
  status: string;
};

export default function Dashboard() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [sessions, setSessions] = useState<Session[]>(
    []
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [, setCurrentTime] = useState(Date.now());

  const api = (window as any).api;

  async function loadDashboard(showLoading = false) {
    try {
      if (showLoading) {
        setLoading(true);
      }

      setError("");

      const [
        devicesResult,
        sessionsResult,
      ] = await Promise.all([
        api.getDevices(),
        api.getActiveSessions(),
      ]);

      setDevices(devicesResult);
      setSessions(sessionsResult);
    } catch (loadError) {
      console.error(loadError);

      setError(
        "تعذر تحميل لوحة التحكم / Dashboard failed to load"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard(true);

    const clockInterval = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    const dataInterval = window.setInterval(() => {
      void loadDashboard();
    }, 5000);

    return () => {
      window.clearInterval(clockInterval);
      window.clearInterval(dataInterval);
    };
  }, []);

  function getMinutes(startTime: string) {
    const start = new Date(startTime).getTime();

    return Math.max(
      1,
      Math.ceil((Date.now() - start) / 60000)
    );
  }

  function getPrice(
    startTime: string,
    hourlyPrice: string
  ) {
    const minutes = getMinutes(startTime);

    return (
      (minutes / 60) *
      Number(hourlyPrice || 0)
    ).toFixed(2);
  }

  function formatStartTime(startTime: string) {
    return new Date(startTime).toLocaleTimeString(
      "ar-DZ",
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }

  const availableDevices = useMemo(
    () =>
      devices.filter(
        (device) => device.status === "Available"
      ),
    [devices]
  );

  const busyDevices = useMemo(
    () =>
      devices.filter(
        (device) => device.status === "Busy"
      ),
    [devices]
  );

  const occupancyRate =
    devices.length === 0
      ? 0
      : Math.round(
          (busyDevices.length / devices.length) *
            100
        );

  const estimatedRevenue = sessions.reduce(
    (total, session) =>
      total +
      Number(
        getPrice(
          session.startTime,
          session.hourlyPrice
        )
      ),
    0
  );

  const averageDuration =
    sessions.length === 0
      ? 0
      : Math.round(
          sessions.reduce(
            (total, session) =>
              total +
              getMinutes(session.startTime),
            0
          ) / sessions.length
        );

  const stats = [
    {
      label: "إجمالي الأجهزة",
      english: "Total Devices",
      value: devices.length,
      icon: Monitor,
      color: "text-violet-300",
      surface: "bg-violet-500/10",
    },
    {
      label: "الجلسات النشطة",
      english: "Live Sessions",
      value: sessions.length,
      icon: Activity,
      color: "text-emerald-300",
      surface: "bg-emerald-500/10",
    },
    {
      label: "متوسط المدة",
      english: "Average Duration",
      value: `${averageDuration} min`,
      icon: Timer,
      color: "text-sky-300",
      surface: "bg-sky-500/10",
    },
    {
      label: "الإيراد الحالي",
      english: "Current Revenue",
      value: `${estimatedRevenue.toFixed(2)} DA`,
      icon: Banknote,
      color: "text-amber-300",
      surface: "bg-amber-500/10",
    },
  ];

  const quickLinks = [
    {
      title: "الأجهزة",
      english: "Devices",
      description: "إدارة محطات اللعب",
      path: "/devices",
      icon: Monitor,
      color: "text-violet-300",
    },
    {
      title: "الجلسات",
      english: "Sessions",
      description: "بدء ومتابعة الجلسات",
      path: "/sessions",
      icon: Gamepad2,
      color: "text-sky-300",
    },
    {
      title: "الأعضاء",
      english: "Members",
      description: "إدارة عضويات اللاعبين",
      path: "/members",
      icon: Users,
      color: "text-emerald-300",
    },
  ];

  return (
    <div dir="rtl" className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm text-violet-300">
            <Zap size={16} />
            Live Arena Overview
          </div>

          <h1 className="text-3xl font-semibold tracking-tight">
            مركز التحكم
            <span
              dir="ltr"
              className="mr-3 text-lg font-normal text-white/35"
            >
              / Control Center
            </span>
          </h1>

          <p className="mt-2 text-sm text-white/45">
            متابعة حالة القاعة والجلسات في الوقت الفعلي
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            void loadDashboard(true)
          }
          disabled={loading}
          className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 text-xs text-white/55 transition hover:border-violet-400/30 hover:text-white disabled:opacity-50"
        >
          <RefreshCw
            size={15}
            className={loading ? "animate-spin" : ""}
          />
          تحديث البيانات
        </button>
      </section>

      {error && (
        <div className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <article
              key={stat.english}
              className="group rounded-xl border border-white/[0.08] bg-[#0c101d] p-5 transition hover:border-violet-400/20"
            >
              <div className="flex items-start justify-between">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-lg ${stat.surface}`}
                >
                  <Icon
                    size={21}
                    className={stat.color}
                  />
                </div>

                <span
                  dir="ltr"
                  className="text-2xl font-semibold"
                >
                  {stat.value}
                </span>
              </div>

              <p className="mt-5 text-sm font-medium">
                {stat.label}
              </p>

              <p
                dir="ltr"
                className="mt-1 text-xs text-white/30"
              >
                {stat.english}
              </p>
            </article>
          );
        })}
      </section>

      <section className="grid gap-6 2xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.55fr)]">
        <article className="relative min-h-[330px] overflow-hidden rounded-xl border border-violet-400/15 bg-[#0b0f1c]">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-20 -top-32 h-80 w-80 rounded-full bg-fuchsia-600/15 blur-[100px]" />

            <div className="absolute -bottom-40 right-0 h-96 w-96 rounded-full bg-violet-600/20 blur-[120px]" />

            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:32px_32px]" />
          </div>

          <div className="relative z-10 flex h-full min-h-[330px] flex-col justify-between p-6 lg:p-8">
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-flex items-center gap-2 rounded-md border border-emerald-400/15 bg-emerald-400/[0.07] px-3 py-1.5 text-xs text-emerald-300">
                  <Radio size={13} />
                  ARENA LIVE
                </span>

                <h2 className="mt-5 max-w-lg text-3xl font-semibold leading-tight lg:text-4xl">
                  القاعة تعمل بكفاءة
                  <span
                    dir="ltr"
                    className="mt-2 block text-violet-300"
                  >
                    Arena Operations Online
                  </span>
                </h2>

                <p className="mt-4 max-w-lg text-sm leading-6 text-white/40">
                  تابع إشغال الأجهزة والجلسات النشطة
                  والإيرادات من مكان واحد.
                </p>
              </div>

              <div className="hidden h-28 w-28 items-center justify-center rounded-full border border-violet-400/20 bg-violet-500/[0.06] lg:flex">
                <div className="text-center">
                  <p className="text-3xl font-semibold text-violet-200">
                    {occupancyRate}%
                  </p>

                  <p className="mt-1 text-[10px] text-white/35">
                    OCCUPANCY
                  </p>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between text-xs">
                <span className="text-white/40">
                  نسبة إشغال القاعة
                </span>

                <span
                  dir="ltr"
                  className="text-violet-300"
                >
                  {busyDevices.length} /{" "}
                  {devices.length} devices
                </span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-400 transition-all duration-500"
                  style={{
                    width: `${occupancyRate}%`,
                  }}
                />
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  to="/sessions"
                  className="flex h-10 items-center gap-2 rounded-lg bg-violet-600 px-4 text-sm font-medium transition hover:bg-violet-500"
                >
                  <Gamepad2 size={17} />
                  إدارة الجلسات
                </Link>

                <Link
                  to="/devices"
                  className="flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm text-white/65 transition hover:border-violet-400/30 hover:text-white"
                >
                  <Monitor size={17} />
                  عرض الأجهزة
                </Link>
              </div>
            </div>
          </div>
        </article>

        <article className="rounded-xl border border-white/[0.08] bg-[#0c101d]">
          <div className="flex items-center justify-between border-b border-white/[0.08] p-5">
            <div>
              <h2 className="font-semibold">
                حالة الأجهزة
              </h2>

              <p
                dir="ltr"
                className="mt-1 text-xs text-white/30"
              >
                Device Status
              </p>
            </div>

            <Link
              to="/devices"
              className="text-xs text-violet-300 transition hover:text-violet-200"
            >
              عرض الكل
            </Link>
          </div>

          <div className="space-y-2 p-4">
            {devices.length === 0 ? (
              <div className="flex min-h-56 flex-col items-center justify-center text-center">
                <Monitor
                  size={28}
                  className="mb-3 text-white/20"
                />

                <p className="text-sm text-white/35">
                  لا توجد أجهزة
                </p>
              </div>
            ) : (
              devices.slice(0, 5).map((device) => {
                const available =
                  device.status === "Available";

                return (
                  <div
                    key={device.id}
                    className="flex items-center gap-3 rounded-lg border border-transparent bg-white/[0.025] p-3 transition hover:border-white/[0.08]"
                  >
                    <div
                      className={
                        available
                          ? "flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-300"
                          : "flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-300"
                      }
                    >
                      {device.type === "PC" ? (
                        <Monitor size={17} />
                      ) : (
                        <Gamepad2 size={17} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p
                        dir="ltr"
                        className="truncate text-sm font-medium"
                      >
                        {device.name}
                      </p>

                      <p
                        dir="ltr"
                        className="mt-1 text-[10px] text-white/30"
                      >
                        {device.type} ·{" "}
                        {device.price || "0"} DA/h
                      </p>
                    </div>

                    <span
                      className={
                        available
                          ? "text-[10px] text-emerald-300"
                          : "text-[10px] text-rose-300"
                      }
                    >
                      {available
                        ? "AVAILABLE"
                        : "IN USE"}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-white/[0.08] p-4">
            <div className="rounded-lg bg-emerald-500/[0.06] p-3">
              <p className="text-xs text-white/35">
                متاحة
              </p>

              <p className="mt-1 text-xl font-semibold text-emerald-300">
                {availableDevices.length}
              </p>
            </div>

            <div className="rounded-lg bg-rose-500/[0.06] p-3">
              <p className="text-xs text-white/35">
                مشغولة
              </p>

              <p className="mt-1 text-xl font-semibold text-rose-300">
                {busyDevices.length}
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <article className="rounded-xl border border-white/[0.08] bg-[#0c101d]">
          <div className="flex items-center justify-between border-b border-white/[0.08] p-5">
            <div>
              <h2 className="font-semibold">
                الجلسات المباشرة
              </h2>

              <p
                dir="ltr"
                className="mt-1 text-xs text-white/30"
              >
                Live Sessions
              </p>
            </div>

            <Link
              to="/sessions"
              className="flex items-center gap-1.5 text-xs text-violet-300 transition hover:text-violet-200"
            >
              إدارة الجلسات
              <ArrowUpLeft size={14} />
            </Link>
          </div>

          <div className="p-4">
            {sessions.length === 0 ? (
              <div className="flex min-h-44 flex-col items-center justify-center text-center">
                <Clock3
                  size={28}
                  className="mb-3 text-white/20"
                />

                <p className="text-sm text-white/35">
                  لا توجد جلسات نشطة الآن
                </p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {sessions.slice(0, 3).map((session) => (
                  <div
                    key={session.id}
                    className="rounded-lg border border-violet-400/10 bg-[#090d18] p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[10px] text-emerald-300">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                        LIVE
                      </span>

                      <span
                        dir="ltr"
                        className="text-[10px] text-white/25"
                      >
                        {formatStartTime(
                          session.startTime
                        )}
                      </span>
                    </div>

                    <h3
                      dir="ltr"
                      className="mt-4 truncate font-semibold"
                    >
                      {session.deviceName}
                    </h3>

                    <p
                      dir="ltr"
                      className="mt-1 truncate text-xs text-white/35"
                    >
                      {session.customerName}
                    </p>

                    <div className="mt-4 flex items-end justify-between">
                      <div>
                        <p className="text-[10px] text-white/25">
                          DURATION
                        </p>

                        <p
                          dir="ltr"
                          className="mt-1 text-sm text-sky-300"
                        >
                          {getMinutes(
                            session.startTime
                          )}{" "}
                          min
                        </p>
                      </div>

                      <div className="text-left">
                        <p className="text-[10px] text-white/25">
                          TOTAL
                        </p>

                        <p
                          dir="ltr"
                          className="mt-1 text-sm text-emerald-300"
                        >
                          {getPrice(
                            session.startTime,
                            session.hourlyPrice
                          )}{" "}
                          DA
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </article>

        <article className="rounded-xl border border-white/[0.08] bg-[#0c101d]">
          <div className="border-b border-white/[0.08] p-5">
            <h2 className="font-semibold">
              وصول سريع
            </h2>

            <p
              dir="ltr"
              className="mt-1 text-xs text-white/30"
            >
              Quick Access
            </p>
          </div>

          <div className="space-y-2 p-4">
            {quickLinks.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="group flex items-center gap-3 rounded-lg border border-transparent bg-white/[0.025] p-3 transition hover:border-violet-400/15 hover:bg-violet-500/[0.05]"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04]">
                    <Icon
                      size={17}
                      className={item.color}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {item.title}
                    </p>

                    <p
                      dir="ltr"
                      className="mt-1 text-[10px] text-white/30"
                    >
                      {item.english}
                    </p>
                  </div>

                  <ArrowUpLeft
                    size={15}
                    className="text-white/20 transition group-hover:text-violet-300"
                  />
                </Link>
              );
            })}
          </div>
        </article>
      </section>
    </div>
  );
}