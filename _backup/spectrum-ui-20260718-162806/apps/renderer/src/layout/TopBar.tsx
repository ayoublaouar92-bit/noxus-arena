import {
  Bell,
  Gamepad2,
  Search,
  ShieldCheck,
} from "lucide-react";

import { useLocation } from "react-router-dom";

const pageInformation: Record<
  string,
  {
    title: string;
    arabic: string;
    description: string;
  }
> = {
  "/": {
    title: "Dashboard",
    arabic: "لوحة التحكم",
    description: "Arena overview and live operations",
  },
  "/devices": {
    title: "Devices",
    arabic: "الأجهزة",
    description: "Manage gaming stations and consoles",
  },
  "/sessions": {
    title: "Sessions",
    arabic: "الجلسات",
    description: "Live session control and monitoring",
  },
  "/players": {
    title: "Players",
    arabic: "اللاعبون",
    description: "Player profiles and activity",
  },
  "/members": {
    title: "Members",
    arabic: "الأعضاء",
    description: "Membership and customer management",
  },
  "/tournaments": {
    title: "Tournaments",
    arabic: "البطولات",
    description: "Competitive events and brackets",
  },
  "/billing": {
    title: "Billing",
    arabic: "الفوترة",
    description: "Payments and financial operations",
  },
  "/store": {
    title: "Store",
    arabic: "المتجر",
    description: "Products and arena sales",
  },
  "/inventory": {
    title: "Inventory",
    arabic: "المخزون",
    description: "Stock levels and product control",
  },
  "/reports": {
    title: "Reports",
    arabic: "التقارير",
    description: "Performance and revenue analytics",
  },
  "/settings": {
    title: "Settings",
    arabic: "الإعدادات",
    description: "System and arena configuration",
  },
};

export default function TopBar() {
  const location = useLocation();

  const currentPage =
    pageInformation[location.pathname] ??
    pageInformation["/"];

  const currentDate = new Date().toLocaleDateString(
    "ar-DZ",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
    }
  );

  return (
    <header
      dir="ltr"
      className="flex h-[86px] shrink-0 items-center gap-6 border-b border-white/[0.07] bg-[#070a14]/80 px-6 backdrop-blur-xl"
    >
      <div className="min-w-48">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">
            {currentPage.title}
          </h1>

          <span className="rounded bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-300">
            {currentPage.arabic}
          </span>
        </div>

        <p className="mt-1 text-xs text-white/30">
          {currentPage.description}
        </p>
      </div>

      <div className="hidden min-w-0 max-w-xl flex-1 lg:block">
        <div className="flex h-10 items-center gap-3 rounded-lg border border-white/[0.08] bg-[#0b0f1c] px-4 transition focus-within:border-violet-400/35">
          <Search
            size={16}
            className="shrink-0 text-white/25"
          />

          <input
            placeholder="Search pages, players, devices..."
            className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/20"
          />

          <kbd className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-white/25">
            CTRL K
          </kbd>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden text-right 2xl:block">
          <p
            dir="rtl"
            className="text-xs text-white/45"
          >
            {currentDate}
          </p>

          <p className="mt-1 text-[10px] text-emerald-300">
            ● All systems operational
          </p>
        </div>

        <button
          type="button"
          aria-label="Gaming controls"
          className="hidden h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/45 transition hover:border-violet-400/30 hover:text-violet-300 sm:flex"
        >
          <Gamepad2 size={18} />
        </button>

        <button
          type="button"
          aria-label="Notifications"
          className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/45 transition hover:border-violet-400/30 hover:text-violet-300"
        >
          <Bell size={18} />

          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-fuchsia-400 shadow-[0_0_8px_rgba(232,121,249,0.8)]" />
        </button>

        <div className="flex h-11 items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 text-xs font-bold">
            AY

            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0a0d18] bg-emerald-400" />
          </div>

          <div className="hidden text-left xl:block">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-medium">
                Ayoub
              </p>

              <ShieldCheck
                size={12}
                className="text-violet-300"
              />
            </div>

            <p className="mt-0.5 text-[9px] text-white/30">
              Administrator
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}