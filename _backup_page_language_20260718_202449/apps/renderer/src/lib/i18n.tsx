import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

export type AppLanguage = "en" | "ar" | "fr";

export type TranslationKey = string;

const messages: Record<AppLanguage, Record<string, string>> = {
  en: {
    dashboard: "Dashboard", devices: "Devices", sessions: "Sessions", players: "Players & VIP",
    tournaments: "Tournaments", billing: "Billing", store: "Store", inventory: "Inventory",
    guestDebts: "Guest Debts", reports: "Reports", staff: "Staff", settings: "Settings",
    control: "CONTROL", arena: "ARENA", business: "BUSINESS", systemOnline: "System Online",
    language: "Language", search: "Search pages, players, devices...", logout: "Log out",
    currentShift: "Current shift", noOpenShift: "No open shift", startCash: "Opening cash",
    openShift: "Open shift", shiftOpen: "Shift open", started: "Started", sessionCash: "Session cash",
    storeSales: "Store sales", walletTopups: "Wallet top-ups", debtCollection: "Debt collection",
    expenses: "Expenses", expectedCash: "Expected cash now", actualCash: "Actual cash",
    closeShift: "Close shift", overallSummary: "Overall summary", noData: "No data",
    storeRevenue: "Store revenue", netCash: "Net cash", addExpense: "Add expense",
  },
  ar: {
    dashboard: "الرئيسية", devices: "الأجهزة", sessions: "الجلسات", players: "اللاعبون وVIP",
    tournaments: "البطولات", billing: "الفوترة", store: "المتجر", inventory: "المخزون",
    guestDebts: "ديون الضيوف", reports: "التقارير", staff: "الموظفون", settings: "الإعدادات",
    control: "التحكم", arena: "القاعة", business: "الأعمال", systemOnline: "النظام متصل",
    language: "اللغة", search: "ابحث في الصفحات واللاعبين والأجهزة...", logout: "تسجيل الخروج",
    currentShift: "الوردية الحالية", noOpenShift: "لا توجد وردية مفتوحة", startCash: "كاش البداية",
    openShift: "فتح الوردية", shiftOpen: "وردية مفتوحة", started: "بدأت",
    sessionCash: "جلسات كاش", storeSales: "مبيعات المتجر", walletTopups: "شحن المحافظ",
    debtCollection: "تحصيل الديون", expenses: "المصروفات", expectedCash: "الكاش المتوقع الآن",
    actualCash: "الكاش الحقيقي", closeShift: "إغلاق الوردية", overallSummary: "الملخص العام",
    noData: "لا توجد بيانات", storeRevenue: "إيراد المتجر", netCash: "صافي النقد",
    addExpense: "إضافة مصروف",
  },
  fr: {
    dashboard: "Tableau de bord", devices: "Appareils", sessions: "Sessions", players: "Joueurs et VIP",
    tournaments: "Tournois", billing: "Facturation", store: "Boutique", inventory: "Stock",
    guestDebts: "Dettes clients", reports: "Rapports", staff: "Personnel", settings: "Paramètres",
    control: "CONTRÔLE", arena: "ARÈNE", business: "GESTION", systemOnline: "Système en ligne",
    language: "Langue", search: "Rechercher pages, joueurs, appareils...", logout: "Déconnexion",
    currentShift: "Service en cours", noOpenShift: "Aucun service ouvert", startCash: "Fond de caisse",
    openShift: "Ouvrir le service", shiftOpen: "Service ouvert", started: "Début",
    sessionCash: "Sessions en espèces", storeSales: "Ventes de la boutique", walletTopups: "Recharges portefeuille",
    debtCollection: "Recouvrement des dettes", expenses: "Dépenses", expectedCash: "Espèces attendues",
    actualCash: "Espèces réelles", closeShift: "Clôturer le service", overallSummary: "Résumé général",
    noData: "Aucune donnée", storeRevenue: "Revenus de la boutique", netCash: "Trésorerie nette",
    addExpense: "Ajouter une dépense",
  },
};

type LocalizedText = Record<AppLanguage, string>;

