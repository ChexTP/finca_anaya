import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import { getInitialRouteByRole } from "./controllers/authController";
import { useAuth } from "./context/AuthContext";
import LoginPage from "./modules/auth/LoginPage";
import BackupsPage from "./modules/backups/BackupsPage";
import CodeCountersPage from "./modules/admin/CodeCountersPage";
import CoffeeCategoriesPage from "./modules/catalogs/CoffeeCategoriesPage";
import CoffeeProfilesPage from "./modules/catalogs/CoffeeProfilesPage";
import PurchaseCoffeesPage from "./modules/catalogs/PurchaseCoffeesPage";
import ClientsPage from "./modules/clients/ClientsPage";
import CommercialPage from "./modules/commercial/CommercialPage";
import DashboardPage from "./modules/dashboard/DashboardPage";
// Modulo comercial desactivado visualmente: documentos con precios/facturas quedan fuera del flujo operativo.
// import DocumentsPage from "./modules/documents/DocumentsPage";
import InventoryPage from "./modules/inventory/InventoryPage";
import InventorySummaryPage from "./modules/inventory/InventorySummaryPage";
import LaboratoryPage from "./modules/laboratory/LaboratoryPage";
import ManagementPage from "./modules/management/ManagementPage";
import PayablesPage from "./modules/payables/PayablesPage";
import ProcessesPage from "./modules/processes/ProcessesPage";
// import ReportsPage from "./modules/reports/ReportsPage";
import SalesHistoryPage from "./modules/sales/SalesHistoryPage";
import SalesPage from "./modules/sales/SalesPage";
import SamplesHistoryPage from "./modules/samples/SamplesHistoryPage";
import SamplesPage from "./modules/samples/SamplesPage";
import SuppliersPage from "./modules/suppliers/SuppliersPage";
import UsersPage from "./modules/users/UsersPage";
import LotHistoryPage from "./modules/warehouse/LotHistoryPage";
import LotReservationsPage from "./modules/warehouse/LotReservationsPage";
import WarehousePage from "./modules/warehouse/WarehousePage";
import WarehousePendingPage from "./modules/warehouse/WarehousePendingPage";

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
            <ProtectedRoute roles={["admin", "accounting", "warehouse", "laboratory", "seller", "management"]}>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/gerencia"
          element={
            <ProtectedRoute roles={["admin", "accounting", "management"]}>
              <ManagementPage />
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
          path="/resumen-inventario"
          element={
            <ProtectedRoute roles={["admin", "accounting", "warehouse", "management", "inventory_viewer"]}>
              <InventorySummaryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/liquidaciones"
          element={
            <ProtectedRoute roles={["admin", "accounting"]}>
              <InventoryPage mode="liquidations" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventario/editar"
          element={
            <ProtectedRoute roles={["admin", "warehouse"]}>
              <InventoryPage mode="edit" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventario/muestras"
          element={
            <ProtectedRoute roles={["admin", "accounting", "warehouse"]}>
              <InventoryPage mode="samples" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventario/finca"
          element={
            <ProtectedRoute roles={["admin", "accounting", "warehouse"]}>
              <InventoryPage mode="farm" />
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
          path="/trilladora"
          element={
            <ProtectedRoute roles={["admin", "warehouse"]}>
              <ProcessesPage
                fixedProcessType="Trilladora"
                title="Trilladora"
                description="Envios a trilladora, retorno fisico y paso a laboratorio."
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/seleccionadora"
          element={
            <ProtectedRoute roles={["admin", "warehouse"]}>
              <ProcessesPage
                fixedProcessType="Seleccion electronica"
                title="Seleccionadora"
                description="Envios a seleccion electronica, retorno fisico y paso a laboratorio."
              />
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
          path="/bodega/pendientes"
          element={
            <ProtectedRoute roles={["admin", "accounting", "warehouse"]}>
              <WarehousePendingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bodega/lotes-asignados"
          element={
            <ProtectedRoute roles={["admin", "accounting", "warehouse"]}>
              <LotReservationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bodega/historico-aceptados"
          element={
            <ProtectedRoute roles={["admin", "accounting", "warehouse"]}>
              <LotHistoryPage type="accepted" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bodega/historico-rechazados"
          element={
            <ProtectedRoute roles={["admin", "accounting", "warehouse"]}>
              <LotHistoryPage type="rejected" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/proveedores"
          element={
            <ProtectedRoute roles={["admin", "accounting", "warehouse"]}>
              <SuppliersPage />
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
            <ProtectedRoute roles={["admin", "accounting"]}>
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
          path="/muestras/historico"
          element={
            <ProtectedRoute roles={["admin", "samples"]}>
              <SamplesHistoryPage />
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
          path="/ventas/historico"
          element={
            <ProtectedRoute roles={["admin", "accounting"]}>
              <SalesHistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ordenes-compra"
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
        {/* Reportes financieros desactivados: el sistema queda enfocado en inventario y operacion.
        <Route
          path="/reportes"
          element={
            <ProtectedRoute roles={["admin", "accounting"]}>
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        */}
        {/* Documentos comerciales/facturas desactivados; las ordenes operativas se imprimen desde pedidos/ventas.
        <Route
          path="/documentos"
          element={
            <ProtectedRoute roles={["admin", "accounting", "seller"]}>
              <DocumentsPage />
            </ProtectedRoute>
          }
        />
        */}
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
            <ProtectedRoute roles={["admin", "accounting"]}>
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tipos-cafe"
          element={
            <ProtectedRoute roles={["admin", "accounting", "warehouse"]}>
              <CoffeeCategoriesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/perfiles-cafe"
          element={
            <ProtectedRoute roles={["admin", "accounting", "warehouse"]}>
              <CoffeeProfilesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/perfiles-compra"
          element={
            <ProtectedRoute roles={["admin", "accounting", "warehouse"]}>
              <PurchaseCoffeesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/consecutivos"
          element={
            <ProtectedRoute roles={["admin", "accounting", "warehouse"]}>
              <CodeCountersPage />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

export default App;
