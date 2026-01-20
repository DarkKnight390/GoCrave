import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuthStore } from "../../store/useAuthStore";
import { listenSupportThreads } from "../../services/chat.service";
import "./styles/admin.css";

export default function AdminLayout() {
  const profile = useAuthStore((s) => s.profile);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const unsub = listenSupportThreads((threads) => {
      const total = threads.reduce((sum, t) => sum + Number(t.supportUnread || 0), 0);
      setUnreadTotal(total);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className={`admin-shell${sidebarOpen ? " isSidebarOpen" : ""}`}>
      <aside className={`admin-sidebar${sidebarOpen ? " isOpen" : ""}`}>
        <div className="admin-logo">GoCrave</div>
        <nav className="admin-nav">
          <AdminNavItem to="/admin" label="Dashboard" />
          <AdminNavItem to="/admin/messages" label="Messages" badge={unreadTotal} />
          <AdminNavItem to="/admin/runners" label="Runners" />
          <AdminNavItem to="/admin/restaurants" label="Restaurants" />
          <AdminNavItem to="/admin/orders" label="Orders" />
          <AdminNavItem to="/admin/checkins" label="Attendance" />
          <AdminNavItem to="/admin/promotions" label="Promotions" />
          <AdminNavItem to="/admin/settings" label="Settings" />
        </nav>
        <div className="admin-footer">
          <div className="admin-user">{profile?.name || "Admin"}</div>
          <div className="admin-role">Super Admin</div>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          className="admin-overlay"
          type="button"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button
              className="admin-burger"
              type="button"
              aria-label="Toggle menu"
              onClick={() => setSidebarOpen((prev) => !prev)}
            >
              <span className="admin-burger-line" />
              <span className="admin-burger-line" />
              <span className="admin-burger-line" />
            </button>
            <div className="admin-title">Admin Portal</div>
          </div>
          <div className="admin-user-chip">
            <span>{profile?.name || "Admin"}</span>
            <span className="admin-role-pill">Super Admin</span>
          </div>
        </header>

        <div className="admin-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

function AdminNavItem({ to, label, badge, disabled }) {
  if (disabled) {
    return (
      <div className="admin-nav-item isDisabled">
        <span>{label}</span>
      </div>
    );
  }

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        "admin-nav-item" + (isActive ? " isActive" : "")
      }
    >
      <span className="admin-nav-label">{label}</span>
      {badge > 0 && (
        <span className="admin-nav-badge" aria-label={`${badge} unread`}>
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </NavLink>
  );
}
