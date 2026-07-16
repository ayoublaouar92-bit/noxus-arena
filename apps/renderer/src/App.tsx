import {
  HashRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import AppLayout from "./layout/AppLayout";

import Billing from "./pages/Billing";
import Dashboard from "./pages/Dashboard";
import Devices from "./pages/Devices";
import Inventory from "./pages/Inventory";
import Players from "./pages/Players";
import Reports from "./pages/Reports";
import Sessions from "./pages/Sessions";
import Settings from "./pages/Settings";
import Staff from "./pages/Staff";
import Store from "./pages/Store";
import Tournaments from "./pages/Tournaments";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route
            index
            element={<Dashboard />}
          />

          <Route
            path="devices"
            element={<Devices />}
          />

          <Route
            path="sessions"
            element={<Sessions />}
          />

          <Route
            path="players"
            element={<Players />}
          />

          <Route
            path="members"
            element={
              <Navigate
                to="/players"
                replace
              />
            }
          />

          <Route
            path="tournaments"
            element={<Tournaments />}
          />

          <Route
            path="billing"
            element={<Billing />}
          />

          <Route
            path="store"
            element={<Store />}
          />

          <Route
            path="inventory"
            element={<Inventory />}
          />

          <Route
            path="reports"
            element={<Reports />}
          />

          <Route
            path="staff"
            element={<Staff />}
          />

          <Route
            path="settings"
            element={<Settings />}
          />

          <Route
            path="*"
            element={
              <Navigate
                to="/"
                replace
              />
            }
          />
        </Route>
      </Routes>
    </HashRouter>
  );
}