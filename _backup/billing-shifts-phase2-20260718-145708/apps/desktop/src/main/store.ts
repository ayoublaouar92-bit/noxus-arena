import { ipcMain } from "electron";
import { requireAdmin, requireStaff, audit } from "./staff";

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
  image: string | null;
  createdAt: string;
};

type Category = {
  id: number;
  name: string;
  color: string | null;
  sortOrder: number;
  active: number;
  createdAt: string;
};

type CreateCategoryData = {
  name: string;
  color?: string;
  sortOrder?: number;
  active?: boolean;
};

type UpdateCategoryData = {
  categoryId: number;
  name?: string;
  color?: string;
  sortOrder?: number;
  active?: boolean;
};

type CreateProductData = {
  name: string;
  sku?: string;
  unit?: string;
  salePrice: number;
  costPrice?: number;
  initialStock?: number;
  active?: boolean;
  categoryId?: number | null;
  image?: string | null;
};

type UpdateProductData = {
  productId: number;
  name?: string;
  sku?: string;
  unit?: string;
  salePrice?: number;
  costPrice?: number;
  active?: boolean;
  categoryId?: number | null;
  image?: string | null;
};

type StockMoveData = {
  productId: number;
  quantity: number;
  reason: "PURCHASE" | "ADJUSTMENT" | "RETURN";
  note?: string;
};

type SaleItemInput = {
  productId: number;
  quantity: number;
  unitPrice: number;
};

type CreateSaleData =
  | {
      paymentType: "cash";
      customerName?: string;
      note?: string;
      items: SaleItemInput[];
    }
  | {
      paymentType: "player";
      playerId: number;
      customerName?: string;
      note?: string;
      items: SaleItemInput[];
    };

type PlayerRow = {
  id: number;
  name: string;
  walletBalance: number;
  debtBalance: number;
};

function registerHandler(channel: string, handler: (...args: any[]) => any) {
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, handler);
}

function n(value: unknown) {
  return Number(value || 0);
}

function clampImageDataUrl(input: unknown) {
  if (typeof input !== "string") return null;
  const value = input.trim();
  if (!value) return null;
  if (!value.startsWith("data:image/")) return null;
  if (value.length > 1_500_000) return null;
  return value;
}

function ensureStoreTables(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS product_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sku TEXT,
      unit TEXT NOT NULL DEFAULT 'pcs',
      salePrice REAL NOT NULL DEFAULT 0,
      costPrice REAL NOT NULL DEFAULT 0,
      stock REAL NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      categoryId INTEGER,
      image TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (categoryId)
        REFERENCES product_categories(id)
    );
  `);

  const productColumns = db.prepare("PRAGMA table_info(products)").all() as Array<{ name: string }>;
  const hasCategoryId = productColumns.some((c) => c.name === "categoryId");
  const hasImage = productColumns.some((c) => c.name === "image");

  if (!hasCategoryId) db.exec(`ALTER TABLE products ADD COLUMN categoryId INTEGER;`);
  if (!hasImage) db.exec(`ALTER TABLE products ADD COLUMN image TEXT;`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      productId INTEGER NOT NULL,
      quantity REAL NOT NULL,
      reason TEXT NOT NULL,
      note TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (productId)
        REFERENCES products(id)
        ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customerName TEXT,
      paymentType TEXT NOT NULL DEFAULT 'cash',
      playerId INTEGER,
      subtotal REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      walletPaid REAL NOT NULL DEFAULT 0,
      debtAdded REAL NOT NULL DEFAULT 0,
      cashPaid REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Completed',
      note TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (playerId)
        REFERENCES players(id)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      saleId INTEGER NOT NULL,
      productId INTEGER NOT NULL,
      quantity REAL NOT NULL,
      unitPrice REAL NOT NULL,
      lineTotal REAL NOT NULL,

      FOREIGN KEY (saleId)
        REFERENCES sales(id)
        ON DELETE CASCADE,

      FOREIGN KEY (productId)
        REFERENCES products(id)
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(categoryId);

    CREATE INDEX IF NOT EXISTS idx_categories_active ON product_categories(active);
    CREATE INDEX IF NOT EXISTS idx_categories_sort ON product_categories(sortOrder);

    CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(productId);

    CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(createdAt);
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(saleId);
  `);

  const existingOther = db
    .prepare(`SELECT id FROM product_categories WHERE LOWER(name) = LOWER('Other') LIMIT 1`)
    .get() as { id: number } | undefined;

  if (!existingOther) {
    db.prepare(
      `
        INSERT INTO product_categories (name, color, sortOrder, active)
        VALUES ('Other', '#64748b', 0, 1)
      `
    ).run();
  }

  const other = db
    .prepare(`SELECT id FROM product_categories WHERE LOWER(name) = LOWER('Other') LIMIT 1`)
    .get() as { id: number };

  db.prepare(
    `
      UPDATE products
      SET categoryId = ?
      WHERE categoryId IS NULL
    `
  ).run(other.id);
}

