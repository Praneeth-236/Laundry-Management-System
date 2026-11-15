import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export function ProtectedRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="full-screen-state">Getting your laundry space ready…</div>;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
