import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Activity,
  Banknote,
  Clock3,
  Gamepad2,
  Monitor,
  Play,
  RefreshCw,
  Square,
  Timer,
  UserRound,
} from "lucide-react";

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

const fieldClass =
  "h-11 w-full rounded-lg border border-white/10 bg-[#080b16] px-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/10";

export default function Sessions() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [sessions, setSessions] = useState<Session[]>(
    []
  );

  const [customerName, setCustomerName] =
    useState("");

  const [selectedDeviceId, setSelectedDeviceId] =
    useState("");

  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [endingId, setEndingId] = useState<
    number | null
  >(null);

  const [error, setError] = useState("");
  const [, setCurrentTime] = useState(Date.now());

  const api = (window as any).api;

  async function loadData(showLoading = false) {
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
        "تعذر تحميل الجلسات / Failed to load sessions"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData(true);

    const timerInterval = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    const dataInterval = window.setInterval(() => {
      void loadData();
    }, 5000);

    return () => {
      window.clearInterval(timerInterval);
      window.clearInterval(dataInterval);
    };
  }, []);

  const availableDevices = useMemo(
    () =>
      devices.filter(
        (device) => device.status === "Available"
      ),
    [devices]
  );

  const selectedDevice = devices.find(
    (device) =>
      device.id === Number(selectedDeviceId)
  );

  function getMinutes(startTime: string) {
    const start = new Date(startTime).getTime();
    const difference = Date.now() - start;

    return Math.max(
      1,
      Math.ceil(difference / 60000)
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

  async function startSession(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!selectedDeviceId) {
      setError(
        "اختر جهازًا / Select a device"
      );
      return;
    }

    try {
      setStarting(true);
      setError("");

      await api.startSession({
        deviceId: Number(selectedDeviceId),
        customerName:
          customerName.trim() || "Guest",
      });

      setCustomerName("");
      setSelectedDeviceId("");

      await loadData();
    } catch (startError) {
      console.error(startError);

      setError(
        "تعذر بدء الجلسة / Failed to start session"
      );
    } finally {
      setStarting(false);
    }
  }

  async function endSession(sessionId: number) {
    try {
      setEndingId(sessionId);
      setError("");

      const result =
        await api.endSession(sessionId);

      alert(
        `تم إنهاء الجلسة / Session ended\n\n` +
          `المدة / Duration: ${result.minutes} min\n` +
          `المبلغ / Total: ${result.total} DA`
      );

      await loadData();
    } catch (endError) {
      console.error(endError);

      setError(
        "تعذر إنهاء الجلسة / Failed to end session"
      );
    } finally {
      setEndingId(null);
    }
  }

  const currentRevenue = sessions.reduce(
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
      label: "الجلسات النشطة",
      english: "Active Sessions",
      value: sessions.length,
      icon: Activity,
      color: "text-emerald-300",
      surface: "bg-emerald-500/10",
    },
    {
      label: "الأجهزة المتاحة",
      english: "Available Devices",
      value: availableDevices.length,
      icon: Monitor,
      color: "text-violet-300",
      surface: "bg-violet-500/10",
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
      value: `${currentRevenue.toFixed(2)} DA`,
      icon: Banknote,
      color: "text-amber-300",
      surface: "bg-amber-500/10",
    },
  ];

  return (
    <div dir="rtl" className="space-y-6">
      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm text-violet-300">
            <Gamepad2 size={16} />
            Session Control
          </div>

          <h1 className="text-3xl font-semibold tracking-tight">
            الجلسات
            <span
              dir="ltr"
              className="mr-3 text-lg font-normal text-white/35"
            >
              / Sessions
            </span>
          </h1>

          <p className="mt-2 text-sm text-white/45">
            تشغيل ومتابعة جلسات اللعب في الوقت الفعلي
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadData(true)}
          disabled={loading}
          className="flex h-11 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 text-sm text-white/70 transition hover:border-violet-400/30 hover:bg-violet-500/10 hover:text-white disabled:opacity-50"
        >
          <RefreshCw
            size={17}
            className={loading ? "animate-spin" : ""}
          />
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
                className="mt-1 text-xs text-white/35"
              >
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
          <div className="flex items-center justify-between border-b border-white/[0.08] p-5">
            <div>
              <h2 className="font-semibold">
                الجلسات الحالية
              </h2>

              <p
                dir="ltr"
                className="mt-1 text-xs text-white/35"
              >
                Live Gaming Sessions
              </p>
            </div>

            {sessions.length > 0 && (
              <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                Live
              </div>
            )}
          </div>

          <div className="p-5">
            {loading ? (
              <div className="flex min-h-80 items-center justify-center text-sm text-white/40">
                جارٍ تحميل الجلسات...
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex min-h-80 flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300">
                  <Clock3 size={27} />
                </div>

                <p className="font-medium">
                  لا توجد جلسات نشطة
                </p>

                <p
                  dir="ltr"
                  className="mt-2 text-sm text-white/35"
                >
                  Start a new session from the control panel
                </p>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {sessions.map((session) => {
                  const minutes = getMinutes(
                    session.startTime
                  );

                  const total = getPrice(
                    session.startTime,
                    session.hourlyPrice
                  );

                  return (
                    <article
                      key={session.id}
                      className="rounded-xl border border-violet-400/15 bg-[#090d18] p-5 transition hover:border-violet-400/35"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300">
                            <Gamepad2 size={21} />
                          </div>

                          <div className="min-w-0">
                            <h3
                              dir="ltr"
                              className="truncate font-semibold"
                            >
                              {session.deviceName}
                            </h3>

                            <p className="mt-1 flex items-center gap-1.5 text-xs text-emerald-300">
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                              جلسة نشطة / Running
                            </p>
                          </div>
                        </div>

                        <span
                          dir="ltr"
                          className="rounded-md bg-white/5 px-2 py-1 text-xs text-white/45"
                        >
                          #{session.id}
                        </span>
                      </div>

                      <div className="my-4 h-px bg-white/[0.08]" />

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-white/[0.04] p-3">
                          <p className="text-xs text-white/35">
                            اللاعب / Player
                          </p>

                          <p
                            dir="ltr"
                            className="mt-1 truncate text-sm font-medium"
                          >
                            {session.customerName}
                          </p>
                        </div>

                        <div className="rounded-lg bg-white/[0.04] p-3">
                          <p className="text-xs text-white/35">
                            بدأت / Started
                          </p>

                          <p
                            dir="ltr"
                            className="mt-1 text-sm font-medium"
                          >
                            {formatStartTime(
                              session.startTime
                            )}
                          </p>
                        </div>

                        <div className="rounded-lg bg-white/[0.04] p-3">
                          <p className="text-xs text-white/35">
                            المدة / Duration
                          </p>

                          <p
                            dir="ltr"
                            className="mt-1 text-sm font-medium text-sky-300"
                          >
                            {minutes} min
                          </p>
                        </div>

                        <div className="rounded-lg bg-white/[0.04] p-3">
                          <p className="text-xs text-white/35">
                            المبلغ / Total
                          </p>

                          <p
                            dir="ltr"
                            className="mt-1 text-sm font-medium text-emerald-300"
                          >
                            {total} DA
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          void endSession(session.id)
                        }
                        disabled={endingId === session.id}
                        className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-rose-400/20 bg-rose-500/10 text-sm font-medium text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
                      >
                        {endingId === session.id ? (
                          <RefreshCw
                            size={16}
                            className="animate-spin"
                          />
                        ) : (
                          <Square size={15} />
                        )}

                        إنهاء الجلسة / End Session
                      </button>
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
                <Play size={19} />
              </div>

              <div>
                <h2 className="font-semibold">
                  جلسة جديدة
                </h2>

                <p
                  dir="ltr"
                  className="mt-1 text-xs text-white/35"
                >
                  Start New Session
                </p>
              </div>
            </div>
          </div>

          <form
            onSubmit={startSession}
            className="space-y-4 p-5"
          >
            <label className="block">
              <span className="mb-2 block text-xs text-white/45">
                اللاعب / Player Name
              </span>

              <div className="relative">
                <UserRound
                  size={17}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/25"
                />

                <input
                  value={customerName}
                  onChange={(event) =>
                    setCustomerName(
                      event.target.value
                    )
                  }
                  placeholder="Guest"
                  className={`${fieldClass} pr-11`}
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs text-white/45">
                الجهاز / Select Device
              </span>

              <select
                value={selectedDeviceId}
                onChange={(event) =>
                  setSelectedDeviceId(
                    event.target.value
                  )
                }
                className={fieldClass}
              >
                <option value="">
                  اختر جهازًا متاحًا
                </option>

                {availableDevices.map((device) => (
                  <option
                    key={device.id}
                    value={device.id}
                  >
                    {device.name} — {device.type}
                  </option>
                ))}
              </select>
            </label>

            {selectedDevice && (
              <div className="rounded-lg border border-violet-400/15 bg-violet-500/[0.06] p-4">
                <div className="flex items-center gap-3">
                  <Monitor
                    size={19}
                    className="text-violet-300"
                  />

                  <div>
                    <p
                      dir="ltr"
                      className="text-sm font-medium"
                    >
                      {selectedDevice.name}
                    </p>

                    <p
                      dir="ltr"
                      className="mt-1 text-xs text-white/35"
                    >
                      {selectedDevice.price || "0"} DA
                      / hour
                    </p>
                  </div>
                </div>
              </div>
            )}

            {availableDevices.length === 0 && (
              <div className="rounded-lg border border-amber-400/20 bg-amber-500/10 p-3 text-xs leading-5 text-amber-200">
                لا توجد أجهزة متاحة حاليًا
                <br />
                No available devices
              </div>
            )}

            <button
              type="submit"
              disabled={
                starting ||
                !selectedDeviceId ||
                availableDevices.length === 0
              }
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-violet-600 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30"
            >
              {starting ? (
                <RefreshCw
                  size={17}
                  className="animate-spin"
                />
              ) : (
                <Play size={17} />
              )}

              {starting
                ? "جارٍ التشغيل..."
                : "بدء الجلسة / Start Session"}
            </button>
          </form>
        </aside>
      </section>
    </div>
  );
}