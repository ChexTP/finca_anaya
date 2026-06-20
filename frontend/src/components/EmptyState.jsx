const EmptyState = ({ title, message }) => {
  return (
    <div className="rounded border border-dashed border-slate-300 bg-white px-4 py-8 text-center">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{message}</p>
    </div>
  );
};

export default EmptyState;
