import { Coffee } from "lucide-react";
import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { getInitialRouteByRole } from "../../controllers/authController";
import { useAuth } from "../../context/AuthContext";

const LoginPage = () => {
  const { login, isAuthenticated, user } = useAuth();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  if (isAuthenticated) {
    return <Navigate to={getInitialRouteByRole(user.role)} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await login(form);
      navigate(location.state?.from?.pathname || getInitialRouteByRole(data.user.role), { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <section className="w-full max-w-sm rounded border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded bg-leaf text-white">
            <Coffee size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-ink">Finca Anaya</h1>
            <p className="text-sm text-slate-500">Sistema interno</p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Usuario</span>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-leaf"
              value={form.username}
              onChange={(event) => setForm({ ...form, username: event.target.value })}
              autoComplete="username"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Contrasena</span>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-leaf"
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              autoComplete="current-password"
            />
          </label>
          {error && <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <button
            className="w-full rounded bg-leaf px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </section>
    </main>
  );
};

export default LoginPage;
