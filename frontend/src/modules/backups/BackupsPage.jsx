import { DatabaseBackup, Download, FileText, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import EmptyState from "../../components/EmptyState";
import { apiRequest, getToken } from "../../utils/api";
import { companyBrand, getPrintableLogo } from "../../utils/brand";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

const moduleLabels = {
  clients: "Clientes",
  suppliers: "Proveedores",
  lots: "Lotes de cafe",
  inventory_movements: "Movimientos de inventario",
  quotes: "Cotizaciones y preventas",
  quote_items: "Items de cotizaciones",
  sales: "Ventas",
  sale_items: "Items de ventas",
  sale_payments: "Pagos de ventas",
  payables: "Cuentas por pagar",
  payable_payments: "Pagos de cuentas por pagar",
  processes: "Procesos de cafe",
  process_inputs: "Cafe usado en procesos",
  sample_requests: "Solicitudes de muestras",
  purchase_coffees: "Perfiles de compra",
  coffee_profiles: "Perfiles de venta",
};

const formatDateTime = (value) => {
  if (!value) return "Sin fecha";

  return new Date(value).toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

const formatCell = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Si" : "No";
  if (value instanceof Date) return formatDateTime(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const formatHeader = (value) => {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const escapeHtml = (value) => {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};

const BackupsPage = () => {
  const [modules, setModules] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedModule, setSelectedModule] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  const selectedLabel = useMemo(() => {
    return moduleLabels[selectedModule] || selectedModule;
  }, [selectedModule]);

  const loadData = async () => {
    const [moduleData, historyData] = await Promise.all([
      apiRequest("/backups/modules"),
      apiRequest("/backups/history"),
    ]);

    setModules(moduleData.modules || []);
    setHistory(historyData);

    if (!selectedModule && moduleData.modules?.length > 0) {
      setSelectedModule(moduleData.modules[0]);
    }
  };

  useEffect(() => {
    loadData().catch((requestError) => setError(requestError.message));
  }, []);

  const downloadBackup = async () => {
    if (!selectedModule) {
      setError("Selecciona un modulo para generar el backup.");
      return;
    }

    setDownloading(true);
    setMessage("");
    setError("");

    try {
      const token = getToken();
      const response = await fetch(`${API_URL}/backups/export?module=${encodeURIComponent(selectedModule)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.message || "No se pudo generar el backup.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `backup-${selectedModule}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      await loadData();
      setMessage(`Backup de ${selectedLabel} generado correctamente.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDownloading(false);
    }
  };

  const downloadPdfBackup = async () => {
    if (!selectedModule) {
      setError("Selecciona un modulo para generar el PDF.");
      return;
    }

    setDownloading(true);
    setMessage("");
    setError("");

    try {
      const data = await apiRequest(
        `/backups/export-data?module=${encodeURIComponent(selectedModule)}&format=pdf`
      );
      const rows = data.rows || [];

      if (rows.length === 0) {
        throw new Error("No hay datos para exportar en PDF.");
      }

      const headers = Object.keys(rows[0] || {});
      const popup = window.open("", "_blank", "noopener,noreferrer");

      if (!popup) {
        throw new Error("El navegador bloqueo la ventana del PDF. Permite ventanas emergentes para descargarlo.");
      }

      popup.document.write(`
        <html>
          <head>
            <title>Backup ${selectedLabel}</title>
            <style>
              * { box-sizing: border-box; }
              body { font-family: Arial, sans-serif; margin: 28px; color: #111827; }
              .header { display: flex; align-items: center; gap: 18px; border-bottom: 2px solid #1f7a4d; padding-bottom: 14px; margin-bottom: 18px; }
              .logo { width: 130px; height: auto; }
              h1 { margin: 0; font-size: 22px; }
              p { margin: 4px 0; color: #475569; }
              table { width: 100%; border-collapse: collapse; font-size: 11px; }
              th, td { border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: top; }
              th { background: #eef2f7; text-align: left; }
              td { word-break: break-word; }
              @media print { body { margin: 18px; } }
            </style>
          </head>
          <body>
            <div class="header">
              <img class="logo" src="${getPrintableLogo()}" />
              <div>
                <h1>Backup ${selectedLabel}</h1>
                <p>${companyBrand.legalName}</p>
                <p>Generado: ${formatDateTime(new Date())}</p>
              </div>
            </div>
            <table>
              <thead>
                <tr>${headers.map((header) => `<th>${escapeHtml(formatHeader(header))}</th>`).join("")}</tr>
              </thead>
              <tbody>
                ${rows.map((row) => `
                  <tr>
                    ${headers.map((header) => `<td>${escapeHtml(formatCell(row[header]))}</td>`).join("")}
                  </tr>
                `).join("")}
              </tbody>
            </table>
            <script>
              window.onload = () => {
                window.print();
              };
            </script>
          </body>
        </html>
      `);
      popup.document.close();

      await loadData();
      setMessage(`PDF de ${selectedLabel} generado correctamente.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Backups</h1>
          <p className="text-sm text-slate-500">Copias manuales en CSV para respaldo local por modulo.</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          onClick={() => loadData()}
        >
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>

      {message && <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
      {error && <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className="rounded border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <DatabaseBackup size={18} className="text-leaf" />
            <h2 className="text-sm font-semibold text-slate-800">Generar backup</h2>
          </div>

          <div className="mt-4 space-y-3">
            <label className="block text-sm font-medium text-slate-700">Modulo</label>
            <select
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              value={selectedModule}
              onChange={(event) => setSelectedModule(event.target.value)}
            >
              {modules.map((moduleName) => (
                <option key={moduleName} value={moduleName}>
                  {moduleLabels[moduleName] || moduleName}
                </option>
              ))}
            </select>
          </div>

          <button
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded bg-leaf px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            type="button"
            onClick={downloadBackup}
            disabled={downloading || modules.length === 0}
          >
            <Download size={16} />
            {downloading ? "Generando..." : "Descargar CSV"}
          </button>

          <button
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded border border-leaf bg-white px-4 py-2 text-sm font-semibold text-leaf disabled:opacity-60"
            type="button"
            onClick={downloadPdfBackup}
            disabled={downloading || modules.length === 0}
          >
            <FileText size={16} />
            Descargar PDF
          </button>

          <p className="mt-3 text-xs text-slate-500">
            El archivo se guarda en el equipo desde el navegador. Cada descarga queda registrada en el historial.
          </p>
        </div>

        <div className="rounded border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Historial de backups manuales</h2>
          </div>

          {history.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Sin historial" message="Cuando se genere un backup, quedara registrado aqui." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Modulo</th>
                    <th className="px-4 py-3">Formato</th>
                    <th className="px-4 py-3">Generado por</th>
                    <th className="px-4 py-3">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((backup) => (
                    <tr key={backup.id}>
                      <td className="px-4 py-3 font-medium text-ink">
                        {moduleLabels[backup.module_name] || backup.module_name}
                      </td>
                      <td className="px-4 py-3 uppercase text-slate-600">{backup.format}</td>
                      <td className="px-4 py-3 text-slate-600">{backup.exported_by_name || "Sistema"}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDateTime(backup.created_at)}</td>
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

export default BackupsPage;
