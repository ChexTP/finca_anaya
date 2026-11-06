import { useEffect, useState } from "react";
import ListSearch from "./ListSearch";
import { matchesSearch } from "../utils/listSearch";

const SearchableSelect = ({ label, options, value, onChange, placeholder = "Seleccione", className = "w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm font-normal normal-case text-ink", disabled = false, required = false }) => {
  const [search, setSearch] = useState("");
  useEffect(() => { setSearch(""); }, [value]);
  const visible = options.filter((option) => matchesSearch(search, [option.label, option.searchText]));
  const selected = options.find((option) => String(option.value) === String(value));
  const hiddenSelected = selected && !visible.some((option) => String(option.value) === String(value));
  return <div className="grid min-w-0 gap-1 font-normal normal-case">
    <ListSearch label={`Buscar ${label.toLocaleLowerCase("es")}`} value={search} onChange={setSearch} disabled={disabled} />
    <select aria-label={label} value={value ?? ""} disabled={disabled} required={required} className={className} onChange={(event) => { onChange(event); setSearch(""); }}>
      <option value="">{placeholder}</option>
      {hiddenSelected && <optgroup label="Seleccion actual"><option value={selected.value}>{selected.label}</option></optgroup>}
      {visible.map((option) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
      {visible.length === 0 && <option value="__no_results" disabled>Sin coincidencias</option>}
    </select>
    {search && <span className="text-xs text-slate-500" aria-live="polite">{visible.length} coincidencias</span>}
  </div>;
};

export default SearchableSelect;
