import {
  LayoutDashboard,
  Monitor,
  Clock3,
  Users,
  BarChart3,
  Settings,
} from "lucide-react";

const menu = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Devices",
    icon: Monitor,
  },
  {
    title: "Sessions",
    icon: Clock3,
  },
  {
    title: "Customers",
    icon: Users,
  },
  {
    title: "Reports",
    icon: BarChart3,
  },
  {
    title: "Settings",
    icon: Settings,
  },
];

export default function Sidebar() {
  return (
    <aside className="w-72 h-screen bg-[#171923] border-r border-purple-900 flex flex-col">

      <div className="h-24 flex items-center justify-center border-b border-purple-900">

        <h1 className="text-3xl font-bold text-purple-400">
          NOXUS
        </h1>

      </div>

      <div className="flex-1 mt-6">

        {menu.map((item) => {

          const Icon = item.icon;

          return (
            <button
              key={item.title}
              className="w-full flex items-center gap-4 px-8 py-4 text-gray-300 hover:bg-purple-700/20 hover:text-purple-400 transition-all duration-300"
            >
              <Icon size={22} />

              <span className="text-lg">
                {item.title}
              </span>
            </button>
          );
        })}

      </div>

      <div className="p-6 border-t border-purple-900">

        <div className="rounded-xl bg-purple-700/20 p-4">

          <p className="text-sm text-gray-400">

            Version

          </p>

          <p className="text-purple-400 font-bold">

            v2.0

          </p>

        </div>

      </div>

    </aside>
  );
}