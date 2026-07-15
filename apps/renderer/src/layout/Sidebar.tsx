import {
  BarChart3,
  Boxes,
  Clock3,
  Gamepad2,
  LayoutDashboard,
  Monitor,
  Receipt,
  Settings,
  ShoppingBag,
  Trophy,
  UserRound,
  Wifi,
} from "lucide-react";

import { NavLink } from "react-router-dom";

const navigationGroups = [
  {
    title: "CONTROL",

    items: [
      {
        title: "Dashboard",
        arabic: "الرئيسية",
        path: "/",
        icon: LayoutDashboard,
      },
      {
        title: "Devices",
        arabic: "الأجهزة",
        path: "/devices",
        icon: Monitor,
      },
      {
        title: "Sessions",
        arabic: "الجلسات",
        path: "/sessions",
        icon: Clock3,
      },
    ],
  },

  {
    title: "ARENA",

    items: [
      {
        title: "Players & Members",
        arabic: "اللاعبون والأعضاء",
        path: "/players",
        icon: UserRound,
      },
      {
        title: "Tournaments",
        arabic: "البطولات",
        path: "/tournaments",
        icon: Trophy,
      },
    ],
  },

  {
    title: "BUSINESS",

    items: [
      {
        title: "Billing",
        arabic: "الفوترة",
        path: "/billing",
        icon: Receipt,
      },
      {
        title: "Store",
        arabic: "المتجر",
        path: "/store",
        icon: ShoppingBag,
      },
      {
        title: "Inventory",
        arabic: "المخزون",
        path: "/inventory",
        icon: Boxes,
      },
      {
        title: "Reports",
        arabic: "التقارير",
        path: "/reports",
        icon: BarChart3,
      },
    ],
  },
];

export default function Sidebar() {
  return (
    <aside className="relative z-20 flex h-screen w-[244px] shrink-0 flex-col border-r border-white/[0.07] bg-[#070a14]/95 backdrop-blur-xl">
      <div className="flex h-[86px] shrink-0 items-center border-b border-white/[0.07] px-5">
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-[0_0_30px_rgba(139,92,246,0.28)]">
            <Gamepad2 size={22} />

            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#070a14] bg-cyan-300" />
          </div>

          <div>
            <h1 className="text-base font-bold tracking-[0.16em]">
              NOXUS
            </h1>

            <p className="mt-1 text-[10px] tracking-[0.18em] text-white/35">
              ARENA MANAGER
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navigationGroups.map((group) => (
          <div
            key={group.title}
            className="mb-5 last:mb-0"
          >
            <p className="mb-2 px-3 text-[9px] font-semibold tracking-[0.2em] text-white/25">
              {group.title}
            </p>

            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === "/"}
                    className={({
                      isActive,
                    }) =>
                      `group relative flex min-h-11 items-center gap-3 overflow-hidden rounded-lg px-3 transition ${
                        isActive
                          ? "bg-gradient-to-r from-violet-600/90 to-violet-500/45 text-white shadow-[0_8px_28px_rgba(124,58,237,0.17)]"
                          : "text-white/45 hover:bg-white/[0.05] hover:text-white"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-fuchsia-300" />
                        )}

                        <Icon
                          size={18}
                          className={
                            isActive
                              ? "text-white"
                              : "text-white/35 transition group-hover:text-violet-300"
                          }
                        />

                        <div className="min-w-0 leading-tight">
                          <p className="truncate text-[13px] font-medium">
                            {item.title}
                          </p>

                          <p className="mt-0.5 truncate text-[9px] text-white/30">
                            {item.arabic}
                          </p>
                        </div>
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-white/[0.07] p-3">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `mb-3 flex h-11 items-center gap-3 rounded-lg px-3 text-sm transition ${
              isActive
                ? "bg-violet-500/15 text-violet-200"
                : "text-white/45 hover:bg-white/[0.05] hover:text-white"
            }`
          }
        >
          <Settings size={18} />

          <span>Settings</span>

          <span className="ml-auto text-[10px] text-white/25">
            الإعدادات
          </span>
        </NavLink>

        <div className="rounded-lg border border-emerald-400/10 bg-emerald-400/[0.05] p-3">
          <div className="flex items-center gap-2 text-xs text-emerald-300">
            <Wifi size={14} />
            System Online
          </div>

          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.07]">
            <div className="h-full w-full bg-gradient-to-r from-emerald-500 to-cyan-400" />
          </div>

          <p className="mt-2 text-[9px] text-white/25">
            Noxus Arena v0.1
          </p>
        </div>
      </div>
    </aside>
  );
}