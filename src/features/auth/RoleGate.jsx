import { useEffect } from "react";
import { useAuthStore } from "../../store/useAuthStore";
import { Navigate } from "react-router-dom";

export default function RoleGate({ children, role }) {
  const { profile, loading } = useAuthStore();

  if (loading) return <p>Loading...</p>;
  if (!profile) return <Navigate to="/" />;

  if (role && profile.role !== role) {
    return <Navigate to="/" />;
  }

  return children;
}
