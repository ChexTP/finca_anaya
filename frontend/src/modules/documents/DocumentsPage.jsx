import EmptyState from "../../components/EmptyState";

const DocumentsPage = () => {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-ink">Documentos</h1>
        <p className="text-sm text-slate-500">Cotizaciones y ventas listas para impresion.</p>
      </div>
      <EmptyState
        title="Plantillas pendientes"
        message="Cuando se conecten los detalles, esta vista permitira generar documentos imprimibles."
      />
    </section>
  );
};

export default DocumentsPage;
