import { RefreshCw, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../utils/api";
import { formatOperationalKg } from "../../utils/coffeeCalculations";
import { formatCoffeeLotCodeName, formatCoffeeNameWithCode, getProcessIntensityFromNotes, processIntensityOptions } from "../../utils/coffeeLots";

const allOption = "todos";

const getLotQuantity = (lot) => Number(lot.operational_available_kg ?? lot.available_weight_kg ?? 0);
const initialReservationForm = {
  quantityKg: "",
  reservedFor: "",
};

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
  const { user } = useAuth();
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [reservationLot, setReservationLot] = useState(null);
  const [reservationForm, setReservationForm] = useState(initialReservationForm);
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

  const canReserveInventory = ["admin", "inventory_viewer"].includes(user?.role);

  const openReservationModal = (lot) => {
    setReservationLot(lot);
    setReservationForm({
      quantityKg: String(lot.operational_available_kg ?? lot.available_weight_kg ?? ""),
      reservedFor: "",
    });
    setError("");
  };

  const closeReservationModal = () => {
    setReservationLot(null);
    setReservationForm(initialReservationForm);
  };

  const registerInventoryReservation = async (event) => {
    event.preventDefault();
    if (!reservationLot) return;

    const quantity = Number(reservationForm.quantityKg);
    const freeOperationalKg = getLotQuantity(reservationLot);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("La cantidad a reservar debe ser mayor a cero");
      return;
    }

    if (quantity > freeOperationalKg + 0.001) {
      setError(`La reserva supera el libre operativo del lote: ${formatOperationalKg(freeOperationalKg)}`);
      return;
    }

    const reservedFor = reservationForm.reservedFor.trim();
    if (!reservedFor) {
      setError("Debe indicar para quien o para que es la reserva");
      return;
    }

    if (!window.confirm(`Confirma reservar ${formatOperationalKg(quantity)} de ${formatCoffeeLotCodeName(reservationLot)}?`)) return;

    setSaving(true);
    setError("");

    try {
      await apiRequest(`/inventory/lots/${reservationLot.id}/reservations`, {
        method: "POST",
        body: JSON.stringify({
          quantityKg: quantity,
          reservedFor,
        }),
      });
      closeReservationModal();
      await loadInventory();
    } catch (err) {
      setError(err.message || "Error al registrar reserva");
    } finally {
      setSaving(false);
    }
  };

  const releaseInventoryReservation = async (reservation) => {
    if (!window.confirm(`Confirma liberar la reserva de ${formatOperationalKg(reservation.quantity_kg)}?`)) return;

    setSaving(true);
    setError("");

    try {
      await apiRequest(`/inventory/reservations/${reservation.id}/release`, {
        method: "PUT",
      });
      await loadInventory();
    } catch (err) {
      setError(err.message || "Error al liberar reserva");
    } finally {
      setSaving(false);
    }
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
                        <div className="mt-2 space-y-2 text-xs text-slate-600">
                          {group.lots.map((lot) => (
                            <div key={lot.id} className="rounded border border-slate-200 bg-white p-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p>
                                  {formatCoffeeLotCodeName(lot)} · libre {formatOperationalKg(getLotQuantity(lot))}
                                  {Number(lot.manual_reserved_kg || 0) > 0 ? ` · reservado manual ${formatOperationalKg(lot.manual_reserved_kg)}` : ""}
                                  {lot.lot_kind === "PROC" ? ` · intensidad ${getProcessIntensityFromNotes(lot.lab_notes) || "-"}` : ""}
                                </p>
                                {canReserveInventory && (
                                  <button
                                    className="rounded border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                                    type="button"
                                    onClick={() => openReservationModal(lot)}
                                    disabled={saving || getLotQuantity(lot) <= 0}
                                  >
                                    Reservar
                                  </button>
                                )}
                              </div>
                              {Array.isArray(lot.manual_reservations) && lot.manual_reservations.length > 0 && (
                                <div className="mt-2 space-y-1 rounded bg-amber-50 p-2 text-amber-900">
                                  {lot.manual_reservations.map((reservation) => (
                                    <div key={reservation.id} className="flex flex-wrap items-center justify-between gap-2">
                                      <span>
                                        {formatOperationalKg(reservation.quantity_kg)} · {reservation.reserved_for}
                                        {reservation.created_by_name ? ` · ${reservation.created_by_name}` : ""}
                                      </span>
                                      {canReserveInventory && (
                                        <button
                                          className="rounded border border-amber-300 bg-white px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                                          type="button"
                                          onClick={() => releaseInventoryReservation(reservation)}
                                          disabled={saving}
                                        >
                                          Liberar
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
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

      {reservationLot && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-4">
          <form
            className="my-6 w-full max-w-xl rounded border border-amber-200 bg-white shadow-xl"
            onSubmit={registerInventoryReservation}
          >
            <div className="flex items-start justify-between gap-3 border-b border-amber-200 px-4 py-3">
              <div>
                <h2 className="text-base font-bold text-ink">Reservar cafe</h2>
                <p className="text-sm text-slate-500">{formatCoffeeLotCodeName(reservationLot)}</p>
              </div>
              <button
                className="rounded border border-slate-300 p-2 text-slate-600 hover:bg-slate-50"
                type="button"
                onClick={closeReservationModal}
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs font-semibold uppercase text-slate-500">Fisico</p>
                  <p className="mt-1 font-bold text-ink">{formatOperationalKg(reservationLot.available_weight_kg)}</p>
                </div>
                <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-xs font-semibold uppercase text-amber-700">Reservado</p>
                  <p className="mt-1 font-bold text-amber-700">{formatOperationalKg(reservationLot.reserved_kg)}</p>
                </div>
                <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <p className="text-xs font-semibold uppercase text-leaf">Libre</p>
                  <p className="mt-1 font-bold text-leaf">{formatOperationalKg(getLotQuantity(reservationLot))}</p>
                </div>
              </div>

              <label className="block space-y-1 text-sm font-semibold text-slate-700">
                <span>Cantidad a reservar kg</span>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2 font-normal"
                  min="0"
                  step="0.5"
                  type="number"
                  value={reservationForm.quantityKg}
                  onChange={(event) => setReservationForm((current) => ({ ...current, quantityKg: event.target.value }))}
                  required
                />
              </label>

              <label className="block space-y-1 text-sm font-semibold text-slate-700">
                <span>Reservado para / motivo</span>
                <textarea
                  className="min-h-24 w-full rounded border border-slate-300 px-3 py-2 font-normal"
                  placeholder="Pedido, cliente o motivo de la reserva"
                  value={reservationForm.reservedFor}
                  onChange={(event) => setReservationForm((current) => ({ ...current, reservedFor: event.target.value }))}
                  required
                />
              </label>

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  type="button"
                  onClick={closeReservationModal}
                >
                  Cancelar
                </button>
                <button
                  className="rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={saving}
                >
                  Guardar reserva
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
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
