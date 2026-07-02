import {
  BarChart3,
  Boxes,
  ClipboardList,
  Coffee,
  CreditCard,
  DatabaseBackup,
  FileText,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptText,
  SlidersHorizontal,
  Users,
  UserCog,
  X,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { roleLabels } from "../utils/roles";

const navigation = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard, roles: ["admin", "accounting", "warehouse", "laboratory", "seller"] },
  { label: "Bodega", path: "/bodega", icon: Boxes, roles: ["admin", "warehouse"] },
  { label: "Pendientes", path: "/bodega/pendientes", icon: ClipboardList, roles: ["admin", "warehouse"] },
  { label: "Laboratorio", path: "/laboratorio", icon: Coffee, roles: ["admin", "laboratory"] },
  { label: "Inventario", path: "/inventario", icon: Boxes, roles: ["admin", "accounting", "warehouse"] },
  { label: "Procesos", path: "/procesos", icon: Coffee, roles: ["admin", "warehouse"] },
  { label: "Comercial", path: "/comercial", icon: ClipboardList, roles: ["admin", "accounting", "seller"] },
  { label: "Muestras", path: "/muestras", icon: FlaskConical, roles: ["admin", "accounting", "seller", "samples"] },
  { label: "Ventas", path: "/ventas", icon: ReceiptText, roles: ["admin", "accounting", "warehouse", "seller"] },
  { label: "Cuentas por pagar", path: "/cuentas-por-pagar", icon: CreditCard, roles: ["admin", "accounting"] },
  { label: "Clientes", path: "/clientes", icon: Users, roles: ["admin", "accounting", "seller"] },
  { label: "Reportes", path: "/reportes", icon: BarChart3, roles: ["admin", "accounting"] },
  { label: "Documentos", path: "/documentos", icon: FileText, roles: ["admin", "accounting", "seller"] },
  { label: "Backups", path: "/backups", icon: DatabaseBackup, roles: ["admin", "accounting"] },
  { label: "Perfiles cafe", path: "/perfiles-cafe", icon: SlidersHorizontal, roles: ["admin"] },
  { label: "Usuarios", path: "/usuarios", icon: UserCog, roles: ["admin"] },
];

const AppLayout = () => {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const items = navigation.filter((item) => item.roles.includes(user?.role));

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded border border-slate-200 text-slate-700 lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu size={18} />
            </button>
            <div>
              <p className="text-sm font-bold text-ink">Finca Anaya</p>
              <p className="text-xs text-slate-500">{roleLabels[user?.role] || user?.role}</p>
            </div>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            onClick={logout}
          >
            <LogOut size={16} />
            Salir
          </button>
        </div>
      </header>

      <div className="flex">
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-64 border-r border-slate-200 bg-white pt-14 transition-transform lg:static lg:block lg:translate-x-0 lg:pt-0 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4 lg:hidden">
            <span className="text-sm font-semibold">Menu</span>
            <button className="rounded p-2 text-slate-600" onClick={() => setOpen(false)} aria-label="Cerrar menu">
              <X size={18} />
            </button>
          </div>
          <nav className="space-y-1 p-3">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === "/bodega"}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded px-3 py-2 text-sm font-medium ${
                      isActive ? "bg-leaf text-white" : "text-slate-700 hover:bg-slate-100"
                    }`
                  }
                >
                  <Icon size={17} />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-5 lg:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