function getOtherCategoryId(db: any) {
  const other = db
    .prepare(`SELECT id FROM product_categories WHERE LOWER(name) = LOWER('Other') LIMIT 1`)
    .get() as { id: number } | undefined;

  if (!other) throw new Error("Default category Other missing");
  return other.id;
}

export function registerStoreHandlers(db: any) {
  ensureStoreTables(db);

  // reads allowed
  registerHandler("store:get-categories", () => {
    return db
      .prepare(
        `
          SELECT *
          FROM product_categories
          ORDER BY active DESC, sortOrder ASC, id ASC
        `
      )
      .all();
  });

  registerHandler("store:get-products", () => {
    return db
      .prepare(
        `
          SELECT
            products.*,
            product_categories.name AS categoryName,
            product_categories.color AS categoryColor
          FROM products
          LEFT JOIN product_categories
            ON product_categories.id = products.categoryId
          ORDER BY products.active DESC, products.id DESC
        `
      )
      .all();
  });

  // Admin: categories/products/stock
  registerHandler("store:add-category", (_event, data: CreateCategoryData) => {
    requireAdmin(db, "STORE_ADD_CATEGORY");

    const name = data.name?.trim();
    if (!name) throw new Error("Category name is required");

    const color = (data.color?.trim() || "").slice(0, 32);
    const sortOrder = Math.floor(n(data.sortOrder));
    const active = data.active === false ? 0 : 1;

    const result = db
      .prepare(`INSERT INTO product_categories (name, color, sortOrder, active) VALUES (?, ?, ?, ?)`)
      .run(name, color || null, sortOrder, active);

    audit(db, { action: "STORE_CATEGORY_ADDED", entity: "product_categories", entityId: Number(result.lastInsertRowid), details: name });
    return { id: Number(result.lastInsertRowid), changes: result.changes };
  });

  registerHandler("store:update-category", (_event, data: UpdateCategoryData) => {
    requireAdmin(db, "STORE_UPDATE_CATEGORY");

    if (!data.categoryId) throw new Error("Category ID is required");

    const existing = db.prepare(`SELECT * FROM product_categories WHERE id = ?`).get(data.categoryId) as Category | undefined;
    if (!existing) throw new Error("Category not found");

    const next = {
      name: typeof data.name === "string" ? data.name.trim() : existing.name,
      color: typeof data.color === "string" ? data.color.trim() : existing.color ?? "",
      sortOrder: typeof data.sortOrder === "number" ? Math.floor(data.sortOrder) : Number(existing.sortOrder || 0),
      active: typeof data.active === "boolean" ? (data.active ? 1 : 0) : existing.active,
    };
    if (!next.name) throw new Error("Category name is required");

    db.prepare(`UPDATE product_categories SET name = ?, color = ?, sortOrder = ?, active = ? WHERE id = ?`)
      .run(next.name, next.color || null, next.sortOrder, next.active, data.categoryId);

    audit(db, { action: "STORE_CATEGORY_UPDATED", entity: "product_categories", entityId: data.categoryId, details: JSON.stringify(next) });
    return { changes: 1 };
  });

  registerHandler("store:delete-category", (_event, categoryId: number) => {
    requireAdmin(db, "STORE_DELETE_CATEGORY");

    if (!categoryId) throw new Error("Category ID is required");

    const otherId = getOtherCategoryId(db);
    if (categoryId === otherId) throw new Error("Cannot delete default category Other");

    const row = db.prepare(`SELECT name FROM product_categories WHERE id = ?`).get(categoryId) as any;

    const used = db.prepare(`SELECT COUNT(*) AS total FROM products WHERE categoryId = ?`).get(categoryId) as { total: number };

    if (Number(used.total) > 0) {
      const tx = db.transaction(() => {
        db.prepare(`UPDATE product_categories SET active = 0 WHERE id = ?`).run(categoryId);
        db.prepare(`UPDATE products SET categoryId = ? WHERE categoryId = ?`).run(otherId, categoryId);
      });
      tx();

      audit(db, { action: "STORE_CATEGORY_DELETED", entity: "product_categories", entityId: categoryId, details: `${row?.name || ""} (soft)` });
      return { changes: 1, softDeleted: true };
    }

    const result = db.prepare(`DELETE FROM product_categories WHERE id = ?`).run(categoryId);
    audit(db, { action: "STORE_CATEGORY_DELETED", entity: "product_categories", entityId: categoryId, details: row?.name || null });
    return { changes: result.changes, softDeleted: false };
  });

  registerHandler("store:add-product", (_event, data: CreateProductData) => {
    requireAdmin(db, "STORE_ADD_PRODUCT");

    const name = data.name?.trim();
    if (!name) throw new Error("Product name is required");

    const salePrice = Math.max(0, n(data.salePrice));
    const costPrice = Math.max(0, n(data.costPrice));
    const initialStock = Math.max(0, n(data.initialStock));
    const unit = (data.unit?.trim() || "pcs").slice(0, 16);
    const sku = (data.sku?.trim() || "").slice(0, 64);
    const active = data.active === false ? 0 : 1;

    const image = clampImageDataUrl(data.image);

    let categoryId: number | null = typeof data.categoryId === "number" ? Number(data.categoryId) : null;
    if (!categoryId) categoryId = getOtherCategoryId(db);

    const tx = db.transaction(() => {
      const result = db
        .prepare(
          `INSERT INTO products (name, sku, unit, salePrice, costPrice, stock, active, categoryId, image)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(name, sku || null, unit, salePrice, costPrice, initialStock, active, categoryId, image);

      const productId = Number(result.lastInsertRowid);

      if (initialStock > 0) {
        db.prepare(`INSERT INTO inventory_movements (productId, quantity, reason, note) VALUES (?, ?, 'PURCHASE', 'Initial stock')`)
          .run(productId, initialStock);
      }

      audit(db, { action: "STORE_PRODUCT_ADDED", entity: "products", entityId: productId, details: name });
      return { id: productId, changes: result.changes };
    });

    return tx();
  });

  registerHandler("store:update-product", (_event, data: UpdateProductData) => {
    requireAdmin(db, "STORE_UPDATE_PRODUCT");

    if (!data.productId) throw new Error("Product ID is required");

    const existing = db.prepare(`SELECT * FROM products WHERE id = ?`).get(data.productId) as Product | undefined;
    if (!existing) throw new Error("Product not found");

    const otherId = getOtherCategoryId(db);

    const next = {
      name: typeof data.name === "string" ? data.name.trim() : existing.name,
      sku: typeof data.sku === "string" ? data.sku.trim() : existing.sku ?? "",
      unit: typeof data.unit === "string" ? data.unit.trim() : existing.unit,
      salePrice: typeof data.salePrice === "number" ? Math.max(0, data.salePrice) : Number(existing.salePrice || 0),
      costPrice: typeof data.costPrice === "number" ? Math.max(0, data.costPrice) : Number(existing.costPrice || 0),
      active: typeof data.active === "boolean" ? (data.active ? 1 : 0) : existing.active,
      categoryId:
        typeof data.categoryId === "number" ? Number(data.categoryId) || otherId : existing.categoryId ?? otherId,
      image: typeof data.image !== "undefined" ? clampImageDataUrl(data.image) : (existing.image ?? null),
    };

    if (!next.name) throw new Error("Product name is required");

    db.prepare(
      `UPDATE products SET name=?, sku=?, unit=?, salePrice=?, costPrice=?, active=?, categoryId=?, image=? WHERE id=?`
    ).run(
      next.name,
      next.sku || null,
      next.unit,
      next.salePrice,
      next.costPrice,
      next.active,
      next.categoryId,
      next.image,
      data.productId
    );

    audit(db, { action: "STORE_PRODUCT_UPDATED", entity: "products", entityId: data.productId, details: JSON.stringify(next) });
    return { changes: 1 };
  });

  registerHandler("store:delete-product", (_event, productId: number) => {
    requireAdmin(db, "STORE_DELETE_PRODUCT");

    if (!productId) throw new Error("Product ID is required");

    const row = db.prepare(`SELECT name FROM products WHERE id = ?`).get(productId) as any;

    const count = db.prepare(`SELECT COUNT(*) AS total FROM sale_items WHERE productId = ?`).get(productId) as { total: number };
    if (Number(count.total) > 0) {
      db.prepare(`UPDATE products SET active = 0 WHERE id = ?`).run(productId);
      audit(db, { action: "STORE_PRODUCT_DELETED", entity: "products", entityId: productId, details: `${row?.name || ""} (soft)` });
      return { changes: 1, softDeleted: true };
    }

    const result = db.prepare(`DELETE FROM products WHERE id = ?`).run(productId);
    audit(db, { action: "STORE_PRODUCT_DELETED", entity: "products", entityId: productId, details: row?.name || null });
    return { changes: result.changes, softDeleted: false };
  });

  registerHandler("store:get-product-movements", (_event, productId: number) => {
    return db
      .prepare(`SELECT * FROM inventory_movements WHERE productId = ? ORDER BY id DESC LIMIT 200`)
      .all(productId);
  });

  registerHandler("store:move-stock", (_event, data: StockMoveData) => {
    requireAdmin(db, "STORE_MOVE_STOCK");

    const productId = Number(data.productId);
    const quantity = Number(data.quantity);

    if (!productId) throw new Error("Product ID is required");
    if (!Number.isFinite(quantity) || quantity === 0) throw new Error("Quantity must be non-zero");

    const product = db.prepare(`SELECT * FROM products WHERE id = ?`).get(productId) as Product | undefined;
    if (!product) throw new Error("Product not found");

    const newStock = Number(product.stock || 0) + quantity;
    if (newStock < 0) throw new Error("Not enough stock");

    const reason = data.reason;
    const note = data.note?.trim() || "";

    const tx = db.transaction(() => {
      db.prepare(`UPDATE products SET stock = ? WHERE id = ?`).run(newStock, productId);
      db.prepare(`INSERT INTO inventory_movements (productId, quantity, reason, note) VALUES (?, ?, ?, ?)`)
        .run(productId, quantity, reason, note);
    });

    tx();

    audit(db, { action: "STORE_STOCK_MOVED", entity: "products", entityId: productId, details: JSON.stringify({ quantity, reason, note }) });
    return { productId, stock: newStock };
  });

  // Staff allowed: create sale (checkout)
  registerHandler("store:create-sale", (_event, data: CreateSaleData) => {
    requireStaff(db, "STORE_CREATE_SALE");

    if (!data.items?.length) throw new Error("Sale items are required");

    const items = data.items.map((item) => ({
      productId: Number(item.productId),
      quantity: Math.max(0, Number(item.quantity)),
      unitPrice: Math.max(0, Number(item.unitPrice)),
    }));

    if (items.some((i) => !i.productId || !Number.isFinite(i.quantity) || i.quantity <= 0)) {
      throw new Error("Invalid sale items");
    }

    const customerName = data.customerName?.trim() || "";
    const note = data.note?.trim() || "";

    const subtotal = items.reduce((total, item) => total + item.quantity * item.unitPrice, 0);
    const total = Number(subtotal.toFixed(2));

    let cashPaid = 0;
    let walletPaid = 0;
    let debtAdded = 0;

    const tx = db.transaction(() => {
      // stock check
      for (const item of items) {
        const product = db.prepare(`SELECT * FROM products WHERE id = ?`).get(item.productId) as Product | undefined;
        if (!product) throw new Error("Product not found");
        if (Number(product.active) !== 1) throw new Error("Product not active");

        const newStock = Number(product.stock || 0) - item.quantity;
        if (newStock < 0) throw new Error(`Not enough stock for ${product.name}`);
      }

      if (data.paymentType === "player") {
        const player = db.prepare(`SELECT * FROM players WHERE id = ?`).get(data.playerId) as PlayerRow | undefined;
        if (!player) throw new Error("Player not found");

        const currentWallet = Math.max(0, Number(player.walletBalance || 0));
        walletPaid = Math.min(currentWallet, total);
        debtAdded = total - walletPaid;

        const newWallet = currentWallet - walletPaid;
        const newDebt = Number(player.debtBalance || 0) + debtAdded;

        db.prepare(`UPDATE players SET walletBalance = ?, debtBalance = ? WHERE id = ?`).run(newWallet, newDebt, player.id);

        db.prepare(
          `INSERT INTO wallet_transactions (playerId, type, amount, walletChange, debtChange, note)
           VALUES (?, 'STORE_SALE', ?, ?, ?, ?)`
        ).run(player.id, total, -walletPaid, debtAdded, note || "Store sale");
      } else {
        cashPaid = total;
      }

      const saleResult = db
        .prepare(
          `INSERT INTO sales
           (customerName, paymentType, playerId, subtotal, total, walletPaid, debtAdded, cashPaid, status, note)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Completed', ?)`
        )
        .run(
          customerName,
          data.paymentType,
          data.paymentType === "player" ? data.playerId : null,
          subtotal,
          total,
          walletPaid,
          debtAdded,
          cashPaid,
          note
        );

      const saleId = Number(saleResult.lastInsertRowid);

      for (const item of items) {
        const product = db.prepare(`SELECT * FROM products WHERE id = ?`).get(item.productId) as Product;

        const lineTotal = Number((item.quantity * item.unitPrice).toFixed(2));

        db.prepare(
          `INSERT INTO sale_items (saleId, productId, quantity, unitPrice, lineTotal)
           VALUES (?, ?, ?, ?, ?)`
        ).run(saleId, item.productId, item.quantity, item.unitPrice, lineTotal);

        const newStock = Number(product.stock || 0) - item.quantity;
        db.prepare(`UPDATE products SET stock = ? WHERE id = ?`).run(newStock, product.id);

        db.prepare(
          `INSERT INTO inventory_movements (productId, quantity, reason, note)
           VALUES (?, ?, 'ADJUSTMENT', ?)`
        ).run(product.id, -item.quantity, `Sale #${saleId}`);
      }

      audit(db, {
        action: "STORE_SALE_CREATED",
        entity: "sales",
        entityId: saleId,
        details: JSON.stringify({ paymentType: data.paymentType, customerName, total, itemsCount: items.length }),
      });

      return { saleId, total, paymentType: data.paymentType, cashPaid, walletPaid, debtAdded };
    });

    return tx();
  });

  // optional reads
  registerHandler("store:get-sales", () => {
    return db
      .prepare(
        `
          SELECT
            sales.*,
            players.name AS playerName,
            players.username AS playerUsername
          FROM sales
          LEFT JOIN players
            ON players.id = sales.playerId
          ORDER BY sales.id DESC
          LIMIT 200
        `
      )
      .all();
  });

  registerHandler("store:get-sale-items", (_event, saleId: number) => {
    return db
      .prepare(
        `
          SELECT
            sale_items.*,
            products.name AS productName,
            products.unit AS productUnit
          FROM sale_items
          INNER JOIN products
            ON products.id = sale_items.productId
          WHERE sale_items.saleId = ?
          ORDER BY sale_items.id ASC
        `
      )
      .all(saleId);
  });
}