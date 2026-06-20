const styles = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  danger: "bg-rose-50 text-rose-700 ring-rose-200",
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
};

const StatusBadge = ({ children, tone = "neutral" }) => {
  return (
    <span className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium ring-1 ${styles[tone]}`}>
      {children}
    </span>
  );
};

export default StatusBadge;
