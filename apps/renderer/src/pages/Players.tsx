import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Camera,
  CircleDollarSign,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";

type Player = {
  id: number;
  name: string;
  username: string;
  phone: string | null;
  balance: number;
  image: string | null;
  createdAt: string;
};

const fieldClass =
  "h-11 w-full rounded-lg border border-white/10 bg-[#080b16] px-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/10";

export default function Players() {
  const [players, setPlayers] =
    useState<Player[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [deletingId, setDeletingId] =
    useState<number | null>(null);

  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [name, setName] = useState("");

  const [username, setUsername] =
    useState("");

  const [phone, setPhone] = useState("");

  const [balance, setBalance] =
    useState("");

  const [image, setImage] = useState("");

  const api = (window as any).api;

  async function loadPlayers(
    showLoading = false
  ) {
    try {
      if (showLoading) {
        setLoading(true);
      }

      setError("");

      const result = await api.getPlayers();
      setPlayers(result);
    } catch (loadError) {
      console.error(loadError);

      setError(
        "تعذر تحميل اللاعبين / Failed to load players"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPlayers(true);
  }, []);

  function chooseImage(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError(
        "اختر ملف صورة صالحًا / Select a valid image"
      );
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError(
        "حجم الصورة يجب ألا يتجاوز 2MB / Image must be smaller than 2MB"
      );
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setImage(String(reader.result || ""));
      setError("");
    };

    reader.onerror = () => {
      setError(
        "تعذر قراءة الصورة / Failed to read image"
      );
    };

    reader.readAsDataURL(file);
  }

  async function addPlayer(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const cleanName = name.trim();

    const cleanUsername = username
      .trim()
      .replace(/^@/, "");

    if (!cleanName) {
      setError(
        "أدخل اسم اللاعب / Player name is required"
      );
      return;
    }

    if (!cleanUsername) {
      setError(
        "أدخل اسم المستخدم / Username is required"
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

      await api.addPlayer({
        name: cleanName,
        username: cleanUsername,
        phone: phone.trim(),
        balance: Number(balance || 0),
        image,
      });

      setName("");
      setUsername("");
      setPhone("");
      setBalance("");
      setImage("");

      await loadPlayers();
    } catch (saveError) {
      console.error(saveError);

      const message =
        saveError instanceof Error
          ? saveError.message
          : "";

      if (
        message
          .toLowerCase()
          .includes("username")
      ) {
        setError(
          "اسم المستخدم موجود مسبقًا / Username already exists"
        );
      } else {
        setError(
          "تعذرت إضافة اللاعب / Failed to add player"
        );
      }
    } finally {
      setSaving(false);
    }
  }

  async function deletePlayer(
    player: Player
  ) {
    const confirmed = window.confirm(
      `هل تريد حذف ${player.name}؟\nDelete this player?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(player.id);
      setError("");

      await api.deletePlayer(player.id);
      await loadPlayers();
    } catch (deleteError) {
      console.error(deleteError);

      setError(
        "تعذر حذف اللاعب / Failed to delete player"
      );
    } finally {
      setDeletingId(null);
    }
  }

  function getInitials(playerName: string) {
    return playerName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }

  const filteredPlayers = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    if (!query) {
      return players;
    }

    return players.filter((player) => {
      return (
        player.name
          .toLowerCase()
          .includes(query) ||
        player.username
          .toLowerCase()
          .includes(query) ||
        player.phone
          ?.toLowerCase()
          .includes(query)
      );
    });
  }, [players, search]);

  const positiveBalance = players.reduce(
    (total, player) =>
      total +
      Math.max(
        0,
        Number(player.balance || 0)
      ),
    0
  );

  const totalDebt = players.reduce(
    (total, player) =>
      total +
      Math.abs(
        Math.min(
          0,
          Number(player.balance || 0)
        )
      ),
    0
  );

  const profilesWithPhone = players.filter(
    (player) => Boolean(player.phone)
  ).length;

  const stats = [
    {
      label: "إجمالي اللاعبين",
      english: "Total Players",
      value: players.length,
      icon: Users,
      color: "text-violet-300",
      surface: "bg-violet-500/10",
    },
    {
      label: "أرصدة اللاعبين",
      english: "Wallet Balance",
      value: `${positiveBalance.toFixed(2)} DA`,
      icon: Wallet,
      color: "text-emerald-300",
      surface: "bg-emerald-500/10",
    },
    {
      label: "إجمالي الديون",
      english: "Total Debt",
      value: `${totalDebt.toFixed(2)} DA`,
      icon: CircleDollarSign,
      color: "text-rose-300",
      surface: "bg-rose-500/10",
    },
    {
      label: "ملفات مكتملة",
      english: "Complete Profiles",
      value: profilesWithPhone,
      icon: UserRound,
      color: "text-sky-300",
      surface: "bg-sky-500/10",
    },
  ];

  return (
    <div dir="rtl" className="space-y-6">
      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm text-violet-300">
            <Users size={16} />
            Player Management
          </div>

          <h1 className="text-3xl font-semibold tracking-tight">
            اللاعبون

            <span
              dir="ltr"
              className="mr-3 text-lg font-normal text-white/35"
            >
              / Players
            </span>
          </h1>

          <p className="mt-2 text-sm text-white/45">
            إدارة ملفات اللاعبين وأرصدتهم
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            void loadPlayers(true)
          }
          disabled={loading}
          className="flex h-11 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm text-white/60 transition hover:border-violet-400/30 hover:text-white disabled:opacity-50"
        >
          <RefreshCw
            size={17}
            className={
              loading ? "animate-spin" : ""
            }
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
              <div className="flex items-start justify-between gap-3">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${stat.surface}`}
                >
                  <Icon
                    size={21}
                    className={stat.color}
                  />
                </div>

                <span
                  dir="ltr"
                  className="text-xl font-semibold"
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

      {error && (
        <div className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <article className="min-w-0 rounded-xl border border-white/[0.08] bg-[#0c101d]">
          <div className="border-b border-white/[0.08] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-semibold">
                  مجتمع اللاعبين
                </h2>

                <p
                  dir="ltr"
                  className="mt-1 text-xs text-white/30"
                >
                  Player Community
                </p>
              </div>

              <div className="flex h-10 min-w-64 items-center gap-2 rounded-lg border border-white/10 bg-[#080b16] px-3">
                <Search
                  size={17}
                  className="shrink-0 text-white/25"
                />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  placeholder="بحث / Search players"
                  className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/25"
                />
              </div>
            </div>
          </div>

          <div className="p-5">
            {loading ? (
              <div className="flex min-h-80 items-center justify-center text-sm text-white/40">
                جارٍ تحميل اللاعبين...
              </div>
            ) : filteredPlayers.length ===
              0 ? (
              <div className="flex min-h-80 flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300">
                  <Users size={27} />
                </div>

                <p className="font-medium">
                  لا يوجد لاعبون
                </p>

                <p
                  dir="ltr"
                  className="mt-2 text-sm text-white/35"
                >
                  Add the first player from the panel
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {filteredPlayers.map(
                  (player) => {
                    const playerBalance =
                      Number(
                        player.balance || 0
                      );

                    return (
                      <article
                        key={player.id}
                        className="group overflow-hidden rounded-xl border border-white/[0.08] bg-[#090d18] transition hover:-translate-y-0.5 hover:border-violet-400/30"
                      >
                        <div className="relative h-20 bg-gradient-to-br from-violet-600/20 via-fuchsia-600/10 to-cyan-500/10">
                          <button
                            type="button"
                            onClick={() =>
                              void deletePlayer(
                                player
                              )
                            }
                            disabled={
                              deletingId ===
                              player.id
                            }
                            className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg border border-rose-400/15 bg-[#090d18]/80 text-rose-300 opacity-0 transition hover:bg-rose-500/15 group-hover:opacity-100 disabled:opacity-40"
                          >
                            {deletingId ===
                            player.id ? (
                              <RefreshCw
                                size={15}
                                className="animate-spin"
                              />
                            ) : (
                              <Trash2
                                size={15}
                              />
                            )}
                          </button>
                        </div>

                        <div className="relative px-4 pb-4">
                          <div className="-mt-9 mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border-4 border-[#090d18] bg-gradient-to-br from-violet-500 to-fuchsia-600 text-lg font-bold">
                            {player.image ? (
                              <img
                                src={
                                  player.image
                                }
                                alt={player.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              getInitials(
                                player.name
                              )
                            )}
                          </div>

                          <h3 className="truncate font-semibold">
                            {player.name}
                          </h3>

                          <p
                            dir="ltr"
                            className="mt-1 truncate text-xs text-violet-300"
                          >
                            @{player.username}
                          </p>

                          <div className="my-4 h-px bg-white/[0.08]" />

                          <div className="space-y-3 text-xs">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-white/30">
                                الهاتف / Phone
                              </span>

                              <span
                                dir="ltr"
                                className="truncate text-white/65"
                              >
                                {player.phone ||
                                  "Not set"}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-3">
                              <span className="text-white/30">
                                الرصيد / Balance
                              </span>

                              <span
                                dir="ltr"
                                className={
                                  playerBalance >=
                                  0
                                    ? "font-medium text-emerald-300"
                                    : "font-medium text-rose-300"
                                }
                              >
                                {playerBalance.toFixed(
                                  2
                                )}{" "}
                                DA
                              </span>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  }
                )}
              </div>
            )}
          </div>
        </article>

        <aside className="h-fit rounded-xl border border-violet-400/15 bg-[#0c101d]">
          <div className="border-b border-white/[0.08] p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300">
                <UserPlus size={20} />
              </div>

              <div>
                <h2 className="font-semibold">
                  إضافة لاعب
                </h2>

                <p
                  dir="ltr"
                  className="mt-1 text-xs text-white/30"
                >
                  Create Player Profile
                </p>
              </div>
            </div>
          </div>

          <form
            onSubmit={addPlayer}
            className="space-y-4 p-5"
          >
            <label className="block cursor-pointer">
              <span className="mb-2 block text-xs text-white/45">
                الصورة / Profile Image
              </span>

              <div className="flex min-h-32 items-center justify-center overflow-hidden rounded-lg border border-dashed border-white/15 bg-[#080b16] transition hover:border-violet-400/40">
                {image ? (
                  <img
                    src={image}
                    alt="Player preview"
                    className="h-36 w-full object-cover"
                  />
                ) : (
                  <div className="text-center">
                    <Camera
                      size={23}
                      className="mx-auto text-white/25"
                    />

                    <p className="mt-2 text-xs text-white/35">
                      اختر صورة / Choose Image
                    </p>

                    <p className="mt-1 text-[10px] text-white/20">
                      Maximum 2MB
                    </p>
                  </div>
                )}
              </div>

              <input
                type="file"
                accept="image/*"
                onChange={chooseImage}
                className="hidden"
              />
            </label>

            {image && (
              <button
                type="button"
                onClick={() => setImage("")}
                className="text-xs text-rose-300 transition hover:text-rose-200"
              >
                حذف الصورة / Remove Image
              </button>
            )}

            <label className="block">
              <span className="mb-2 block text-xs text-white/45">
                الاسم الكامل / Full Name
              </span>

              <input
                value={name}
                onChange={(event) =>
                  setName(event.target.value)
                }
                placeholder="Ayoub Laouar"
                className={fieldClass}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs text-white/45">
                اسم المستخدم / Username
              </span>

              <input
                dir="ltr"
                value={username}
                onChange={(event) =>
                  setUsername(
                    event.target.value
                  )
                }
                placeholder="@player"
                className={fieldClass}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs text-white/45">
                الهاتف / Phone
              </span>

              <input
                dir="ltr"
                value={phone}
                onChange={(event) =>
                  setPhone(event.target.value)
                }
                placeholder="+213"
                className={fieldClass}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs text-white/45">
                الرصيد أو الدين / Balance
              </span>

              <div className="relative">
                <input
                  dir="ltr"
                  type="number"
                  step="0.01"
                  value={balance}
                  onChange={(event) =>
                    setBalance(
                      event.target.value
                    )
                  }
                  placeholder="0"
                  className={`${fieldClass} pl-14`}
                />

                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-white/30">
                  DA
                </span>
              </div>
            </label>

            <button
              type="submit"
              disabled={saving}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-violet-600 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <RefreshCw
                  size={17}
                  className="animate-spin"
                />
              ) : (
                <UserPlus size={17} />
              )}

              {saving
                ? "جارٍ الحفظ..."
                : "إضافة اللاعب / Add Player"}
            </button>
          </form>
        </aside>
      </section>
    </div>
  );
}