import { Bell, Settings, Wifi } from "lucide-react";

export default function Header() {
  return (
    <header className="h-16 bg-[#07070B] border-b border-purple-500/20 flex items-center justify-between px-6">

      {/* Title */}
      <div>
        <h2 className="text-lg font-semibold text-white">
          Command Center
        </h2>

        <p className="text-xs text-gray-400">
          Manage your gaming ecosystem
        </p>
      </div>


      {/* Right side */}
      <div className="flex items-center gap-5">

        {/* Status */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
          <Wifi size={16} className="text-green-400" />

          <span className="text-sm text-green-400">
            ONLINE
          </span>
        </div>


        {/* Notifications */}
        <Bell
          size={20}
          className="text-gray-400 hover:text-purple-400 cursor-pointer"
        />


        {/* Settings */}
        <Settings
          size={20}
          className="text-gray-400 hover:text-blue-400 cursor-pointer"
        />


        {/* User */}
        <div className="w-9 h-9 rounded-full bg-purple-500/30 border border-purple-400/40 flex items-center justify-center text-purple-300 font-bold">
          A
        </div>

      </div>

    </header>
  );
}