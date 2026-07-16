import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import {
  Box,
  Palette,
  Plus,
  RefreshCw,
  Trash2,
  Tags,
  Image as ImageIcon,
  X,
  Pencil,
  Save,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

type Category = {
  id: number;
  name: string;
  color: string | null;
  sortOrder: number;
  active: number;
  createdAt: string;
};

type Product = {
  id: number;
  name: string;
  sku: string | null;
  unit: string;
  salePrice: number;
  costPrice: number;
  stock: number;
  active: number;
  categoryId: number | null;
  categoryName?: string | null;
  categoryColor?: string | null;
  image?: string | null;
  createdAt: string;
};

const fieldClass =
  "h-11 w-full rounded-lg border border-white/10 bg-[#080b16] px-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-violet-400/60";

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

export default function Inventory() {
  const api = (window as any).api;

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [loading, setLoading] = useState(true);
  const [savingProduct, setSavingProduct] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [error, setError] = useState("");

  // Product add form
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [salePrice, setSalePrice] = useState("0");
  const [costPrice, setCostPrice] = useState("0");
  const [initialStock, setInitialStock] = useState("0");
  const [categoryId, setCategoryId] = useState<string>(""); // empty -> Other
  const [image, setImage] = useState<string>("");

  // Category form
  const [catName, setCatName] = useState("");
  const [catColor, setCatColor] = useState("#64748b");
  const [catSort, setCatSort] = useState("0");

  // Edit modal state
  const [editing, setEditing] = useState<Product | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const [editName, setEditName] = useState("");
  const [editSku, setEditSku] = useState("");
  const [editUnit, setEditUnit] = useState("pcs");
  const [editSalePrice, setEditSalePrice] = useState("0");
  const [editCostPrice, setEditCostPrice] = useState("0");
  const [editCategoryId, setEditCategoryId] = useState<string>("");
  const [editImage, setEditImage] = useState<string>("");
  const [editActive, setEditActive] = useState(true);

  async function load(showLoading = false) {
    try {
      if (showLoading) setLoading(true);
      setError("");

      const [p, c] = await Promise.all([api.getProducts(), api.getCategories()]);
      setProducts(p);
      setCategories(c);
    } catch (e) {
      console.error(e);
      setError("تعذر تحميل المخزون");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(true);
  }, []);

  function chooseImage(setter: (value: string) => void) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        setError("اختر صورة صالحة");
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        setError("حجم الصورة يجب ألا يتجاوز 2MB");
        return;
      }

      const reader = new FileReader();

      reader.onload = () => {
        setter(String(reader.result || ""));
        setError("");
      };

      reader.onerror = () => setError("تعذر قراءة الصورة");

      reader.readAsDataURL(file);
    };
  }

  async function addCategory(event: FormEvent) {
    event.preventDefault();

    if (!catName.trim()) {
      setError("أدخل اسم التصنيف");
      return;
    }

    try {
      setSavingCategory(true);
      setError("");

      await api.addCategory({
        name: catName.trim(),
        color: catColor.trim(),
        sortOrder: Number(catSort || 0),
        active: true,
      });

      setCatName("");
      setCatColor("#64748b");
      setCatSort("0");

      await load(true);
    } catch (e) {
      console.error(e);
      setError("تعذر إضافة التصنيف (قد يكون موجودًا)");
    } finally {
      setSavingCategory(false);
    }
  }

  async function deleteCategory(category: Category) {
    if (!window.confirm(`حذف التصنيف: ${category.name}؟`)) return;

    try {
      await api.deleteCategory(category.id);
      await load(true);
    } catch (e) {
      console.error(e);
      setError("تعذر حذف/تعطيل التصنيف");
    }
  }

  async function addProduct(event: FormEvent) {
    event.preventDefault();

    if (!name.trim()) {
      setError("أدخل اسم المنتج");
      return;
    }

    try {
      setSavingProduct(true);
      setError("");

      await api.addProduct({
        name: name.trim(),
        sku: sku.trim(),
        unit: unit.trim(),
        salePrice: Number(salePrice || 0),
        costPrice: Number(costPrice || 0),
        initialStock: Number(initialStock || 0),
        active: true,
        categoryId: categoryId ? Number(categoryId) : null,
        image: image || null,
      });

      setName("");
      setSku("");
      setUnit("pcs");
      setSalePrice("0");
      setCostPrice("0");
      setInitialStock("0");
      setCategoryId("");
      setImage("");

      await load(true);
    } catch (e) {
      console.error(e);
      setError("تعذر إضافة المنتج");
    } finally {
      setSavingProduct(false);
    }
  }

  async function removeProduct(product: Product) {
    if (!window.confirm(`حذف/تعطيل المنتج: ${product.name}؟`)) return;

    try {
      await api.deleteProduct(product.id);
      await load(true);
    } catch (e) {
      console.error(e);
      setError("تعذر حذف/تعطيل المنتج");
    }
  }

  async function quickStock(product: Product, quantity: number) {
    try {
      await api.moveStock({
        productId: product.id,
        quantity,
        reason: "ADJUSTMENT",
        note: "Quick adjust",
      });

      await load();
    } catch (e) {
      console.error(e);
      setError("تعذر تعديل المخزون");
    }
  }

  function openEdit(product: Product) {
    setEditing(product);

    setEditName(product.name || "");
    setEditSku(product.sku || "");
    setEditUnit(product.unit || "pcs");
    setEditSalePrice(String(Number(product.salePrice || 0)));
    setEditCostPrice(String(Number(product.costPrice || 0)));
    setEditCategoryId(product.categoryId ? String(product.categoryId) : "");
    setEditImage(product.image || "");
    setEditActive(Number(product.active) === 1);
  }

  function closeEdit() {
    setEditing(null);
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();

    if (!editing) return;

    if (!editName.trim()) {
      setError("اسم المنتج مطلوب");
      return;
    }

    try {
      setEditSaving(true);
      setError("");

      await api.updateProduct({
        productId: editing.id,
        name: editName.trim(),
        sku: editSku.trim(),
        unit: editUnit.trim(),
        salePrice: Number(editSalePrice || 0),
        costPrice: Number(editCostPrice || 0),
        categoryId: editCategoryId ? Number(editCategoryId) : null,
        image: editImage ? editImage : null,
        active: editActive,
      });

      closeEdit();
      await load(true);
    } catch (e) {
      console.error(e);
      setError("تعذر حفظ التعديلات");
    } finally {
      setEditSaving(false);
    }
  }

  const activeCount = useMemo(
    () => products.filter((p) => Number(p.active) === 1).length,
    [products]
  );

  return (
    <div dir="rtl" className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-sm text-violet-300">Stock & Categories</p>
          <h1 className="text-3xl font-semibold">المخزون / Inventory</h1>
          <p className="mt-2 text-sm text-white/45">
            إدارة التصنيفات والمنتجات (نشطة: {activeCount})
          </p>
        </div>

        <button
          type="button"
          onClick={() => void load(true)}
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

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        {/* PRODUCTS LIST */}
        <article className="rounded-xl border border-white/[0.08] bg-[#0c101d]">
          <div className="border-b border-white/[0.08] p-5">
            <div className="flex items-center gap-2 text-sm text-violet-300">
              <Box size={16} />
              المنتجات / Products
            </div>
          </div>

          <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
            {products.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-white/[0.08] bg-[#090d18] overflow-hidden"
              >
                <div className="h-24 bg-gradient-to-br from-violet-600/20 via-fuchsia-600/10 to-cyan-500/10" />

                <div className="-mt-12 px-4">
                  <div className="h-24 w-24 overflow-hidden rounded-xl border-4 border-[#090d18] bg-white/[0.03]">
                    {p.image ? (
                      <img
                        src={p.image}
                        alt={p.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-white/20">
                        <ImageIcon />
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-4 pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{p.name}</p>

                      <p className="mt-1 text-xs text-white/35">
                        التصنيف: {p.categoryName || "Other"} · الوحدة: {p.unit}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.05] text-white/70"
                      title="تعديل"
                    >
                      <Pencil size={16} />
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-white/[0.03] p-3">
                      <p className="text-white/30">سعر البيع</p>
                      <p dir="ltr" className="mt-1 text-emerald-300">
                        {money(p.salePrice)}
                      </p>
                    </div>

                    <div className="rounded-lg bg-white/[0.03] p-3">
                      <p className="text-white/30">المخزون</p>
                      <p className="mt-1 text-sky-300">
                        {Number(p.stock || 0)} {p.unit}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => void quickStock(p, 1)}
                      className="h-9 rounded-lg bg-emerald-500/15 text-xs text-emerald-300"
                    >
                      +1 مخزون
                    </button>

                    <button
                      type="button"
                      onClick={() => void quickStock(p, -1)}
                      className="h-9 rounded-lg bg-rose-500/15 text-xs text-rose-300"
                    >
                      -1 مخزون
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => void removeProduct(p)}
                    className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-rose-500/10 text-xs text-rose-300"
                  >
                    <Trash2 size={15} />
                    حذف / تعطيل
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>

        {/* RIGHT SIDE: FORMS */}
        <aside className="space-y-6">
          {/* CATEGORIES */}
          <article className="rounded-xl border border-violet-400/15 bg-[#0c101d]">
            <div className="border-b border-white/[0.08] p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300">
                  <Tags size={18} />
                </div>
                <div>
                  <h2 className="font-semibold">التصنيفات / Categories</h2>
                  <p className="mt-1 text-xs text-white/30">إضافة/حذف/ترتيب</p>
                </div>
              </div>
            </div>

            <form onSubmit={addCategory} className="space-y-4 p-5">
              <label className="block">
                <span className="mb-2 block text-xs text-white/45">اسم التصنيف</span>
                <input
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="مثال: Drinks"
                  className={fieldClass}
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-2 block text-xs text-white/45">لون (اختياري)</span>
                  <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#080b16] px-3">
                    <Palette size={16} className="text-white/25" />
                    <input
                      dir="ltr"
                      type="text"
                      value={catColor}
                      onChange={(e) => setCatColor(e.target.value)}
                      className="h-10 w-full bg-transparent text-sm outline-none"
                      placeholder="#64748b"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs text-white/45">الترتيب</span>
                  <input
                    dir="ltr"
                    type="text"
                    inputMode="numeric"
                    value={catSort}
                    onChange={(e) =>
                      setCatSort(normalizeNumber(e.target.value).replace(".", ""))
                    }
                    placeholder="0"
                    className={fieldClass}
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={savingCategory}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-violet-600 text-sm font-medium disabled:opacity-50"
              >
                {savingCategory ? (
                  <RefreshCw size={17} className="animate-spin" />
                ) : (
                  <Plus size={17} />
                )}
                إضافة تصنيف
              </button>

              <div className="rounded-xl border border-white/[0.08] bg-[#090d18]">
                <div className="p-3 text-xs text-white/35">التصنيفات الحالية</div>

                <div className="divide-y divide-white/[0.06]">
                  {categories.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-3 p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{c.name}</p>
                        <p className="mt-1 text-[10px] text-white/30">
                          {c.color || "—"} · ترتيب {Number(c.sortOrder || 0)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => void deleteCategory(c)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-300"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </form>
          </article>

          {/* ADD PRODUCT */}
          <article className="rounded-xl border border-violet-400/15 bg-[#0c101d]">
            <div className="border-b border-white/[0.08] p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300">
                  <Plus size={18} />
                </div>
                <div>
                  <h2 className="font-semibold">إضافة منتج / Add product</h2>
                  <p className="mt-1 text-xs text-white/30">أدخل البيانات بوضوح</p>
                </div>
              </div>
            </div>

            <form onSubmit={addProduct} className="space-y-4 p-5">
              <div className="rounded-xl border border-white/[0.08] bg-[#090d18] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-medium">صورة المنتج</p>

                  {image && (
                    <button
                      type="button"
                      onClick={() => setImage("")}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-300"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                <label className="block cursor-pointer">
                  <div className="flex h-36 items-center justify-center overflow-hidden rounded-lg border border-dashed border-white/15 bg-[#080b16]">
                    {image ? (
                      <img
                        src={image}
                        alt="Preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="text-center">
                        <ImageIcon className="mx-auto text-white/25" />
                        <p className="mt-2 text-xs text-white/35">اختر صورة</p>
                      </div>
                    )}
                  </div>

                  <input type="file" accept="image/*" onChange={chooseImage(setImage)} className="hidden" />
                </label>

                <p className="mt-2 text-[10px] text-white/30">حد أقصى 2MB</p>
              </div>

              <label className="block">
                <span className="mb-2 block text-xs text-white/45">اسم المنتج</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: Chips Lays"
                  className={fieldClass}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs text-white/45">التصنيف</span>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className={fieldClass}
                >
                  <option value="">Other (Default)</option>
                  {categories
                    .filter((c) => Number(c.active) === 1)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-2 block text-xs text-white/45">SKU (اختياري)</span>
                  <input
                    dir="ltr"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="12345"
                    className={fieldClass}
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs text-white/45">الوحدة</span>
                  <input
                    dir="ltr"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="pcs"
                    className={fieldClass}
                  />
                </label>
              </div>

              <div className="rounded-xl border border-white/[0.08] bg-[#090d18] p-4">
                <p className="text-sm font-medium">الأسعار والمخزون</p>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-2 block text-xs text-white/45">سعر البيع (DA)</span>
                    <input
                      dir="ltr"
                      type="text"
                      inputMode="decimal"
                      value={salePrice}
                      onChange={(e) => setSalePrice(normalizeNumber(e.target.value))}
                      placeholder="مثال: 70"
                      className={fieldClass}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs text-white/45">تكلفة الشراء (DA)</span>
                    <input
                      dir="ltr"
                      type="text"
                      inputMode="decimal"
                      value={costPrice}
                      onChange={(e) => setCostPrice(normalizeNumber(e.target.value))}
                      placeholder="مثال: 50"
                      className={fieldClass}
                    />
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="mb-2 block text-xs text-white/45">الكمية (مخزون أولي)</span>
                    <input
                      dir="ltr"
                      type="text"
                      inputMode="decimal"
                      value={initialStock}
                      onChange={(e) => setInitialStock(normalizeNumber(e.target.value))}
                      placeholder="مثال: 70"
                      className={fieldClass}
                    />
                    <p className="mt-2 text-[11px] leading-5 text-white/30">
                      هذه الكمية ستظهر في Store مباشرة بعد الإضافة.
                    </p>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingProduct}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-violet-600 text-sm font-medium disabled:opacity-50"
              >
                {savingProduct ? <RefreshCw size={17} className="animate-spin" /> : <Plus size={17} />}
                إضافة المنتج
              </button>
            </form>
          </article>
        </aside>
      </section>

      {/* EDIT MODAL */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl border border-violet-400/20 bg-[#0c101d]">
            <div className="flex items-center justify-between border-b border-white/[0.08] p-5">
              <div>
                <h2 className="font-semibold">تعديل المنتج</h2>
                <p className="mt-1 text-xs text-white/30">{editing.name}</p>
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
              <div className="grid gap-4 lg:grid-cols-2">
                {/* image */}
                <div className="rounded-xl border border-white/[0.08] bg-[#090d18] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-medium">الصورة</p>

                    {editImage && (
                      <button
                        type="button"
                        onClick={() => setEditImage("")}
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-300"
                        title="حذف الصورة"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>

                  <label className="block cursor-pointer">
                    <div className="flex h-40 items-center justify-center overflow-hidden rounded-lg border border-dashed border-white/15 bg-[#080b16]">
                      {editImage ? (
                        <img
                          src={editImage}
                          alt="Preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="text-center">
                          <ImageIcon className="mx-auto text-white/25" />
                          <p className="mt-2 text-xs text-white/35">اختر صورة</p>
                        </div>
                      )}
                    </div>

                    <input
                      type="file"
                      accept="image/*"
                      onChange={chooseImage(setEditImage)}
                      className="hidden"
                    />
                  </label>

                  <p className="mt-2 text-[10px] text-white/30">حد أقصى 2MB</p>
                </div>

                {/* fields */}
                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-xs text-white/45">الاسم</span>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className={fieldClass}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs text-white/45">التصنيف</span>
                    <select
                      value={editCategoryId}
                      onChange={(e) => setEditCategoryId(e.target.value)}
                      className={fieldClass}
                    >
                      <option value="">Other (Default)</option>
                      {categories
                        .filter((c) => Number(c.active) === 1)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="mb-2 block text-xs text-white/45">SKU</span>
                      <input
                        dir="ltr"
                        value={editSku}
                        onChange={(e) => setEditSku(e.target.value)}
                        className={fieldClass}
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-xs text-white/45">Unit</span>
                      <input
                        dir="ltr"
                        value={editUnit}
                        onChange={(e) => setEditUnit(e.target.value)}
                        className={fieldClass}
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="mb-2 block text-xs text-white/45">Sale price</span>
                      <input
                        dir="ltr"
                        type="text"
                        inputMode="decimal"
                        value={editSalePrice}
                        onChange={(e) => setEditSalePrice(normalizeNumber(e.target.value))}
                        className={fieldClass}
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-xs text-white/45">Cost price</span>
                      <input
                        dir="ltr"
                        type="text"
                        inputMode="decimal"
                        value={editCostPrice}
                        onChange={(e) => setEditCostPrice(normalizeNumber(e.target.value))}
                        className={fieldClass}
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={() => setEditActive((v) => !v)}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-white/[0.05] text-sm"
                  >
                    {editActive ? (
                      <>
                        <ToggleRight size={18} className="text-emerald-300" />
                        Active (مفعل)
                      </>
                    ) : (
                      <>
                        <ToggleLeft size={18} className="text-rose-300" />
                        Inactive (معطل)
                      </>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={editSaving}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-violet-600 text-sm font-medium disabled:opacity-50"
              >
                {editSaving ? (
                  <RefreshCw size={17} className="animate-spin" />
                ) : (
                  <Save size={17} />
                )}
                حفظ التعديلات
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}