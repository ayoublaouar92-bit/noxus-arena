import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Minus,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Tags,
  UserRound,
} from "lucide-react";

type Product = {
  id: number;
  name: string;
  sku: string | null;
  unit: string;
  salePrice: number;
  costPrice: number;
  stock: number;
  active: number;
};

type Player = {
  id: number;
  name: string;
  username: string;
  walletBalance: number;
  debtBalance: number;
};

type CartItem = {
  productId: number;
  name: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  stock: number;
  // optional: inferred category
  category: string;
};

const fieldClass =
  "h-10 w-full rounded-lg border border-white/10 bg-[#080b16] px-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-violet-400/60";

function normalizeNumber(value: string) {
  const digitMap: Record<string, string> = {
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
    .map((c) => digitMap[c] ?? c)
    .join("")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");

  const parts = normalized.split(".");
  if (parts.length > 1) normalized = `${parts[0]}.` + parts.slice(1).join("");
  return normalized;
}

function money(value: number) {
  return `${Number(value || 0).toFixed(2)} DA`;
}

// Simple category inference (because backend doesn't have category yet)
// You can later replace with a real DB column.
function inferCategory(product: Product) {
  const name = (product.name || "").toLowerCase();

  if (/(coca|cola|pepsi|fanta|sprite)/.test(name)) return "COLA";
  if (/(juice|jus|orange|ananas|apple)/.test(name)) return "JUICE";
  if (/(energy|red bull|monster)/.test(name)) return "ENERGY DRINKS";
  if (/(water|eau)/.test(name)) return "REFRESHING WATER";
  if (/(candy|choco|bar|gauf|bisc|cake)/.test(name)) return "CANDY BARS";
  if (/(coffee|café)/.test(name)) return "COFFEE";

  return "ALL";
}

export default function Store() {
  const api = (window as any).api;

  const [products, setProducts] = useState<Product[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);

  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<
    "ALL" | "JUICE" | "COLA" | "ENERGY DRINKS" | "REFRESHING WATER" | "CANDY BARS" | "COFFEE"
  >("ALL");

  const [cart, setCart] = useState<CartItem[]>([]);

  // right panel
  const [payment, setPayment] = useState<"cash" | "player">("cash");
  const [playerId, setPlayerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [note, setNote] = useState("");

  async function loadData(showLoading = false) {
    try {
      if (showLoading) setLoading(true);
      setError("");

      const [p, pl] = await Promise.all([
        api.getProducts(),
        api.getPlayers(),
      ]);

      setProducts(p);
      setPlayers(pl);
    } catch (e) {
      console.error(e);
      setError("تعذر تحميل بيانات المتجر");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData(true);
  }, []);

  const activeProducts = useMemo(() => {
    return products
      .filter((p) => Number(p.active) === 1)
      .map((p) => ({
        ...p,
        __category: inferCategory(p),
      }));
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();

    return activeProducts.filter((p: any) => {
      const matchCategory =
        category === "ALL" ? true : (p.__category as string) === category;

      const matchQuery =
        !q ||
        p.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q);

      return matchCategory && matchQuery;
    });
  }, [activeProducts, category, search]);

  const cartCount = cart.reduce((t, i) => t + i.quantity, 0);
  const subtotal = cart.reduce((t, i) => t + i.quantity * i.unitPrice, 0);
  const total = Number(subtotal.toFixed(2));

  function upsertCart(product: any, delta: number) {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);

      const stock = Number(product.stock || 0);
      const categoryName = (product.__category || "ALL") as string;

      if (!existing) {
        const nextQty = Math.max(0, Math.min(stock, delta));
        if (nextQty === 0) return prev;

        return [
          ...prev,
          {
            productId: product.id,
            name: product.name,
            unit: product.unit || "pcs",
            unitPrice: Number(product.salePrice || 0),
            quantity: nextQty,
            stock,
            category: categoryName,
          },
        ];
      }

      const nextQty = Math.max(
        0,
        Math.min(stock, existing.quantity + delta)
      );

      if (nextQty === 0) {
        return prev.filter((i) => i.productId !== product.id);
      }

      return prev.map((i) =>
        i.productId === product.id
          ? {
              ...i,
              quantity: nextQty,
              stock,
              unitPrice: Number(product.salePrice || 0),
              category: categoryName,
            }
          : i
      );
    });
  }

  function setQty(product: any, qty: number) {
    setCart((prev) => {
      const stock = Number(product.stock || 0);
      const safeQty = Math.max(0, Math.min(stock, qty));
      const existing = prev.find((i) => i.productId === product.id);

      if (!existing) {
        if (safeQty === 0) return prev;
        return [
          ...prev,
          {
            productId: product.id,
            name: product.name,
            unit: product.unit || "pcs",
            unitPrice: Number(product.salePrice || 0),
            quantity: safeQty,
            stock,
            category: (product.__category || "ALL") as string,
          },
        ];
      }

      if (safeQty === 0) {
        return prev.filter((i) => i.productId !== product.id);
      }

      return prev.map((i) =>
        i.productId === product.id
          ? {
              ...i,
              quantity: safeQty,
              stock,
              unitPrice: Number(product.salePrice || 0),
            }
          : i
      );
    });
  }

  function clearCart() {
    setCart([]);
  }

  async function checkout(event: FormEvent) {
    event.preventDefault();

    if (cart.length === 0) {
      setError("السلة فارغة");
      return;
    }

    if (payment === "player" && !playerId) {
      setError("اختر لاعبًا");
      return;
    }

    const confirmed = window.confirm(
      `تأكيد الدفع؟\n` +
        `الإجمالي: ${money(total)}\n` +
        `عدد العناصر: ${cartCount}`
    );

    if (!confirmed) return;

    try {
      setCheckingOut(true);
      setError("");

      const payload =
        payment === "cash"
          ? {
              paymentType: "cash" as const,
              customerName: customerName.trim(),
              note: note.trim() || "Store sale",
              items: cart.map((i) => ({
                productId: i.productId,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
              })),
            }
          : {
              paymentType: "player" as const,
              playerId: Number(playerId),
              customerName: customerName.trim(),
              note: note.trim() || "Store sale (player)",
              items: cart.map((i) => ({
                productId: i.productId,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
              })),
            };

      const result = await api.createSale(payload);

      window.alert(
        `تمت العملية\n` +
          `الإجمالي: ${money(result.total)}\n` +
          `نقدًا: ${money(result.cashPaid)}\n` +
          `من المحفظة: ${money(result.walletPaid)}\n` +
          `أضيف للدين: ${money(result.debtAdded)}`
      );

      clearCart();
      setCustomerName("");
      setNote("");

      await loadData(true);
    } catch (e) {
      console.error(e);
      setError("تعذر إتمام العملية (تحقق من المخزون)");
    } finally {
      setCheckingOut(false);
    }
  }

  const tabs: Array<{ id: typeof category; label: string }> = [
    { id: "ALL", label: "ALL" },
    { id: "JUICE", label: "JUICE" },
    { id: "COLA", label: "COLA" },
    { id: "ENERGY DRINKS", label: "ENERGY DRINKS" },
    { id: "REFRESHING WATER", label: "REFRESHING WATER" },
    { id: "CANDY BARS", label: "CANDY BARS" },
    { id: "COFFEE", label: "COFFEE" },
  ];

  return (
    <div dir="rtl" className="space-y-5">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-sm text-violet-300">Point of Sale</p>
          <h1 className="text-3xl font-semibold">المتجر / POS</h1>
          <p className="mt-2 text-sm text-white/45">
            ابحث واختر المنتجات ثم ادفع من اليمين
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadData(true)}
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

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        {/* LEFT: browse */}
        <div className="space-y-4">
          {/* search + tabs */}
          <div className="rounded-xl border border-white/[0.08] bg-[#0c101d] p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-[#080b16] px-3">
                <Search size={16} className="text-white/25" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="بحث..."
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </div>

              <div className="flex items-center gap-2 text-xs text-white/35">
                <ShoppingCart size={14} />
                {cartCount} in cart
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setCategory(t.id)}
                  className={`h-9 rounded-lg border px-3 text-xs transition ${
                    category === t.id
                      ? "border-violet-400/30 bg-violet-600 text-white"
                      : "border-white/10 bg-white/[0.05] text-white/50 hover:border-violet-400/20"
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <Tags size={14} />
                    {t.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* products grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {filteredProducts.map((p: any) => {
              const stock = Number(p.stock || 0);

              const inCart =
                cart.find((i) => i.productId === p.id)?.quantity || 0;

              return (
                <div
                  key={p.id}
                  className="rounded-xl border border-white/[0.08] bg-[#0c101d] overflow-hidden"
                >
                  <div className="h-20 bg-gradient-to-br from-violet-600/20 via-fuchsia-600/10 to-cyan-500/10" />

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{p.name}</p>
                        <p className="mt-1 text-xs text-white/30">
                          {stock} {p.unit}
                        </p>
                      </div>

                      <p dir="ltr" className="text-sm font-semibold text-emerald-300">
                        {money(p.salePrice)}
                      </p>
                    </div>

                    <div className="mt-3 grid grid-cols-[36px_1fr_36px] gap-2 items-center">
                      <button
                        type="button"
                        onClick={() => upsertCart(p, -1)}
                        disabled={inCart <= 0}
                        className="flex h-9 items-center justify-center rounded-lg bg-white/[0.05] text-white/70 disabled:opacity-30"
                      >
                        <Minus size={16} />
                      </button>

                      <input
                        dir="ltr"
                        type="text"
                        inputMode="numeric"
                        value={String(inCart || 0)}
                        onChange={(e) => {
                          const q = Number(normalizeNumber(e.target.value));
                          setQty(p, Number.isFinite(q) ? q : 0);
                        }}
                        className="h-9 rounded-lg border border-white/10 bg-[#080b16] px-3 text-sm outline-none text-center"
                      />

                      <button
                        type="button"
                        onClick={() => upsertCart(p, +1)}
                        disabled={stock <= 0 || inCart >= stock}
                        className="flex h-9 items-center justify-center rounded-lg bg-violet-600 text-white disabled:opacity-30"
                      >
                        <Plus size={16} />
                      </button>
                    </div>

                    <p className="mt-2 text-[10px] text-white/30">
                      Category: {p.__category}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: current order */}
        <aside className="h-fit rounded-xl border border-white/[0.08] bg-[#0c101d]">
          <div className="border-b border-white/[0.08] p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Current Order</h2>
                <p className="mt-1 text-xs text-white/30">
                  {cartCount} items · {money(total)}
                </p>
              </div>

              <button
                type="button"
                onClick={clearCart}
                className="h-9 rounded-lg bg-white/[0.05] px-3 text-xs text-white/60"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="p-5">
            {/* order items */}
            <div className="rounded-xl border border-white/[0.08] bg-[#090d18]">
              {cart.length === 0 ? (
                <div className="p-6 text-center text-sm text-white/35">
                  Cart is empty<br />
                  أضف منتجًا للبدء
                </div>
              ) : (
                <div className="divide-y divide-white/[0.06]">
                  {cart.map((i) => (
                    <div key={i.productId} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{i.name}</p>
                          <p className="mt-1 text-xs text-white/30">
                            {i.category} · {i.unit}
                          </p>
                        </div>

                        <p dir="ltr" className="text-xs text-white/60">
                          {money(i.quantity * i.unitPrice)}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setCart((prev) =>
                              prev
                                .map((x) =>
                                  x.productId === i.productId
                                    ? { ...x, quantity: Math.max(0, x.quantity - 1) }
                                    : x
                                )
                                .filter((x) => x.quantity > 0)
                            )
                          }
                          className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.05] text-white/70"
                        >
                          <Minus size={16} />
                        </button>

                        <input
                          dir="ltr"
                          type="text"
                          inputMode="numeric"
                          value={String(i.quantity)}
                          onChange={(e) => {
                            const q = Number(normalizeNumber(e.target.value));
                            setCart((prev) =>
                              prev.map((x) =>
                                x.productId === i.productId
                                  ? { ...x, quantity: Math.max(1, Math.min(i.stock, Number.isFinite(q) ? q : 1)) }
                                  : x
                              )
                            );
                          }}
                          className="h-9 flex-1 rounded-lg border border-white/10 bg-[#080b16] px-3 text-sm outline-none text-center"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setCart((prev) =>
                              prev.map((x) =>
                                x.productId === i.productId
                                  ? { ...x, quantity: Math.min(i.stock, x.quantity + 1) }
                                  : x
                              )
                            )
                          }
                          disabled={i.quantity >= i.stock}
                          className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600 text-white disabled:opacity-30"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* totals */}
            <div className="mt-4 rounded-xl border border-white/[0.08] bg-[#090d18] p-4 text-sm">
              <div className="flex items-center justify-between text-white/60">
                <span>Subtotal</span>
                <span dir="ltr">{money(total)}</span>
              </div>

              <div className="mt-2 flex items-center justify-between text-white/60">
                <span>Discount</span>
                <span dir="ltr">0.00 DA</span>
              </div>

              <div className="mt-3 h-px bg-white/[0.08]" />

              <div className="mt-3 flex items-center justify-between font-semibold">
                <span>TOTAL</span>
                <span dir="ltr" className="text-emerald-300">
                  {money(total)}
                </span>
              </div>
            </div>

            {/* payment */}
            <form onSubmit={checkout} className="mt-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPayment("cash")}
                  className={`h-11 rounded-lg text-xs ${
                    payment === "cash"
                      ? "bg-emerald-600 text-white"
                      : "bg-white/[0.05] text-white/50"
                  }`}
                >
                  CASH
                </button>

                <button
                  type="button"
                  onClick={() => setPayment("player")}
                  className={`h-11 rounded-lg text-xs ${
                    payment === "player"
                      ? "bg-violet-600 text-white"
                      : "bg-white/[0.05] text-white/50"
                  }`}
                >
                  WALLET
                </button>

                <button
                  type="button"
                  onClick={() => setPayment("player")}
                  className={`h-11 rounded-lg text-xs ${
                    payment === "player"
                      ? "bg-violet-600 text-white"
                      : "bg-white/[0.05] text-white/50"
                  }`}
                >
                  DEBT
                </button>
              </div>

              {payment === "player" && (
                <div className="flex items-center gap-2">
                  <UserRound size={16} className="text-white/25" />
                  <select
                    value={playerId}
                    onChange={(e) => setPlayerId(e.target.value)}
                    className={fieldClass}
                  >
                    <option value="">اختر اللاعب</option>
                    {players.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — Wallet {Number(p.walletBalance || 0).toFixed(2)} / Debt{" "}
                        {Number(p.debtBalance || 0).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className={fieldClass}
                placeholder="Link or create customer (اختياري)"
              />

              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={fieldClass}
                placeholder="ملاحظة (اختياري)"
              />

              <button
                type="submit"
                disabled={checkingOut || cart.length === 0}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-white text-black font-medium disabled:opacity-40"
              >
                {checkingOut ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <ShoppingCart size={16} />
                )}
                Checkout
              </button>

              <p className="text-[10px] leading-5 text-white/30">
                ملاحظة: زر WALLET وDEBT يعملان بنفس الآلية (محفظة ثم دين تلقائيًا).
                إذا تريد “Debt فقط بدون خصم من Wallet” قل لي لنعدّل Backend.
              </p>
            </form>
          </div>
        </aside>
      </section>
    </div>
  );
}