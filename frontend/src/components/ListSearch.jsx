import { Search, X } from "lucide-react";

const ListSearch = ({ value, onChange, label, placeholder = "Buscar por nombre o codigo", disabled = false }) => (
  <div className="relative min-w-0">
    <Search size={16} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
    <input role="searchbox" aria-label={label} className="w-full min-w-0 rounded border border-slate-300 bg-white py-2 pl-9 pr-10 text-sm font-normal normal-case text-ink" placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} />
    {value && <button type="button" disabled={disabled} aria-label={`Limpiar ${label.toLocaleLowerCase("es")}`} title="Limpiar busqueda" className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center text-slate-500 hover:text-ink" onClick={() => onChange("")}><X size={16} /></button>}
  </div>
);

export default ListSearch;
