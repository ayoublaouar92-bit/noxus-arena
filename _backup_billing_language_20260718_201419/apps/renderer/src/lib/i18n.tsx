import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

export type AppLanguage = "en" | "ar" | "fr";

export type TranslationKey =
  | "dashboard"
  | "devices"
  | "sessions"
  | "players"
  | "tournaments"
  | "billing"
  | "store"
  | "inventory"
  | "guestDebts"
  | "reports"
  | "staff"
  | "settings"
  | "control"
  | "arena"
  | "business"
  | "systemOnline"
  | "language"
  | "search"
  | "logout";

const messages: Record<AppLanguage, Record<TranslationKey, string>> = {
  en: {
    dashboard: "Dashboard", devices: "Devices", sessions: "Sessions", players: "Players & VIP",
    tournaments: "Tournaments", billing: "Billing", store: "Store", inventory: "Inventory",
    guestDebts: "Guest Debts", reports: "Reports", staff: "Staff", settings: "Settings",
    control: "CONTROL", arena: "ARENA", business: "BUSINESS", systemOnline: "System Online",
    language: "Language", search: "Search pages, players, devices...", logout: "Log out",
  },
  ar: {
    dashboard: "الرئيسية", devices: "الأجهزة", sessions: "الجلسات", players: "اللاعبون وVIP",
    tournaments: "البطولات", billing: "الفوترة", store: "المتجر", inventory: "المخزون",
    guestDebts: "ديون الضيوف", reports: "التقارير", staff: "الموظفون", settings: "الإعدادات",
    control: "التحكم", arena: "القاعة", business: "الأعمال", systemOnline: "النظام متصل",
    language: "اللغة", search: "ابحث في الصفحات واللاعبين والأجهزة...", logout: "تسجيل الخروج",
  },
  fr: {
    dashboard: "Tableau de bord", devices: "Appareils", sessions: "Sessions", players: "Joueurs et VIP",
    tournaments: "Tournois", billing: "Facturation", store: "Boutique", inventory: "Stock",
    guestDebts: "Dettes clients", reports: "Rapports", staff: "Personnel", settings: "Paramètres",
    control: "CONTRÔLE", arena: "ARÈNE", business: "GESTION", systemOnline: "Système en ligne",
    language: "Langue", search: "Rechercher pages, joueurs, appareils...", logout: "Déconnexion",
  },
};

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
