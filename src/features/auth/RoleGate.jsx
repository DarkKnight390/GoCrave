import { useEffect } from "react";
import { useAuthStore } from "../../store/useAuthStore";
import { Navigate } from "react-router-dom";

export default function RoleGate({ children, role }) {
  const { profile, loading, user } = useAuthStore();

  if (loading) return <p>Loading...</p>;
  if (!user) return <Navigate to="/" />;
  if (!profile) return <p>Loading profile...</p>;

  if (role && profile.role !== role) {
    return <Navigate to="/" />;
  }

  return children;
}
