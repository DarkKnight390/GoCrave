import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuthStore } from "../../store/useAuthStore";
import { listenSupportThreads } from "../../services/chat.service";

export default function AdminLayout() {
  const profile = useAuthStore((s) => s.profile);
  const [unreadTotal, setUnreadTotal] = useState(0);

  useEffect(() => {
    const unsub = listenSupportThreads((threads) => {
      const total = threads.reduce((sum, t) => sum + Number(t.supportUnread || 0), 0);
      setUnreadTotal(total);
    });
    return () => unsub();
  }, []);

  return (
    <div className="gc-adminShell">
      <aside className="gc-adminSidebar">
        <div className="gc-adminLogo">GoCrave</div>
        <nav className="gc-adminNav">
          <AdminNavItem to="/admin" label="Dashboard" />
          <AdminNavItem to="/admin/messages" label="Messages" badge={unreadTotal} />
          <AdminNavItem to="/admin/runners" label="Runners" />
          <AdminNavItem to="/admin/restaurants" label="Restaurants" />
          <AdminNavItem to="/admin/orders" label="Orders" />
          <AdminNavItem to="/admin/settings" label="Settings" />
        </nav>
        <div className="gc-adminFooter">
          <div className="gc-adminUser">{profile?.name || "Admin"}</div>
          <div className="gc-adminRole">Super Admin</div>
        </div>
      </aside>

      <div className="gc-adminMain">
        <header className="gc-adminTopbar">
          <div className="gc-adminTitle">Admin Portal</div>
          <div className="gc-adminUserChip">
            <span>{profile?.name || "Admin"}</span>
            <span className="gc-adminRolePill">Super Admin</span>
          </div>
        </header>

        <div className="gc-adminContent">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

function AdminNavItem({ to, label, badge, disabled }) {
  if (disabled) {
    return (
      <div className="gc-adminNavItem isDisabled">
        <span>{label}</span>
      </div>
    );
  }

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        "gc-adminNavItem" + (isActive ? " isActive" : "")
      }
    >
      <span className="gc-adminNavLabel">{label}</span>
      {badge > 0 && (
        <span className="gc-adminNavBadge" aria-label={`${badge} unread`}>
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </NavLink>
  );
}
