import { RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../utils/api";
import { formatOperationalKg } from "../../utils/coffeeCalculations";
import { formatCoffeeLotCodeName, formatCoffeeNameWithCode, getProcessIntensityFromNotes, processIntensityOptions } from "../../utils/coffeeLots";

const allOption = "todos";

const getLotQuantity = (lot) => Number(lot.operational_available_kg ?? lot.available_weight_kg ?? 0);

const normalizeText = (value) => String(value || "").trim();

const getCoffeeName = (lot) => {
  if (lot.lot_kind === "PROC") return formatCoffeeNameWithCode(lot, "Proceso sin perfil");
  return formatCoffeeNameWithCode(lot, "Cafe sin clasificar");
};

const getGroupName = (lot) => {
  const presentation = lot.presentation || "Pergamino";

  if (lot.lot_kind === "PROC") {
    return `${presentation} - Procesos - ${getCoffeeName(lot)}`;
  }

  if (lot.lot_kind === "PASILLA") {
    return `${presentation} - Pasillas - ${getCoffeeName(lot)}`;
  }

  if (lot.lot_kind === "RECUPERACION") {
    return `${presentation} - Recuperaciones - ${getCoffeeName(lot)}`;
  }

  return [
    presentation,
    lot.coffee_type_name,
    lot.commercial_classification,
    getCoffeeName(lot),
  ].filter(Boolean).join(" - ");
};

const buildOptions = (lots, getter) => {
  return [...new Set(lots.map(getter).map(normalizeText).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
};

const InventorySummaryPage = () => {
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    search: "",
    presentation: allOption,
    process: allOption,
    category: allOption,
    intensity: allOption,
    status: allOption,
  });

  const loadInventory = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await apiRequest("/inventory/lots");
      setLots(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Error al cargar inventario");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, []);

  const options = useMemo(() => ({
    presentations: buildOptions(lots, (lot) => lot.presentation),
    processes: buildOptions(lots, (lot) => lot.coffee_type_name || (lot.lot_kind === "PROC" ? "Procesado" : "")),
    categories: buildOptions(lots, (lot) => lot.commercial_classification || lot.lot_kind),
    intensities: processIntensityOptions,
    statuses: buildOptions(lots, (lot) => lot.status),
  }), [lots]);

  const filteredLots = useMemo(() => {
    const search = filters.search.trim().toLowerCase();

    return lots.filter((lot) => {
      const process = lot.coffee_type_name || (lot.lot_kind === "PROC" ? "Procesado" : "");
      const category = lot.commercial_classification || lot.lot_kind || "";
      const intensity = lot.lot_kind === "PROC" ? getProcessIntensityFromNotes(lot.lab_notes) : "";

      if (filters.presentation !== allOption && lot.presentation !== filters.presentation) return false;
      if (filters.process !== allOption && process !== filters.process) return false;
      if (filters.category !== allOption && category !== filters.category) return false;
      if (filters.intensity !== allOption && intensity !== filters.intensity) return false;
      if (filters.status !== allOption && lot.status !== filters.status) return false;

      if (!search) return true;

      return [
        lot.code,
        lot.supplier_name,
        lot.presentation,
        process,
        category,
        lot.coffee_variety,
        lot.coffee_profile_name,
        lot.coffee_profile_code,
        getCoffeeName(lot),
        lot.status,
        lot.performance_factor,
        lot.humidity_percent,
        intensity,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }, [filters, lots]);

  const groupedRows = useMemo(() => {
    const groups = filteredLots.reduce((acc, lot) => {
      const groupName = getGroupName(lot);
      const current = acc[groupName] || {
        name: groupName,
        presentation: lot.presentation || "Pergamino",
        process: lot.coffee_type_name || (lot.lot_kind === "PROC" ? "Procesado" : "-"),
        category: lot.commercial_classification || lot.lot_kind || "-",
        intensity: lot.lot_kind === "PROC" ? getProcessIntensityFromNotes(lot.lab_notes) || "-" : "-",
        lotsCount: 0,
        totalKg: 0,
        reservedKg: 0,
        lots: [],
      };

      current.lotsCount += 1;
      current.totalKg += getLotQuantity(lot);
      current.reservedKg += Number(lot.reserved_kg || 0);
      current.lots.push(lot);
      acc[groupName] = current;

      return acc;
    }, {});

    return Object.values(groups).sort((left, right) => right.totalKg - left.totalKg || left.name.localeCompare(right.name));
  }, [filteredLots]);

  const totals = useMemo(() => {
    return filteredLots.reduce((acc, lot) => {
      acc.totalKg += getLotQuantity(lot);
      acc.reservedKg += Number(lot.reserved_kg || 0);
      acc.lotsCount += 1;
      return acc;
    }, { totalKg: 0, reservedKg: 0, lotsCount: 0 });
  }, [filteredLots]);

  const updateFilter = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value }));
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Resumen de inventario</h1>
          <p className="text-sm text-slate-500">Consulta rapida de cantidades por cafe, proceso, categoria y presentacion.</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-white"
          type="button"
          onClick={loadInventory}
        >
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>

      {error && <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Lotes encontrados</p>
          <p className="mt-2 text-2xl font-bold text-ink">{totals.lotsCount}</p>
        </div>
        <div className="rounded border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase text-leaf">Libre operativo</p>
          <p className="mt-2 text-2xl font-bold text-leaf">{formatOperationalKg(totals.totalKg)}</p>
        </div>
        <div className="rounded border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase text-amber-700">Reservado</p>
          <p className="mt-2 text-2xl font-bold text-amber-700">{formatOperationalKg(totals.reservedKg)}</p>
        </div>
      </div>

      <div className="rounded border border-slate-200 bg-white">
        <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-2 xl:grid-cols-6">
          <label className="space-y-1 text-xs font-semibold uppercase text-slate-500 md:col-span-2 xl:col-span-1">
            <span>Buscar</span>
            <div className="flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2">
              <Search size={16} className="text-slate-400" />
              <input
                className="w-full border-0 p-0 text-sm font-normal text-slate-800 outline-none"
                placeholder="Codigo, proveedor, cafe o factor"
                value={filters.search}
                onChange={(event) => updateFilter("search", event.target.value)}
              />
            </div>
          </label>

          <FilterSelect label="Presentacion" value={filters.presentation} options={options.presentations} onChange={(value) => updateFilter("presentation", value)} />
          <FilterSelect label="Proceso" value={filters.process} options={options.processes} onChange={(value) => updateFilter("process", value)} />
          <FilterSelect label="Categoria" value={filters.category} options={options.categories} onChange={(value) => updateFilter("category", value)} />
          <FilterSelect label="Intensidad procesos" value={filters.intensity} options={options.intensities} onChange={(value) => updateFilter("intensity", value)} />
          <FilterSelect label="Estado" value={filters.status} options={options.statuses} onChange={(value) => updateFilter("status", value)} />
        </div>

        {loading ? (
          <div className="p-6 text-sm text-slate-500">Cargando inventario...</div>
        ) : groupedRows.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">No hay cafe con los filtros actuales.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Cafe / grupo</th>
                  <th className="px-3 py-2">Presentacion</th>
                  <th className="px-3 py-2">Proceso</th>
                  <th className="px-3 py-2">Categoria</th>
                  <th className="px-3 py-2">Intensidad</th>
                  <th className="px-3 py-2">Lotes</th>
                  <th className="px-3 py-2">Libre</th>
                  <th className="px-3 py-2">Reservado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groupedRows.map((group) => (
                  <tr key={group.name} className="align-top">
                    <td className="px-3 py-2">
                      <p className="font-semibold text-ink">{group.name}</p>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs font-semibold text-leaf">Ver lotes</summary>
                        <div className="mt-2 space-y-1 text-xs text-slate-600">
                          {group.lots.map((lot) => (
                            <p key={lot.id}>
                              {formatCoffeeLotCodeName(lot)} · libre {formatOperationalKg(getLotQuantity(lot))}
                              {lot.lot_kind === "PROC" ? ` · intensidad ${getProcessIntensityFromNotes(lot.lab_notes) || "-"}` : ""}
                            </p>
                          ))}
                        </div>
                      </details>
                    </td>
                    <td className="px-3 py-2">{group.presentation}</td>
                    <td className="px-3 py-2">{group.process}</td>
                    <td className="px-3 py-2">{group.category}</td>
                    <td className="px-3 py-2">{group.intensity}</td>
                    <td className="px-3 py-2">{group.lotsCount}</td>
                    <td className="px-3 py-2 font-semibold text-leaf">{formatOperationalKg(group.totalKg)}</td>
                    <td className="px-3 py-2 font-semibold text-amber-700">{formatOperationalKg(group.reservedKg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};

const FilterSelect = ({ label, value, options, onChange }) => (
  <label className="space-y-1 text-xs font-semibold uppercase text-slate-500">
    <span>{label}</span>
    <select
      className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value={allOption}>Todos</option>
      {options.map((option) => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
  </label>
);

export default InventorySummaryPage;
