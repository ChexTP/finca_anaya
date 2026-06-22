import { Download, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import EmptyState from "../../components/EmptyState";
import { apiRequest, getToken } from "../../utils/api";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

const reports = [
  { key: "sales-summary", label: "Resumen de ventas", path: "/reports/sales-summary", currency: true, dates: true },
  { key: "sales-by-seller", label: "Ventas por vendedor", path: "/reports/sales-by-seller", currency: true, dates: true },
  { key: "sales-by-profile", label: "Ventas por perfil", path: "/reports/sales-by-profile", currency: true, dates: true },
  { key: "profit", label: "Utilidad estimada", path: "/reports/profit", currency: true, dates: true },
  { key: "accounts-receivable", label: "Cuentas por cobrar", path: "/reports/accounts-receivable", currency: true },
  { key: "accounts-payable", label: "Cuentas por pagar", path: "/reports/accounts-payable", payableStatus: true },
  { key: "inventory", label: "Inventario", path: "/reports/inventory" },
];

const labels = {
  currency: "Moneda",
  sales_count: "Ventas",
  subtotal: "Subtotal",
  shipping_total: "Envio",
  total: "Total",
  amount_paid: "Pagado",
  balance_due: "Saldo",
  seller_name: "Vendedor",
  coffee_group: "Cafe",
  quantity_kg: "Kg",
  sale_code: "Venta",
  client_name: "Cliente",
  coffee_revenue: "Venta cafe",
  coffee_cost: "Costo cafe",
  estimated_profit: "Utilidad",
  code: "Codigo",
  payment_status: "Pago",
  status: "Estado",
  estimated_payment_date: "Fecha pago",
  category_name: "Categoria",
  supplier_name: "Proveedor",
  third_party_name: "Tercero",
  description: "Descripcion",
  due_date: "Vence",
  group_type: "Grupo",
  group_name: "Cafe",
  lots_count: "Lotes",
  available_weight_kg: "Disponible kg",
  estimated_cost_value: "Valor costo",
  oldest_lot_date: "Mas antiguo",
};

const moneyFields = new Set([
  "subtotal",
  "shipping_total",
  "total",
  "amount_paid",
  "balance_due",
  "coffee_revenue",
  "coffee_cost",
  "estimated_profit",
  "estimated_cost_value",
]);

const dateFields = new Set(["estimated_payment_date", "due_date", "oldest_lot_date", "created_at"]);

const formatValue = (key, value, row) => {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (moneyFields.has(key)) {
    return `${row.currency || "COP"} ${Number(value).toLocaleString("es-CO")}`;
  }

  if (dateFields.has(key)) {
    return new Date(value).toLocaleDateString("es-CO");
  }

  return String(value);
};

const ReportsPage = () => {
  const [selectedReportKey, setSelectedReportKey] = useState("sales-summary");
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    currency: "",
    payableStatus: "",
  });
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedReport = useMemo(() => {
    return reports.find((report) => report.key === selectedReportKey) || reports[0];
  }, [selectedReportKey]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();

    if (selectedReport.dates && filters.dateFrom) {
      params.set("dateFrom", filters.dateFrom);
    }

    if (selectedReport.dates && filters.dateTo) {
      params.set("dateTo", filters.dateTo);
    }

    if (selectedReport.currency && filters.currency) {
      params.set("currency", filters.currency);
    }

    if (selectedReport.payableStatus && filters.payableStatus) {
      params.set("status", filters.payableStatus);
    }

    return params.toString();
  }, [filters, selectedReport]);

  const reportPath = queryString ? `${selectedReport.path}?${queryString}` : selectedReport.path;

  const loadReport = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await apiRequest(reportPath);
      setRows(data);
    } catch (requestError) {
      setError(requestError.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [selectedReportKey]);

  const downloadReport = async () => {
    const separator = reportPath.includes("?") ? "&" : "?";
    const response = await fetch(`${API_URL}${reportPath}${separator}format=csv`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedReport.key}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const columns = rows[0] ? Object.keys(rows[0]).filter((key) => key !== "id" && !key.endsWith("_id")) : [];

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Reportes</h1>
          <p className="text-sm text-slate-500">Consulta rapida y exportaciones CSV compatibles con Excel.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            onClick={loadReport}
          >
            <RefreshCw size={16} />
            Actualizar
          </button>
          <button
            className="inline-flex items-center gap-2 rounded bg-leaf px-3 py-2 text-sm font-semibold text-white"
            onClick={downloadReport}
          >
            <Download size={16} />
            Descargar CSV
          </button>
        </div>
      </div>

      {error && <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <div className="rounded border border-slate-200 bg-white p-3">
            <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Tipo de reporte</p>
            <div className="space-y-1">
              {reports.map((report) => (
                <button
                  key={report.key}
                  className={`block w-full rounded px-3 py-2 text-left text-sm ${
                    selectedReportKey === report.key ? "bg-leaf text-white" : "text-slate-700 hover:bg-slate-100"
                  }`}
                  onClick={() => setSelectedReportKey(report.key)}
                >
                  {report.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded border border-slate-200 bg-white p-3">
            <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Filtros</p>
            <div className="space-y-3">
              {selectedReport.dates && (
                <>
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    type="date"
                    value={filters.dateFrom}
                    onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })}
                  />
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    type="date"
                    value={filters.dateTo}
                    onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })}
                  />
                </>
              )}
              {selectedReport.currency && (
                <select
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  value={filters.currency}
                  onChange={(event) => setFilters({ ...filters, currency: event.target.value })}
                >
                  <option value="">Todas las monedas</option>
                  <option value="COP">COP</option>
                  <option value="USD">USD</option>
                </select>
              )}
              {selectedReport.payableStatus && (
                <select
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  value={filters.payableStatus}
                  onChange={(event) => setFilters({ ...filters, payableStatus: event.target.value })}
                >
                  <option value="">Todos los estados</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="pago_parcial">Pago parcial</option>
                  <option value="pagada">Pagada</option>
                </select>
              )}
              <button className="w-full rounded bg-ink px-3 py-2 text-sm font-semibold text-white" onClick={loadReport}>
                Aplicar filtros
              </button>
            </div>
          </div>
        </aside>

        <div className="rounded border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">{selectedReport.label}</h2>
          </div>
          {loading ? (
            <p className="p-4 text-sm text-slate-500">Cargando reporte...</p>
          ) : rows.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Sin datos" message="No hay informacion para los filtros seleccionados." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    {columns.map((column) => (
                      <th key={column} className="px-3 py-2">
                        {labels[column] || column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row, index) => (
                    <tr key={row.id || `${selectedReport.key}-${index}`}>
                      {columns.map((column) => (
                        <td key={column} className="px-3 py-2">
                          {formatValue(column, row[column], row)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default ReportsPage;
