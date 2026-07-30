import { AlertTriangle, Eye, FileSpreadsheet, Printer, RefreshCw, Unlock, X } from "lucide-react";
import { Link } from "react-router-dom";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../utils/api";
import { companyBrand, getPrintableLogo } from "../../utils/brand";
import { calculateOperationalKg } from "../../utils/coffeeCalculations";
import { formatCoffeeLotCodeName, formatCoffeeLotOption } from "../../utils/coffeeLots";
import { formatDate } from "./WarehousePage";
import { saleStatusLabels, getSaleStatusTone } from "../../utils/workflow";
import { useEffect, useMemo, useState } from "react";

const formatKg = (value) => `${Number(value || 0).toLocaleString("es-CO", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
})} kg`;

const getItemName = (item) => {
  return item.description || item.coffee_profile_name || item.coffee_type_name || item.variety || "Cafe solicitado";
};

const getLotCoffeeName = (lot) => {
  const descriptors = lot.lot_kind === "PROC"
    ? [lot.coffee_profile_name, lot.commercial_classification !== "Procesado" ? lot.commercial_classification : null]
    : lot.lot_kind === "PASILLA"
      ? ["Pasilla", lot.coffee_type_name]
      : lot.lot_kind === "RECUPERACION"
        ? ["Recuperacion", lot.commercial_classification, lot.coffee_variety, lot.coffee_type_name]
        : [lot.coffee_type_name, lot.commercial_classification, lot.coffee_variety, lot.coffee_profile_name];

  return [...new Set(descriptors.filter(Boolean))].join(" - ") || "Cafe sin clasificar";
};

const getPrimaryComponentName = (item) => {
  return Array.isArray(item.profile_components)
    ? item.profile_components.find((component) => component?.purchase_coffee_name)?.purchase_coffee_name
    : null;
};

const getDeficitCoffeeName = (item) => {
  const primaryComponent = getPrimaryComponentName(item);

  if (item.coffee_profile_category === "Exotico" && primaryComponent && item.coffee_profile_name) {
    return `${primaryComponent} para ${item.coffee_profile_name}`;
  }

  return getItemName(item);
};

const getEstimatedDeficitParts = (item) => {
  const missingKg = Number(item.missing_kg || 0);
  const requiredKg = Number(item.required_kg || 0);
  const requestedKg = Number(item.requested_quantity_kg || 0);
  const reservedProcessKg = Number(item.reserved_process_kg || 0);
  const reservedBaseKg = Number(item.reserved_base_kg || 0);
  const hasSeparatedReservations = reservedProcessKg > 0 || reservedBaseKg > 0;
  const primaryComponent = getPrimaryComponentName(item);
  const baseComponent = item.base_purchase_coffee_name || "Cafe base estimado";

  if (item.coffee_profile_category !== "Exotico" || !primaryComponent || missingKg <= 0 || requestedKg <= 0) {
    return null;
  }

  if (hasSeparatedReservations && requiredKg > 0) {
    const processTargetKg = requiredKg * 0.4;
    const baseTargetKg = requiredKg * 0.6;
    const processInputKg = Math.max(processTargetKg - reservedProcessKg, 0);
    const baseKg = Math.max(baseTargetKg - reservedBaseKg, 0);

    return {
      processComponentName: `${primaryComponent} para ${item.coffee_profile_name}`,
      processInputKg: Number(processInputKg.toFixed(3)),
      baseComponentName: baseComponent,
      baseKg: Number(baseKg.toFixed(3)),
      finalMissingKg: Number((processInputKg + baseKg).toFixed(3)),
    };
  }

  const missingFinalKg = requiredKg > 0
    ? requestedKg * (missingKg / requiredKg)
    : requestedKg;
  const processFinalKg = missingFinalKg * 0.4;
  const baseFinalKg = missingFinalKg * 0.6;
  const processBeforeYieldKg = processFinalKg / 0.95;
  const processInputKg = calculateOperationalKg({
    quantityKg: processBeforeYieldKg,
    productForm: item.product_form,
    processType: item.process_type,
  });
  const baseKg = calculateOperationalKg({
    quantityKg: baseFinalKg,
    productForm: item.product_form,
    processType: item.process_type,
  });

  // Estimacion interna: 40% proceso con rendimiento 95%, 60% base y conversion pergamino/excelso por trilladora.
  return {
    processComponentName: `${primaryComponent} para ${item.coffee_profile_name}`,
    processInputKg,
    baseComponentName: baseComponent,
    baseKg,
    finalMissingKg: missingFinalKg,
  };
};

