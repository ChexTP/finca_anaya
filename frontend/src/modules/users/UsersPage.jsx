import { KeyRound, RefreshCw, Save, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { apiRequest } from "../../utils/api";
import { roleLabels } from "../../utils/roles";

const initialSeller = {
  name: "",
  username: "",
  password: "",
};

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [sellerForm, setSellerForm] = useState(initialSeller);
  const [passwords, setPasswords] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadUsers = async () => {
    const data = await apiRequest("/users");
    setUsers(data);
  };

  useEffect(() => {
    loadUsers().catch((requestError) => setError(requestError.message));
  }, []);

  const createSeller = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiRequest("/users/sellers", {
        method: "POST",
        body: JSON.stringify(sellerForm),
      });
      setSellerForm(initialSeller);
      await loadUsers();
      setMessage("Vendedor creado correctamente.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const updatePassword = async (user) => {
    const password = passwords[user.id];

    if (!password) {
      setError("Escribe la nueva contrasena antes de guardar.");
      return;
    }

    const confirmed = window.confirm(`Cambiar la contrasena del usuario ${user.username}?`);

    if (!confirmed) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiRequest(`/users/${user.id}/password`, {
        method: "PUT",
        body: JSON.stringify({ password }),
      });
      setPasswords({ ...passwords, [user.id]: "" });
      setMessage("Contrasena actualizada correctamente.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (user) => {
    const nextStatus = !user.is_active;
    const action = nextStatus ? "activar" : "desactivar";
    const confirmed = window.confirm(`Confirmas que deseas ${action} el usuario ${user.username}?`);

    if (!confirmed) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await apiRequest(`/users/${user.id}/status`, {
        method: "PUT",
        body: JSON.stringify({ isActive: nextStatus }),
      });
      await loadUsers();
      setMessage(`Usuario ${nextStatus ? "activado" : "desactivado"} correctamente.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Usuarios</h1>
          <p className="text-sm text-slate-500">Control simple de accesos y vendedores del sistema.</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          onClick={() => loadUsers()}
        >
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>

      {message && <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
      {error && <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Usuarios registrados</h2>
          </div>

          {users.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Sin usuarios" message="Los usuarios activos del sistema apareceran aqui." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Usuario</th>
                    <th className="px-4 py-3">Rol</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Nueva contrasena</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <tr key={user.id} className="align-top">
                      <td className="px-4 py-3 font-medium text-ink">{user.name}</td>
                      <td className="px-4 py-3 text-slate-600">{user.username}</td>
                      <td className="px-4 py-3 text-slate-600">{roleLabels[user.role] || user.role}</td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={user.is_active ? "success" : "danger"}>
                          {user.is_active ? "activo" : "inactivo"}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          className="w-44 rounded border border-slate-300 px-3 py-2 text-sm"
                          type="password"
                          placeholder="Nueva clave"
                          value={passwords[user.id] || ""}
                          onChange={(event) => setPasswords({ ...passwords, [user.id]: event.target.value })}
                        />
                      </td>
                      <td className="space-y-2 px-4 py-3 text-right">
                        <button
                          className="inline-flex items-center justify-center gap-2 rounded bg-leaf px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                          type="button"
                          onClick={() => updatePassword(user)}
                          disabled={saving}
                        >
                          <KeyRound size={16} />
                          Guardar clave
                        </button>
                        <button
                          className="block w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                          type="button"
                          onClick={() => toggleStatus(user)}
                          disabled={saving}
                        >
                          {user.is_active ? "Desactivar" : "Activar"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <form className="rounded border border-slate-200 bg-white p-4" onSubmit={createSeller}>
          <div className="flex items-center gap-2">
            <UserPlus size={18} className="text-leaf" />
            <h2 className="text-sm font-semibold text-slate-800">Nuevo vendedor</h2>
          </div>

          <div className="mt-4 space-y-3">
            <input
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Nombre completo"
              value={sellerForm.name}
              onChange={(event) => setSellerForm({ ...sellerForm, name: event.target.value })}
              required
            />
            <input
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Usuario"
              value={sellerForm.username}
              onChange={(event) => setSellerForm({ ...sellerForm, username: event.target.value })}
              required
            />
            <input
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              type="password"
              placeholder="Contrasena inicial"
              value={sellerForm.password}
              onChange={(event) => setSellerForm({ ...sellerForm, password: event.target.value })}
              required
            />
          </div>

          <button
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded bg-leaf px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            type="submit"
            disabled={saving}
          >
            <Save size={16} />
            Crear vendedor
          </button>
        </form>
      </div>
    </section>
  );
};

export default UsersPage;
