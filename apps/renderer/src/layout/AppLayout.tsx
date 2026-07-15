import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

export default function AppLayout() {
  return (
    <div className="relative flex h-screen overflow-hidden bg-[#050711] text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-40 -top-48 h-[420px] w-[420px] rounded-full bg-violet-600/[0.08] blur-[120px]" />

        <div className="absolute -bottom-56 left-1/3 h-[480px] w-[480px] rounded-full bg-fuchsia-600/[0.05] blur-[140px]" />
      </div>

      <Sidebar />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar />

        <main className="flex-1 overflow-y-auto p-5 lg:p-6 2xl:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}