const escapeCsv = (value) => {
  const text = value === undefined || value === null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

const downloadCsv = ({ filename, headers, rows }) => {
  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCsv).join(";"))
    .join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const printRows = ({ title, headers, rows, summary }) => {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return false;

  const tableRows = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell ?? ""}</td>`).join("")}</tr>`)
    .join("");
  const tableHeaders = headers.map((header) => `<th>${header}</th>`).join("");
  const summaryRows = summary?.rows
    ?.map((row) => `<tr>${row.map((cell) => `<td>${cell ?? ""}</td>`).join("")}</tr>`)
    .join("");
  const summaryHeaders = summary?.headers?.map((header) => `<th>${header}</th>`).join("");

  printWindow.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #102033; padding: 24px; }
          header { align-items: flex-start; display: flex; justify-content: space-between; gap: 24px; margin-bottom: 16px; }
          h1 { font-size: 20px; margin: 0 0 16px; }
          h2 { font-size: 16px; margin: 26px 0 10px; }
          p { font-size: 12px; margin: 4px 0; }
          table { border-collapse: collapse; width: 100%; font-size: 12px; }
          th, td { border: 1px solid #d7dee8; padding: 7px; text-align: left; vertical-align: top; }
          th { background: #eef2f7; }
          .company { text-align: right; }
          .logo { height: 72px; object-fit: contain; width: 150px; }
          .summary th { background: #fff7ed; }
          .summary td:nth-child(2) { font-weight: 700; }
        </style>
      </head>
      <body>
        <header>
          <div>
            <h1>${title}</h1>
            <p>Generado: ${formatDate(new Date())}</p>
          </div>
          <div class="company">
            <img class="logo" src="${getPrintableLogo()}" alt="Anaya Coffee" />
            <p><strong>${companyBrand.legalName}</strong></p>
          </div>
        </header>
        <table>
          <thead><tr>${tableHeaders}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
        ${summaryRows ? `
          <h2>Resumen</h2>
          <table class="summary">
            <thead><tr>${summaryHeaders}</tr></thead>
            <tbody>${summaryRows}</tbody>
          </table>
        ` : ""}
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  return true;
};

const LotReservationsPage = () => {
  const { user } = useAuth();
  const [data, setData] = useState({ lots: [], deficits: [], totals: {} });
  const [search, setSearch] = useState("");
  const [onlyWithDeficit, setOnlyWithDeficit] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [detailModal, setDetailModal] = useState(null);

  const loadData = async () => {
    setMessage("");
    setError("");

    try {
      const response = await apiRequest("/sales/lot-reservations");
      setData(response);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredLots = useMemo(() => {
    const term = search.trim().toLowerCase();

    return (data.lots || []).filter((lot) => {
      const text = [
        lot.code,
        lot.coffee_type_name,
        lot.coffee_profile_name,
        lot.commercial_classification,
        lot.coffee_variety,
        ...(lot.assignments || []).map((assignment) => `${assignment.sale_code} ${assignment.client_name} ${getItemName(assignment)}`),
      ].filter(Boolean).join(" ").toLowerCase();

      return !term || text.includes(term);
    });
  }, [data.lots, search]);

  const filteredDeficits = useMemo(() => {
    const term = search.trim().toLowerCase();

    return (data.deficits || []).filter((item) => {
      const text = [
        item.sale_code,
        item.client_name,
        item.order_assignee,
        getItemName(item),
        getDeficitCoffeeName(item),
        item.product_form,
        item.process_type,
        item.variety,
      ].filter(Boolean).join(" ").toLowerCase();

      if (onlyWithDeficit && Number(item.missing_kg || 0) <= 0) return false;
      return !term || text.includes(term);
    });
  }, [data.deficits, onlyWithDeficit, search]);

  const activeAssignments = useMemo(() => {
    return filteredLots.flatMap((lot) =>
      (lot.assignments || []).map((assignment) => ({
        ...assignment,
        lot,
      }))
    );
  }, [filteredLots]);

  const freeLots = useMemo(() => {
    return filteredLots.filter((lot) => Number(lot.operational_available_kg || 0) > 0);
  }, [filteredLots]);

  const deficitSummary = useMemo(() => {
    const grouped = {};

    filteredDeficits
      .filter((item) => Number(item.missing_kg || 0) > 0)
      .forEach((item) => {
        const estimatedParts = getEstimatedDeficitParts(item);
        const parts = estimatedParts
          ? [
              {
                coffee: estimatedParts.processComponentName,
                category: "Proceso estimado",
                kg: estimatedParts.processInputKg,
              },
              {
                coffee: estimatedParts.baseComponentName,
                category: "Base estimada",
                kg: estimatedParts.baseKg,
              },
            ].filter((part) => Number(part.kg || 0) > 0)
          : [
              {
                coffee: getDeficitCoffeeName(item),
                category: "Cafe solicitado",
                kg: Number(item.missing_kg || 0),
              },
            ];

        parts.forEach((part) => {
          const key = `${part.category}-${part.coffee}`;
          const current = grouped[key] || {
            coffee: part.coffee,
            category: part.category,
            kg: 0,
            sales: new Set(),
            clients: new Set(),
          };

          current.kg += Number(part.kg || 0);
          if (item.sale_code) current.sales.add(item.sale_code);
          if (item.client_name) current.clients.add(item.client_name);
          grouped[key] = current;
        });
      });

    return Object.values(grouped)
      .map((item) => ({
        ...item,
        kg: Number(item.kg.toFixed(3)),
        sales: [...item.sales],
        clients: [...item.clients],
      }))
      .sort((left, right) => left.coffee.localeCompare(right.coffee));
  }, [filteredDeficits]);

  const freeSummary = useMemo(() => {
    const grouped = {};

    freeLots.forEach((lot) => {
      const coffee = getLotCoffeeName(lot);
      const current = grouped[coffee] || {
        coffee,
        kg: 0,
        lots: [],
      };

      current.kg += Number(lot.operational_available_kg || 0);
      current.lots.push(formatCoffeeLotCodeName(lot));
      grouped[coffee] = current;
    });

    return Object.values(grouped)
      .map((item) => ({
        ...item,
        kg: Number(item.kg.toFixed(3)),
      }))
      .sort((left, right) => left.coffee.localeCompare(right.coffee));
  }, [freeLots]);

  const reservedSummary = useMemo(() => {
    const grouped = {};

    activeAssignments.forEach((assignment) => {
      const coffee = getLotCoffeeName(assignment.lot);
      const current = grouped[coffee] || {
        coffee,
        kg: 0,
        lots: new Set(),
        sales: new Set(),
        clients: new Set(),
      };

      current.kg += Number(assignment.quantity_kg || 0);
      if (assignment.lot?.code) current.lots.add(assignment.lot.code);
      if (assignment.sale_code) current.sales.add(assignment.sale_code);
      if (assignment.client_name) current.clients.add(assignment.client_name);
      grouped[coffee] = current;
    });

    return Object.values(grouped)
      .map((item) => ({
        ...item,
        kg: Number(item.kg.toFixed(3)),
        lots: [...item.lots],
        sales: [...item.sales],
        clients: [...item.clients],
      }))
      .sort((left, right) => left.coffee.localeCompare(right.coffee));
  }, [activeAssignments]);

  const detailReports = useMemo(() => {
    const deficitRows = filteredDeficits.map((item) => {
      const estimatedParts = getEstimatedDeficitParts(item);

      return {
        sale: item.sale_code,
        client: item.client_name,
        coffee: getDeficitCoffeeName(item),
        requested: formatKg(item.required_kg),
        reserved: formatKg(item.reserved_kg),
        missing: formatKg(item.missing_kg),
        estimate: estimatedParts
          ? [
              Number(estimatedParts.processInputKg || 0) > 0
                ? `${estimatedParts.processComponentName}: ${formatKg(estimatedParts.processInputKg)}`
                : null,
              Number(estimatedParts.baseKg || 0) > 0
                ? `${estimatedParts.baseComponentName}: ${formatKg(estimatedParts.baseKg)}`
                : null,
              `Final faltante: ${formatKg(estimatedParts.finalMissingKg)}`,
            ].filter(Boolean).join(" / ")
          : formatKg(item.missing_kg),
        delivery: formatDate(item.estimated_delivery_date),
        assignee: item.order_assignee || "-",
      };
    });

    return {
      reserved: {
        title: "Detalle de cafe reservado",
        filename: "detalle-cafe-reservado.csv",
        headers: ["Lote", "Venta", "Cliente", "Cafe", "Kg asignados", "Entrega", "Encargado", "Estado"],
        rows: activeAssignments.map((assignment) => ({
          lot: formatCoffeeLotOption(assignment.lot),
          sale: assignment.sale_code,
          client: assignment.client_name,
          coffee: getItemName(assignment),
          kg: formatKg(assignment.quantity_kg),
          delivery: formatDate(assignment.estimated_delivery_date),
          assignee: assignment.order_assignee || "-",
          status: saleStatusLabels[assignment.sale_status] || assignment.sale_status,
        })),
      },
      reservedSummary: {
        title: "Resumen de cafe reservado",
        filename: "resumen-cafe-reservado.csv",
        headers: ["Cafe", "Kg reservados", "Lotes", "Ventas", "Clientes"],
        rows: reservedSummary.map((item) => ({
          coffee: item.coffee,
          kg: formatKg(item.kg),
          lots: item.lots.join(", "),
          sales: item.sales.join(", "),
          clients: item.clients.join(", "),
        })),
      },
      free: {
        title: "Detalle de cafe libre operativo",
        filename: "detalle-cafe-libre-operativo.csv",
        headers: ["Lote", "Cafe", "Estado", "Fisico", "Reservado", "Libre operativo"],
        rows: freeLots.map((lot) => ({
          lot: formatCoffeeLotCodeName(lot),
          coffee: getLotCoffeeName(lot),
          status: lot.status,
          physical: formatKg(lot.available_weight_kg),
          reserved: formatKg(lot.reserved_kg),
          free: formatKg(lot.operational_available_kg),
        })),
      },
      freeSummary: {
        title: "Resumen de cafe libre operativo",
        filename: "resumen-cafe-libre-operativo.csv",
        headers: ["Cafe", "Kg libres", "Lotes"],
        rows: freeSummary.map((item) => ({
          coffee: item.coffee,
          kg: formatKg(item.kg),
          lots: item.lots.join(", "),
        })),
      },
      deficit: {
        title: "Detalle de deficit de cafe",
        filename: "detalle-deficit-cafe.csv",
        headers: ["Venta", "Cliente", "Cafe", "Pedido", "Reservado", "Faltante", "Estimacion compra/proceso", "Entrega", "Encargado"],
        rows: deficitRows,
      },
      deficitSummary: {
        title: "Resumen de cafe necesario",
        filename: "resumen-cafe-necesario.csv",
        headers: ["Cafe necesario", "Tipo", "Kg totales", "Ventas", "Clientes"],
        rows: deficitSummary.map((item) => ({
          coffee: item.coffee,
          category: item.category,
          kg: formatKg(item.kg),
          sales: item.sales.join(", "),
          clients: item.clients.join(", "),
        })),
      },
    };
  }, [activeAssignments, deficitSummary, filteredDeficits, freeLots, freeSummary, reservedSummary]);

  const selectedReport = detailModal ? detailReports[detailModal] : null;

  const getReportRows = (report) => {
    if (!report) return [];
    return report.rows.map((row) => Object.values(row));
  };

  const exportSelectedReport = () => {
    if (!selectedReport) return;

    downloadCsv({
      filename: selectedReport.filename,
      headers: selectedReport.headers,
      rows: getReportRows(selectedReport),
    });
  };

  const printSelectedReport = () => {
    if (!selectedReport) return;

    const opened = printRows({
      title: selectedReport.title,
      headers: selectedReport.headers,
      rows: getReportRows(selectedReport),
      summary: detailModal === "deficit"
        ? {
            headers: ["Cafe necesario", "Kg totales", "Tipo"],
            rows: deficitSummary.map((item) => [item.coffee, formatKg(item.kg), item.category]),
          }
        : null,
    });

    if (!opened) setError("El navegador bloqueo la ventana de impresion.");
  };

  const canReleaseReservation = ["admin", "warehouse"].includes(user?.role);

  const releaseAssignment = async (assignment) => {
    const confirmed = window.confirm(
      `Confirma liberar ${formatKg(assignment.quantity_kg)} del lote ${formatCoffeeLotCodeName(assignment.lot)} para la venta ${assignment.sale_code}?`
    );

    if (!confirmed) return;

    setMessage("");
    setError("");

    try {
      await apiRequest(`/sales/lot-assignments/${assignment.id}`, { method: "DELETE" });
      await loadData();
      setMessage("Reserva liberada. El lote queda disponible para otra venta y el pedido queda con deficit si falta cafe.");
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Lotes asignados</h1>
          <p className="text-sm text-slate-500">Reservas operativas, cafe libre y deficit de pedidos activos.</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          type="button"
          onClick={loadData}
        >
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>

      {message && <div className="rounded bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
      {error && <div className="rounded bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Fisico en bodega</p>
          <p className="mt-2 text-2xl font-bold text-ink">{formatKg(data.totals?.physical_kg)}</p>
        </div>
        <div className="rounded border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Reservado</p>
          <p className="mt-2 text-2xl font-bold text-amber-700">{formatKg(data.totals?.reserved_kg)}</p>
          <button
            className="mt-3 inline-flex items-center gap-1 rounded border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50"
            type="button"
            onClick={() => setDetailModal("reserved")}
          >
            <Eye size={13} />
            Ver detalle
          </button>
        </div>
        <div className="rounded border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Libre operativo</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{formatKg(data.totals?.operational_available_kg)}</p>
          <button
            className="mt-3 inline-flex items-center gap-1 rounded border border-emerald-300 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
            type="button"
            onClick={() => setDetailModal("free")}
          >
            <Eye size={13} />
            Ver detalle
          </button>
        </div>
        <div className="rounded border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Deficit</p>
          <p className="mt-2 text-2xl font-bold text-rose-700">{formatKg(data.totals?.missing_kg)}</p>
          <button
            className="mt-3 inline-flex items-center gap-1 rounded border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
            type="button"
            onClick={() => setDetailModal("deficit")}
          >
            <Eye size={13} />
            Ver detalle
          </button>
        </div>
      </div>

      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[88vh] w-full max-w-6xl overflow-hidden rounded border border-slate-200 bg-white shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div>
                <h2 className="text-base font-semibold text-ink">{selectedReport.title}</h2>
                <p className="text-xs text-slate-500">{selectedReport.rows.length} registros con los filtros actuales.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  type="button"
                  onClick={printSelectedReport}
                >
                  <Printer size={16} />
                  Imprimir / PDF
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                  type="button"
                  onClick={exportSelectedReport}
                >
                  <FileSpreadsheet size={16} />
                  Excel
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  type="button"
                  onClick={() => setDetailModal(null)}
                >
                  <X size={16} />
                  Cerrar
                </button>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-auto p-4">
              {selectedReport.rows.length === 0 ? (
                <EmptyState title="Sin registros" message="No hay informacion para mostrar con los filtros actuales." />
              ) : (
                <table className="min-w-full text-left text-sm">
                  <thead className="sticky top-0 bg-slate-100 text-slate-600">
                    <tr>
                      {selectedReport.headers.map((header) => (
                        <th key={header} className="px-3 py-2">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {getReportRows(selectedReport).map((row, index) => (
                      <tr key={`${detailModal}-${index}`} className="border-t border-slate-100">
                        {row.map((cell, cellIndex) => (
                          <td key={`${detailModal}-${index}-${cellIndex}`} className="px-3 py-2 align-top">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded border border-slate-200 bg-white p-3">
        <input
          className="min-w-64 flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="Buscar por lote, cliente, venta o cafe"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <label className="inline-flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={onlyWithDeficit}
            onChange={(event) => setOnlyWithDeficit(event.target.checked)}
          />
          Solo deficit
        </label>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <div className="rounded border border-rose-200 bg-white">
          <div className="flex items-center justify-between gap-2 border-b border-rose-100 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-rose-900">Resumen deficit</h2>
              <p className="text-xs text-slate-500">Cafe necesario agrupado.</p>
            </div>
            <button
              className="rounded border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
              type="button"
              onClick={() => setDetailModal("deficitSummary")}
            >
              Exportar
            </button>
          </div>
          {deficitSummary.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Sin deficit" message="No hay cafe faltante con los filtros actuales." />
            </div>
          ) : (
            <div className="max-h-72 overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-rose-50 text-rose-900">
                  <tr>
                    <th className="px-3 py-2">Cafe</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {deficitSummary.map((item) => (
                    <tr key={`${item.category}-${item.coffee}`} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-semibold text-ink">{item.coffee}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">{item.category}</td>
                      <td className="px-3 py-2 font-semibold text-rose-700">{formatKg(item.kg)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded border border-emerald-200 bg-white">
          <div className="flex items-center justify-between gap-2 border-b border-emerald-100 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-emerald-900">Resumen libre operativo</h2>
              <p className="text-xs text-slate-500">Cafe disponible agrupado.</p>
            </div>
            <button
              className="rounded border border-emerald-300 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
              type="button"
              onClick={() => setDetailModal("freeSummary")}
            >
              Exportar
            </button>
          </div>
          {freeSummary.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Sin cafe libre" message="No hay cafe libre con los filtros actuales." />
            </div>
          ) : (
            <div className="max-h-72 overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-emerald-50 text-emerald-900">
                  <tr>
                    <th className="px-3 py-2">Cafe</th>
                    <th className="px-3 py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {freeSummary.map((item) => (
                    <tr key={item.coffee} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-semibold text-ink">{item.coffee}</td>
                      <td className="px-3 py-2 font-semibold text-emerald-700">{formatKg(item.kg)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded border border-amber-200 bg-white">
          <div className="flex items-center justify-between gap-2 border-b border-amber-100 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-amber-900">Resumen reservado</h2>
              <p className="text-xs text-slate-500">Cafe separado agrupado.</p>
            </div>
            <button
              className="rounded border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50"
              type="button"
              onClick={() => setDetailModal("reservedSummary")}
            >
              Exportar
            </button>
          </div>
          {reservedSummary.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Sin reservas" message="No hay cafe reservado con los filtros actuales." />
            </div>
          ) : (
            <div className="max-h-72 overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-amber-50 text-amber-900">
                  <tr>
                    <th className="px-3 py-2">Cafe</th>
                    <th className="px-3 py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {reservedSummary.map((item) => (
                    <tr key={item.coffee} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-semibold text-ink">{item.coffee}</td>
                      <td className="px-3 py-2 font-semibold text-amber-700">{formatKg(item.kg)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="rounded border border-rose-200 bg-white">
        <div className="flex items-center gap-2 border-b border-rose-100 px-4 py-3">
          <AlertTriangle size={16} className="text-rose-700" />
          <h2 className="text-sm font-semibold text-rose-900">Pedidos con deficit</h2>
        </div>
        {filteredDeficits.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Sin deficit" message="No hay pedidos incompletos con los filtros actuales." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-rose-50 text-rose-900">
                <tr>
                  <th className="px-3 py-2">Venta</th>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Cafe</th>
                  <th className="px-3 py-2">Pedido</th>
                  <th className="px-3 py-2">Reservado</th>
                  <th className="px-3 py-2">Faltante</th>
                  <th className="px-3 py-2">Entrega</th>
                  <th className="px-3 py-2">Accion</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeficits.map((item) => (
                  <tr key={item.sale_item_id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-semibold text-ink">{item.sale_code}</td>
                    <td className="px-3 py-2">{item.client_name}</td>
                    <td className="px-3 py-2">{getDeficitCoffeeName(item)}</td>
                    <td className="px-3 py-2">{formatKg(item.required_kg)}</td>
                    <td className="px-3 py-2">{formatKg(item.reserved_kg)}</td>
                    <td className="px-3 py-2">
                      {getEstimatedDeficitParts(item) ? (
                        <div className="space-y-1 text-xs">
                          {Number(getEstimatedDeficitParts(item).processInputKg || 0) > 0 && (
                            <p className="font-semibold text-rose-700">
                              {getEstimatedDeficitParts(item).processComponentName}: {formatKg(getEstimatedDeficitParts(item).processInputKg)}
                            </p>
                          )}
                          {Number(getEstimatedDeficitParts(item).baseKg || 0) > 0 && (
                            <p className="font-semibold text-amber-700">
                              {getEstimatedDeficitParts(item).baseComponentName}: {formatKg(getEstimatedDeficitParts(item).baseKg)}
                            </p>
                          )}
                          <p className="text-slate-500">Faltante perfil final: {formatKg(getEstimatedDeficitParts(item).finalMissingKg)}</p>
                        </div>
                      ) : (
                        <span className="font-semibold text-rose-700">{formatKg(item.missing_kg)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{formatDate(item.estimated_delivery_date)}</td>
                    <td className="px-3 py-2">
                      <Link className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50" to="/bodega/pendientes">
                        <Eye size={13} />
                        Ver pedidos
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Lotes asignados</h2>
          <p className="mt-1 text-xs text-slate-500">
            Reservas activas por venta. Desde aqui se puede liberar una reserva antes de alistar o despachar.
          </p>
        </div>
        {activeAssignments.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Sin lotes asignados" message="No hay reservas activas con los filtros actuales." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Lote</th>
                  <th className="px-3 py-2">Venta</th>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Cafe</th>
                  <th className="px-3 py-2">Kg asignados</th>
                  <th className="px-3 py-2">Entrega</th>
                  <th className="px-3 py-2">Accion</th>
                </tr>
              </thead>
              <tbody>
                {activeAssignments.map((assignment) => (
                  <tr key={assignment.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-semibold text-ink">{formatCoffeeLotOption(assignment.lot)}</td>
                    <td className="px-3 py-2">{assignment.sale_code}</td>
                    <td className="px-3 py-2">{assignment.client_name}</td>
                    <td className="px-3 py-2">{getItemName(assignment)}</td>
                    <td className="px-3 py-2">{formatKg(assignment.quantity_kg)}</td>
                    <td className="px-3 py-2">{formatDate(assignment.estimated_delivery_date)}</td>
                    <td className="px-3 py-2">
                      {canReleaseReservation ? (
                        <button
                          className="inline-flex items-center gap-1 rounded border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                          type="button"
                          onClick={() => releaseAssignment(assignment)}
                        >
                          <Unlock size={13} />
                          Liberar
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500">Solo consulta</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Reservas por lote</h2>
        </div>
        {filteredLots.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Sin lotes" message="No hay lotes asignados o disponibles con los filtros actuales." />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredLots.map((lot) => (
              <details key={lot.id} className="group">
                <summary className="grid cursor-pointer gap-3 px-4 py-3 text-sm hover:bg-slate-50 md:grid-cols-[minmax(0,1fr)_140px_140px_140px]">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{formatCoffeeLotOption(lot)}</p>
                    <p className="text-xs text-slate-500">{lot.status}</p>
                  </div>
                  <p><span className="text-slate-500">Fisico:</span> {formatKg(lot.available_weight_kg)}</p>
                  <p><span className="text-slate-500">Reservado:</span> {formatKg(lot.reserved_kg)}</p>
                  <p className={Number(lot.operational_available_kg) > 0 ? "text-emerald-700" : "text-rose-700"}>
                    <span className="text-slate-500">Libre:</span> {formatKg(lot.operational_available_kg)}
                  </p>
                </summary>
                <div className="px-4 pb-4">
                  {lot.assignments?.length ? (
                    <div className="overflow-x-auto rounded border border-slate-200">
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-slate-100 text-slate-600">
                          <tr>
                            <th className="px-3 py-2">Venta</th>
                            <th className="px-3 py-2">Cliente</th>
                            <th className="px-3 py-2">Cafe</th>
                            <th className="px-3 py-2">Kg reservados</th>
                            <th className="px-3 py-2">Estado</th>
                            <th className="px-3 py-2">Encargado</th>
                            <th className="px-3 py-2">Entrega</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lot.assignments.map((assignment) => (
                            <tr key={assignment.id} className="border-t border-slate-100">
                              <td className="px-3 py-2 font-semibold text-ink">{assignment.sale_code}</td>
                              <td className="px-3 py-2">{assignment.client_name}</td>
                              <td className="px-3 py-2">{getItemName(assignment)}</td>
                              <td className="px-3 py-2">{formatKg(assignment.quantity_kg)}</td>
                              <td className="px-3 py-2">
                                <StatusBadge tone={getSaleStatusTone({ status: assignment.sale_status })}>
                                  {saleStatusLabels[assignment.sale_status] || assignment.sale_status}
                                </StatusBadge>
                              </td>
                              <td className="px-3 py-2">{assignment.order_assignee || "-"}</td>
                              <td className="px-3 py-2">{formatDate(assignment.estimated_delivery_date)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="rounded bg-slate-50 px-3 py-2 text-sm text-slate-500">Este lote no tiene reservas activas.</p>
                  )}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default LotReservationsPage;
