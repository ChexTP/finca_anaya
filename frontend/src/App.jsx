import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import { getInitialRouteByRole } from "./controllers/authController";
import { useAuth } from "./context/AuthContext";
import LoginPage from "./modules/auth/LoginPage";
import BackupsPage from "./modules/backups/BackupsPage";
import CoffeeProfilesPage from "./modules/catalogs/CoffeeProfilesPage";
import ClientsPage from "./modules/clients/ClientsPage";
import CommercialPage from "./modules/commercial/CommercialPage";
import DashboardPage from "./modules/dashboard/DashboardPage";
import DocumentsPage from "./modules/documents/DocumentsPage";
import InventoryPage from "./modules/inventory/InventoryPage";
import LaboratoryPage from "./modules/laboratory/LaboratoryPage";
import PayablesPage from "./modules/payables/PayablesPage";
import ProcessesPage from "./modules/processes/ProcessesPage";
import ReportsPage from "./modules/reports/ReportsPage";
import SalesPage from "./modules/sales/SalesPage";
import SamplesPage from "./modules/samples/SamplesPage";
import UsersPage from "./modules/users/UsersPage";
import WarehousePage from "./modules/warehouse/WarehousePage";

const RoleRedirect = () => {
  const { user } = useAuth();

  return <Navigate to={getInitialRouteByRole(user.role)} replace />;
};

const App = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<RoleRedirect />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute roles={["admin", "accounting"]}>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventario"
          element={
            <ProtectedRoute roles={["admin", "accounting", "warehouse"]}>
              <InventoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/procesos"
          element={
            <ProtectedRoute roles={["admin", "warehouse", "laboratory"]}>
              <ProcessesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bodega"
          element={
            <ProtectedRoute roles={["admin", "warehouse"]}>
              <WarehousePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/laboratorio"
          element={
            <ProtectedRoute roles={["admin", "laboratory"]}>
              <LaboratoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/comercial"
          element={
            <ProtectedRoute roles={["admin", "accounting", "seller"]}>
              <CommercialPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/muestras"
          element={
            <ProtectedRoute roles={["admin", "accounting", "seller", "samples"]}>
              <SamplesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ventas"
          element={
            <ProtectedRoute roles={["admin", "accounting", "warehouse", "seller"]}>
              <SalesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cuentas-por-pagar"
          element={
            <ProtectedRoute roles={["admin", "accounting"]}>
              <PayablesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/clientes"
          element={
            <ProtectedRoute roles={["admin", "accounting", "seller"]}>
              <ClientsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reportes"
          element={
            <ProtectedRoute roles={["admin", "accounting"]}>
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/documentos"
          element={
            <ProtectedRoute roles={["admin", "accounting", "seller"]}>
              <DocumentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/backups"
          element={
            <ProtectedRoute roles={["admin", "accounting"]}>
              <BackupsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/usuarios"
          element={
            <ProtectedRoute roles={["admin"]}>
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/perfiles-cafe"
          element={
            <ProtectedRoute roles={["admin"]}>
              <CoffeeProfilesPage />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

export default App;
