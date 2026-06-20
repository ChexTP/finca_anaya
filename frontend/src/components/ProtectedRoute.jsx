import { Navigate, useLocation } from "react-router-dom";
import { getInitialRouteByRole } from "../controllers/authController";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-600">Cargando...</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={getInitialRouteByRole(user.role)} replace />;
  }

  return children;
};

export default ProtectedRoute;
