import { Download } from "lucide-react";
import { getToken } from "../../utils/api";

const reports = [
  ["Resumen de ventas", "/reports/sales-summary?format=csv"],
  ["Ventas por vendedor", "/reports/sales-by-seller?format=csv"],
  ["Ventas por perfil", "/reports/sales-by-profile?format=csv"],
  ["Utilidad estimada", "/reports/profit?format=csv"],
  ["Cuentas por cobrar", "/reports/accounts-receivable?format=csv"],
  ["Cuentas por pagar", "/reports/accounts-payable?format=csv"],
  ["Inventario", "/reports/inventory?format=csv"],
];

const ReportsPage = () => {
  const downloadReport = async (path) => {
    const response = await fetch(`http://localhost:4000/api${path}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "reporte.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-ink">Reportes</h1>
        <p className="text-sm text-slate-500">Exportaciones CSV compatibles con Excel.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {reports.map(([label, path]) => (
          <button
            key={label}
            className="flex items-center justify-between rounded border border-slate-200 bg-white p-4 text-left hover:bg-slate-50"
            onClick={() => downloadReport(path)}
          >
            <span className="text-sm font-semibold text-slate-800">{label}</span>
            <Download size={18} className="text-leaf" />
          </button>
        ))}
      </div>
    </section>
  );
};

export default ReportsPage;
