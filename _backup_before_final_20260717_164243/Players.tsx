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
  PlusCircle,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
  Users,
  Wallet,
  X,
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

const fieldClass =
  "h-11 w-full rounded-lg border border-white/10 bg-[#080b16] px-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/10";

function normalizeMoneyInput(
  value: string
) {
  const digitMap:
    Record<string, string> = {
    "&": "1",
    "é": "2",
    '"': "3",
    "'": "4",
    "(": "5",
    "-": "6",
    "è": "7",
    "_": "8",
    "ç": "9",
    "à": "0",

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

  let normalized = value
    .split("")
    .map(
      (character) =>
        digitMap[character] ??
        character
    )
    .join("")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");

  const parts =
    normalized.split(".");

  if (parts.length > 1) {
    normalized =
      `${parts[0]}.` +
      parts.slice(1).join("");
  }

  return normalized;
}

export default function Players() {
  const [players, setPlayers] =
    useState<Player[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [deletingId, setDeletingId] =
    useState<number | null>(null);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [name, setName] =
    useState("");

  const [username, setUsername] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [
    initialDeposit,
    setInitialDeposit,
  ] = useState("");

  const [image, setImage] =
    useState("");

  const [topUpPlayer, setTopUpPlayer] =
    useState<Player | null>(null);

  const [
    topUpAmount,
    setTopUpAmount,
  ] = useState("");

  const [topUpNote, setTopUpNote] =
    useState("");

  const [
    topUpSaving,
    setTopUpSaving,
  ] = useState(false);

  const api = (window as any).api;

  async function loadPlayers(
    showLoading = false
  ) {
    try {
      if (showLoading) {
        setLoading(true);
      }

      setError("");

      const result =
        await api.getPlayers();

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
    event:
      ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    if (
      !file.type.startsWith(
        "image/"
      )
    ) {
      setError(
        "اختر صورة صالحة"
      );
      return;
    }

    if (
      file.size >
      2 * 1024 * 1024
    ) {
      setError(
        "حجم الصورة يجب ألا يتجاوز 2MB"
      );
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setImage(
        String(reader.result || "")
      );

      setError("");
    };

    reader.onerror = () => {
      setError(
        "تعذر قراءة الصورة"
      );
    };

    reader.readAsDataURL(file);
  }

  async function addPlayer(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const cleanName =
      name.trim();

    const cleanUsername =
      username
        .trim()
        .replace(/^@/, "");

    if (
      !cleanName ||
      !cleanUsername
    ) {
      setError(
        "الاسم واسم المستخدم مطلوبان"
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

        initialDeposit: Number(
          initialDeposit || 0
        ),

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

      setError(
        "تعذرت إضافة اللاعب أو اسم المستخدم موجود مسبقًا"
      );
    } finally {
      setSaving(false);
    }
  }

  async function submitTopUp(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!topUpPlayer) {
      return;
    }

    const amount =
      Number(topUpAmount);

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setError(
        "أدخل مبلغًا صحيحًا"
      );
      return;
    }

    try {
      setTopUpSaving(true);
      setError("");

      const result =
        await api.topUpPlayer({
          playerId:
            topUpPlayer.id,

          amount,

          note:
            topUpNote.trim(),
        });

      window.alert(
        `تم استلام: ${result.amount} DA\n` +
          `تم سداد الدين: ${result.debtPaid} DA\n` +
          `أضيف للمحفظة: ${result.walletAdded} DA`
      );

      setTopUpPlayer(null);
      setTopUpAmount("");
      setTopUpNote("");

      await loadPlayers();
    } catch (topUpError) {
      console.error(topUpError);

      setError(
        "تعذر شحن المحفظة"
      );
    } finally {
      setTopUpSaving(false);
    }
  }

  async function deletePlayer(
    player: Player
  ) {
    const confirmed =
      window.confirm(
        `هل تريد حذف ${player.name}؟`
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(player.id);
      setError("");

      await api.deletePlayer(
        player.id
      );

      await loadPlayers();
    } catch (deleteError) {
      console.error(deleteError);

      setError(
        "لا يمكن حذف لاعب لديه سجل جلسات"
      );
    } finally {
      setDeletingId(null);
    }
  }

  function getInitials(
    playerName: string
  ) {
    return playerName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }

  const filteredPlayers =
    useMemo(() => {
      const query = search
        .trim()
        .toLowerCase();

      if (!query) {
        return players;
      }

      return players.filter(
        (player) =>
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
    }, [players, search]);

  const totalWallet =
    players.reduce(
      (total, player) =>
        total +
        Number(
          player.walletBalance || 0
        ),
      0
    );

  const totalDebt =
    players.reduce(
      (total, player) =>
        total +
        Number(
          player.debtBalance || 0
        ),
      0
    );

  const playersWithDebt =
    players.filter(
      (player) =>
        Number(
          player.debtBalance || 0
        ) > 0
    ).length;

  const stats = [
    {
      label: "إجمالي اللاعبين",
      english: "Total Players",
      value: players.length,
      icon: Users,
      color: "text-violet-300",
      surface:
        "bg-violet-500/10",
    },
    {
      label: "أموال المحافظ",
      english: "Wallet Funds",
      value:
        `${totalWallet.toFixed(2)} DA`,
      icon: Wallet,
      color: "text-emerald-300",
      surface:
        "bg-emerald-500/10",
    },
    {
      label: "إجمالي الديون",
      english: "Total Debt",
      value:
        `${totalDebt.toFixed(2)} DA`,
      icon: CircleDollarSign,
      color: "text-rose-300",
      surface:
        "bg-rose-500/10",
    },
    {
      label: "لاعبون عليهم دين",
      english:
        "Players With Debt",
      value: playersWithDebt,
      icon: CircleDollarSign,
      color: "text-amber-300",
      surface:
        "bg-amber-500/10",
    },
  ];

  return (
    <div
      dir="rtl"
      className="space-y-6"
    >
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-sm text-violet-300">
            Players & Members
          </p>

          <h1 className="text-3xl font-semibold">
            اللاعبون والأعضاء
          </h1>

          <p className="mt-2 text-sm text-white/45">
            إدارة المحفظة والدين
            وملفات اللاعبين
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            void loadPlayers(true)
          }
          disabled={loading}
          className="flex h-11 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm"
        >
          <RefreshCw
            size={17}
            className={
              loading
                ? "animate-spin"
                : ""
            }
          />

          تحديث
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
                  className={`flex h-11 w-11 items-center justify-center rounded-lg ${stat.surface}`}
                >
                  <Icon
                    size={21}
                    className={
                      stat.color
                    }
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
        <article className="rounded-xl border border-white/[0.08] bg-[#0c101d]">
          <div className="flex flex-col gap-4 border-b border-white/[0.08] p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-semibold">
                مجتمع اللاعبين
              </h2>

              <p className="mt-1 text-xs text-white/30">
                Player Community
              </p>
            </div>

            <div className="flex h-10 min-w-64 items-center gap-2 rounded-lg border border-white/10 bg-[#080b16] px-3">
              <Search
                size={17}
                className="text-white/25"
              />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="بحث / Search"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </div>
          </div>

          <div className="p-5">
            {loading ? (
              <div className="flex min-h-72 items-center justify-center text-white/40">
                جارٍ التحميل...
              </div>
            ) : filteredPlayers.length ===
              0 ? (
              <div className="flex min-h-72 flex-col items-center justify-center text-center">
                <Users
                  size={30}
                  className="mb-3 text-white/20"
                />

                <p>
                  لا يوجد لاعبون
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {filteredPlayers.map(
                  (player) => (
                    <article
                      key={player.id}
                      className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#090d18] transition hover:border-violet-400/30"
                    >
                      <div className="h-16 bg-gradient-to-br from-violet-600/20 via-fuchsia-600/10 to-cyan-500/10" />

                      <div className="px-4 pb-4">
                        <div className="-mt-8 mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border-4 border-[#090d18] bg-gradient-to-br from-violet-500 to-fuchsia-600 font-bold">
                          {player.image ? (
                            <img
                              src={
                                player.image
                              }
                              alt={
                                player.name
                              }
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
                          className="mt-1 text-xs text-violet-300"
                        >
                          @{player.username}
                        </p>

                        <div className="my-4 grid grid-cols-2 gap-2">
                          <div className="rounded-lg bg-emerald-500/[0.07] p-3">
                            <p className="text-[10px] text-white/35">
                              المحفظة
                            </p>

                            <p
                              dir="ltr"
                              className="mt-1 text-sm font-semibold text-emerald-300"
                            >
                              {Number(
                                player.walletBalance ||
                                  0
                              ).toFixed(2)}{" "}
                              DA
                            </p>
                          </div>

                          <div className="rounded-lg bg-rose-500/[0.07] p-3">
                            <p className="text-[10px] text-white/35">
                              الدين
                            </p>

                            <p
                              dir="ltr"
                              className="mt-1 text-sm font-semibold text-rose-300"
                            >
                              {Number(
                                player.debtBalance ||
                                  0
                              ).toFixed(2)}{" "}
                              DA
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setTopUpPlayer(
                                player
                              );

                              setTopUpAmount(
                                ""
                              );

                              setTopUpNote(
                                ""
                              );
                            }}
                            className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-violet-600 text-xs font-medium"
                          >
                            <PlusCircle
                              size={15}
                            />

                            شحن
                          </button>

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
                            className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-300"
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
                      </div>
                    </article>
                  )
                )}
              </div>
            )}
          </div>
        </article>

        <aside className="h-fit rounded-xl border border-violet-400/15 bg-[#0c101d]">
          <div className="border-b border-white/[0.08] p-5">
            <h2 className="font-semibold">
              إضافة لاعب
            </h2>

            <p className="mt-1 text-xs text-white/30">
              Create Player
            </p>
          </div>

          <form
            onSubmit={addPlayer}
            className="space-y-4 p-5"
          >
            <label className="block cursor-pointer">
              <div className="flex h-28 items-center justify-center overflow-hidden rounded-lg border border-dashed border-white/15 bg-[#080b16]">
                {image ? (
                  <img
                    src={image}
                    alt="Preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="text-center">
                    <Camera className="mx-auto text-white/25" />

                    <p className="mt-2 text-xs text-white/35">
                      اختر صورة
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

            <input
              value={name}
              onChange={(event) =>
                setName(
                  event.target.value
                )
              }
              placeholder="الاسم الكامل"
              className={fieldClass}
            />

            <input
              dir="ltr"
              value={username}
              onChange={(event) =>
                setUsername(
                  event.target.value
                )
              }
              placeholder="@username"
              className={fieldClass}
            />

            <input
              dir="ltr"
              value={phone}
              onChange={(event) =>
                setPhone(
                  event.target.value
                )
              }
              placeholder="Phone"
              className={fieldClass}
            />

            <input
              dir="ltr"
              type="text"
              inputMode="decimal"
              value={initialDeposit}
              onChange={(event) =>
                setInitialDeposit(
                  normalizeMoneyInput(
                    event.target.value
                  )
                )
              }
              placeholder="Initial deposit DA"
              className={fieldClass}
            />

            <button
              type="submit"
              disabled={saving}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-violet-600 text-sm font-medium disabled:opacity-50"
            >
              {saving ? (
                <RefreshCw
                  size={17}
                  className="animate-spin"
                />
              ) : (
                <UserPlus size={17} />
              )}

              إضافة اللاعب
            </button>
          </form>
        </aside>
      </section>

      {topUpPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-violet-400/20 bg-[#0c101d]">
            <div className="flex items-center justify-between border-b border-white/[0.08] p-5">
              <div>
                <h2 className="font-semibold">
                  شحن محفظة
                </h2>

                <p className="mt-1 text-xs text-violet-300">
                  {topUpPlayer.name}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setTopUpPlayer(null)
                }
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.05]"
              >
                <X size={17} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 p-5 pb-0">
              <div className="rounded-lg bg-emerald-500/[0.07] p-3">
                <p className="text-xs text-white/35">
                  المحفظة
                </p>

                <p className="mt-1 text-emerald-300">
                  {Number(
                    topUpPlayer.walletBalance ||
                      0
                  ).toFixed(2)}{" "}
                  DA
                </p>
              </div>

              <div className="rounded-lg bg-rose-500/[0.07] p-3">
                <p className="text-xs text-white/35">
                  الدين
                </p>

                <p className="mt-1 text-rose-300">
                  {Number(
                    topUpPlayer.debtBalance ||
                      0
                  ).toFixed(2)}{" "}
                  DA
                </p>
              </div>
            </div>

            <form
              onSubmit={submitTopUp}
              className="space-y-4 p-5"
            >
              <input
                dir="ltr"
                type="text"
                inputMode="decimal"
                value={topUpAmount}
                onChange={(event) =>
                  setTopUpAmount(
                    normalizeMoneyInput(
                      event.target.value
                    )
                  )
                }
                placeholder="Amount DA"
                className={fieldClass}
              />

              <input
                value={topUpNote}
                onChange={(event) =>
                  setTopUpNote(
                    event.target.value
                  )
                }
                placeholder="ملاحظة اختيارية"
                className={fieldClass}
              />

              <p className="text-xs leading-5 text-white/35">
                سيتم سداد الدين أولًا،
                ثم يضاف المبلغ المتبقي
                إلى المحفظة.
              </p>

              <button
                type="submit"
                disabled={topUpSaving}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-violet-600 font-medium disabled:opacity-50"
              >
                {topUpSaving ? (
                  <RefreshCw
                    size={17}
                    className="animate-spin"
                  />
                ) : (
                  <Wallet size={17} />
                )}

                تأكيد الشحن
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}