import { useEffect, useRef, useState } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";

import AppLayout from "./layout/AppLayout";
import type { StaffUser } from "./lib/staff-ui";

import Billing from "./pages/Billing";
import Dashboard from "./pages/Dashboard";
import Devices from "./pages/Devices";
import GuestDebts from "./pages/GuestDebts";
import Inventory from "./pages/Inventory";
import Login from "./pages/Login";
import Players from "./pages/Players";
import Reports from "./pages/Reports";
import Sessions from "./pages/Sessions";
import Settings from "./pages/Settings";
import Staff from "./pages/Staff";
import Store from "./pages/Store";
import Tournaments from "./pages/Tournaments";

function StartupScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050711] text-white">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-violet-400" />
        <p className="mt-4 text-sm text-white/40">جاري التحقق من الجلسة...</p>
      </div>
    </div>
  );
}

export default function App() {
  const api = (window as any).api;
  const [currentStaff, setCurrentStaff] = useState<StaffUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const focusGuardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const user = (await api.getCurrentStaff()) as StaffUser | null;
        if (active) setCurrentStaff(user ?? null);
      } catch (error) {
        console.error(error);
        if (active) setCurrentStaff(null);
      } finally {
        if (active) setCheckingSession(false);
      }
    }

    void checkSession();
    return () => {
      active = false;
    };
  }, [api]);

  useEffect(() => {
    // When focus escapes to document.body (e.g. after modal closes),
    // redirect it to our focus guard so Electron never loses keyboard routing
    const handleFocusOut = () => {
      setTimeout(() => {
        if (
          !document.activeElement ||
          document.activeElement === document.body
        ) {
          focusGuardRef.current?.focus({ preventScroll: true });
        }
      }, 0);
    };

    // When window regains focus from another app
    const handleWindowFocus = () => {
      api?.requestFocus?.();
    };

    document.addEventListener("focusout", handleFocusOut, true);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      document.removeEventListener("focusout", handleFocusOut, true);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [api]);

  async function logout() {
    try {
      await api.staffLogout();
    } catch (error) {
      console.error(error);
    } finally {
      setCurrentStaff(null);
      window.location.hash = "#/";
    }
  }

  if (checkingSession) return <StartupScreen />;

  if (!currentStaff) {
    return <Login onAuthenticated={setCurrentStaff} />;
  }

  return (
    <>
      {/* Focus guard: invisible element that catches focus before it escapes to body */}
      <div
        ref={focusGuardRef}
        tabIndex={-1}
        aria-hidden="true"
        onFocus={() => api?.requestFocus?.()}
        style={{
          position: "fixed",
          width: 0,
          height: 0,
          overflow: "hidden",
          outline: "none",
          top: 0,
          left: 0,
        }}
      />
      <HashRouter>
        <Routes>
          <Route
            element={
              <AppLayout currentStaff={currentStaff} onLogout={logout} />
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="devices" element={<Devices />} />
            <Route path="sessions" element={<Sessions />} />
            <Route path="players" element={<Players />} />
            <Route
              path="members"
              element={<Navigate to="/players" replace />}
            />
            <Route path="tournaments" element={<Tournaments />} />
            <Route path="billing" element={<Billing />} />
            <Route path="store" element={<Store />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="guest-debts" element={<GuestDebts />} />
            <Route path="reports" element={<Reports />} />
            <Route path="staff" element={<Staff />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </>
  );
}