// Legacy screens still contain hard-coded bilingual labels. This bridge makes
// each one render in one language until every screen is migrated to t(...).
const legacyLabels: Record<string, LocalizedText> = {
  "Refresh / تحديث": { en: "Refresh", ar: "تحديث", fr: "Actualiser" },
  "Sessions & CS Rounds": { en: "Sessions & CS Rounds", ar: "الجلسات وجولات CS", fr: "Sessions et manches CS" },
  "Groups, winners, and waiting list": { en: "Groups, winners, and waiting list", ar: "المجموعات والفائزون وقائمة الانتظار", fr: "Groupes, gagnants et liste d’attente" },
  "Waiting list": { en: "Waiting list", ar: "قائمة الانتظار", fr: "Liste d’attente" },
  "New players are added at the bottom": { en: "New players are added at the bottom", ar: "يُضاف اللاعبون الجدد في الأسفل", fr: "Les nouveaux joueurs sont ajoutés en bas" },
  "Search to add player": { en: "Search to add player", ar: "ابحث لإضافة لاعب", fr: "Rechercher pour ajouter un joueur" },
  "Waiting list is empty": { en: "Waiting list is empty", ar: "قائمة الانتظار فارغة", fr: "La liste d’attente est vide" },
  "Single session / جلسة فردية": { en: "Single session", ar: "جلسة فردية", fr: "Session individuelle" },
  "Fixed round / جولة ثابتة": { en: "Fixed round", ar: "جولة ثابتة", fr: "Manche fixe" },
  "Timed / بالوقت": { en: "Timed", ar: "بالوقت", fr: "Chronométrée" },
  "Select device / اختر الجهاز": { en: "Select device", ar: "اختر الجهاز", fr: "Sélectionner un appareil" },
  "Guest / ضيف": { en: "Guest", ar: "ضيف", fr: "Invité" },
  "Player / لاعب": { en: "Player", ar: "لاعب", fr: "Joueur" },
  "Select player / اختر اللاعب": { en: "Select player", ar: "اختر اللاعب", fr: "Sélectionner un joueur" },
  "Start session / بدء الجلسة": { en: "Start session", ar: "بدء الجلسة", fr: "Démarrer la session" },
  "Start group round / بدء جولة جماعية": { en: "Start group round", ar: "بدء جولة جماعية", fr: "Démarrer une manche de groupe" },
  "One player per play": { en: "One player per play", ar: "لاعب واحد لكل لعب", fr: "Un joueur par partie" },
  "Search player name or username": { en: "Search player name or username", ar: "ابحث باسم اللاعب أو اسم المستخدم", fr: "Rechercher un joueur ou un identifiant" },
  "Price per player DA / سعر كل لاعب": { en: "Price per player (DA)", ar: "سعر كل لاعب (دج)", fr: "Prix par joueur (DA)" },
  "Active sessions / الجلسات النشطة": { en: "Active sessions", ar: "الجلسات النشطة", fr: "Sessions actives" },
  "Wallet / المحفظة": { en: "Wallet", ar: "المحفظة", fr: "Portefeuille" },
  "Cash / نقدا": { en: "Cash", ar: "نقدًا", fr: "Espèces" },
  "Price / السعر": { en: "Price", ar: "السعر", fr: "Prix" },
  "Duration / المدة": { en: "Duration", ar: "المدة", fr: "Durée" },
  "Player / اللاعب": { en: "Player", ar: "اللاعب", fr: "Joueur" },
  "Business": { en: "Business", ar: "الأعمال", fr: "Gestion" },
  "Session Control": { en: "Session Control", ar: "التحكم في الجلسات", fr: "Contrôle des sessions" },
};

const originalLegacyText = new WeakMap<Text, string>();

function applyLegacyTranslations(language: AppLanguage) {
  if (!document.body) return;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);

  for (const node of nodes) {
    const parent = node.parentElement;
    if (!parent || ["SCRIPT", "STYLE", "TEXTAREA", "OPTION"].includes(parent.tagName)) continue;
    const current = node.nodeValue ?? "";
    const original = originalLegacyText.get(node) ?? current;
    const leading = original.match(/^\s*/)?.[0] ?? "";
    const trailing = original.match(/\s*$/)?.[0] ?? "";
    const key = original.trim();
    const translated = legacyLabels[key]?.[language];
    if (translated !== undefined) {
      originalLegacyText.set(node, original);
      const next = `${leading}${translated}${trailing}`;
      if (node.nodeValue !== next) node.nodeValue = next;
    }
  }
}

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (key: TranslationKey) => string;
  dir: "ltr" | "rtl";
  locale: string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function initialLanguage(): AppLanguage {
  const saved = localStorage.getItem("noxus-language");
  return saved === "ar" || saved === "fr" || saved === "en" ? saved : "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<AppLanguage>(initialLanguage);
  const dir = language === "ar" ? "rtl" : "ltr";
  const locale = language === "ar" ? "ar-DZ" : language === "fr" ? "fr-FR" : "en-GB";

  useEffect(() => {
    localStorage.setItem("noxus-language", language);
    document.documentElement.lang = language;
    document.documentElement.dir = dir;
  }, [dir, language]);

  useEffect(() => {
    let scheduled = false;
    const update = () => {
      scheduled = false;
      applyLegacyTranslations(language);
    };
    update();
    const observer = new MutationObserver(() => {
      if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(update);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    t: (key) => messages[language][key] ?? messages.en[key],
    dir,
    locale,
  }), [dir, language, locale]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
