import { alphabetLetters } from "../utils/alphabeticalNames";

const NameInitialFilter = ({ value, onChange }) => (
  <label className="flex min-w-0 items-center gap-2 text-sm text-slate-600">
    Letra
    <select
      aria-label="Filtrar por letra"
      className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-ink"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">Todas las letras</option>
      {alphabetLetters.map((letter) => <option key={letter} value={letter}>{letter === "#" ? "0-9 y otros" : letter}</option>)}
    </select>
  </label>
);

export default NameInitialFilter;
