import { ChevronLeft, ChevronRight } from "lucide-react";

const ListPagination = ({ pagination, label = "resultados" }) => {
  const { total, start, end, page, pageCount, setPage } = pagination;
  return <nav aria-label={`Paginas de ${label}`} className="flex min-w-0 flex-wrap items-center justify-between gap-2 py-3 text-xs text-slate-600">
    <span aria-live="polite">{start}-{end} de {total} {label}</span>
    {pageCount > 1 && <div className="flex shrink-0 items-center gap-2">
      <button type="button" title="Pagina anterior" aria-label={`Pagina anterior de ${label}`} disabled={page === 1} onClick={() => setPage(page - 1)} className="flex h-9 w-9 items-center justify-center rounded border border-slate-300 bg-white disabled:opacity-40"><ChevronLeft size={16} /></button>
      <span>Pagina {page} de {pageCount}</span>
      <button type="button" title="Pagina siguiente" aria-label={`Pagina siguiente de ${label}`} disabled={page === pageCount} onClick={() => setPage(page + 1)} className="flex h-9 w-9 items-center justify-center rounded border border-slate-300 bg-white disabled:opacity-40"><ChevronRight size={16} /></button>
    </div>}
  </nav>;
};

export default ListPagination;
