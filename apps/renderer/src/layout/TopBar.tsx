import { Bell, ChevronDown, Gamepad2, Languages, Search, ShieldCheck } from "lucide-react";
import { useLocation } from "react-router-dom";
import { type AppLanguage, type TranslationKey, useLanguage } from "../lib/i18n";

const pageInformation: Record<string, { title: TranslationKey; description: string }> = {
  "/": { title: "dashboard", description: "Arena overview and live operations" },
  "/devices": { title: "devices", description: "Manage gaming stations and consoles" },
  "/sessions": { title: "sessions", description: "Live session control and monitoring" },
  "/players": { title: "players", description: "Player profiles and VIP activity" },
  "/tournaments": { title: "tournaments", description: "Competitive events and brackets" },
  "/billing": { title: "billing", description: "Payments and financial operations" },
  "/store": { title: "store", description: "Products and arena sales" },
  "/inventory": { title: "inventory", description: "Stock levels and product control" },
  "/guest-debts": { title: "guestDebts", description: "Customer debt tracking" },
  "/reports": { title: "reports", description: "Performance and revenue analytics" },
  "/staff": { title: "staff", description: "Staff access and audit" },
  "/settings": { title: "settings", description: "System and arena configuration" },
};

const languageLabels: Record<AppLanguage, string> = { en: "English", ar: "العربية", fr: "Français" };

export default function TopBar() {
  const location = useLocation();
  const { dir, language, locale, setLanguage, t } = useLanguage();
  const currentPage = pageInformation[location.pathname] ?? pageInformation["/"];
  const currentDate = new Date().toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });

  return (
    <header dir={dir} className="noxus-topbar flex h-[86px] shrink-0 items-center gap-6 border-b border-white/[0.07] bg-[#070a14]/80 px-6 backdrop-blur-xl">
      <div className="min-w-48"><div className="flex items-center gap-2"><h1 className="text-lg font-semibold">{t(currentPage.title)}</h1><span className="rounded bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-300">{languageLabels[language]}</span></div><p className="mt-1 text-xs text-white/30">{currentPage.description}</p></div>
      <div className="hidden min-w-0 max-w-xl flex-1 lg:block"><div className="flex h-10 items-center gap-3 rounded-lg border border-white/[0.08] bg-[#0b0f1c] px-4 transition focus-within:border-violet-400/35"><Search size={16} className="shrink-0 text-white/25" /><input placeholder={t("search")} className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/20" /><kbd className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-white/25">CTRL K</kbd></div></div>
      <div className="ml-auto flex items-center gap-3">
        <label className="hidden h-10 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 text-white/60 sm:flex"><Languages size={17} className="text-violet-300" /><span className="sr-only">{t("language")}</span><select aria-label={t("language")} value={language} onChange={(event) => setLanguage(event.target.value as AppLanguage)} className="cursor-pointer bg-transparent text-xs font-medium outline-none">{(Object.keys(languageLabels) as AppLanguage[]).map((code) => <option key={code} value={code} className="bg-[#111626] text-white">{languageLabels[code]}</option>)}</select><ChevronDown size={13} className="pointer-events-none -ml-1 text-white/35" /></label>
        <div className="hidden text-right 2xl:block"><p className="text-xs text-white/45">{currentDate}</p><p className="mt-1 text-[10px] text-emerald-300">● {t("systemOnline")}</p></div>
        <button type="button" aria-label="Gaming controls" className="hidden h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/45 transition hover:border-violet-400/30 hover:text-violet-300 sm:flex"><Gamepad2 size={18} /></button>
        <button type="button" aria-label="Notifications" className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/45 transition hover:border-violet-400/30 hover:text-violet-300"><Bell size={18} /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-fuchsia-400 shadow-[0_0_8px_rgba(232,121,249,0.8)]" /></button>
        <div className="flex h-11 items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5"><div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 text-xs font-bold">AY<span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0a0d18] bg-emerald-400" /></div><div className="hidden text-left xl:block"><div className="flex items-center gap-1.5"><p className="text-xs font-medium">Ayoub</p><ShieldCheck size={12} className="text-violet-300" /></div><p className="mt-0.5 text-[9px] text-white/30">Administrator</p></div></div>
      </div>
    </header>
  );
}
