import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "../../store/useAuthStore";
import { listenRunnerOrders } from "../../services/rtdb.service";

const money = (n) =>
  new Intl.NumberFormat("en-JM", { style: "currency", currency: "JMD" }).format(n || 0);

const formatStatus = (status) => {
  switch (status) {
    case "accepted":
      return "Accepted";
    case "on_route":
      return "On route";
    case "picked_up":
      return "Picked up";
    case "delivered":
      return "Delivered";
    case "cancelled":
      return "Cancelled";
    default:
      return status || "Pending";
  }
};

const buildStatusHistory = (order) => {
  const historyRaw = order?.statusHistory || null;
  if (historyRaw && typeof historyRaw === "object") {
    return Object.values(historyRaw)
      .filter((h) => h?.status && h?.at)
      .sort((a, b) => (a.at || 0) - (b.at || 0));
  }
  const stamps = order?.statusTimestamps || null;
  if (!stamps || typeof stamps !== "object") return [];
  return Object.entries(stamps)
    .map(([status, at]) => ({ status, at }))
    .sort((a, b) => (a.at || 0) - (b.at || 0));
};

export default function RunnerOrders() {
  const user = useAuthStore((s) => s.user);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    if (!user?.uid) return () => {};
    const unsub = listenRunnerOrders(user.uid, setOrders);
    return () => unsub();
  }, [user?.uid]);

  const sorted = useMemo(
    () => [...orders].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    [orders]
  );

  return (
    <div className="gc-page">
      <div className="gc-topbar">
        <div>
          <div className="gc-pill">Orders</div>
          <h2 className="gc-pageTitle">Your deliveries</h2>
          <p className="gc-muted">All accepted and completed orders.</p>
        </div>
      </div>

      <div className="gc-panel" style={{ marginTop: 12 }}>
        {sorted.length === 0 ? (
          <p className="gc-muted">No deliveries yet.</p>
        ) : (
          sorted.map((order) => (
            <div key={order.orderId} className="gc-menuItem">
              <div>
                <div className="gc-menuName">
                  {order.restaurantName || "Restaurant"} • #{String(order.orderId).slice(-4)}
                </div>
                <div className="gc-muted" style={{ fontSize: 12 }}>
                  {order.delivery?.addressText || "Delivery"} • {order.items?.length || 0} items
                </div>
                <div className="gc-muted" style={{ fontSize: 12 }}>
                  Status: {order.status || "pending"}
                </div>
                {buildStatusHistory(order).length > 0 ? (
                  <div className="gc-statusHistory">
                    {buildStatusHistory(order).map((entry, idx) => (
                      <div key={`${entry.status}-${idx}`} className="gc-statusRow">
                        <span className="gc-statusLabel">{formatStatus(entry.status)}</span>
                        <span className="gc-statusTime">
                          {entry.at
                            ? new Date(entry.at).toLocaleString([], {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })
                            : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 900 }}>{money(order.pricing?.total || 0)}</div>
                <div className="gc-muted" style={{ fontSize: 11 }}>
                  {order.createdAt
                    ? new Date(order.createdAt).toLocaleString([], {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : ""}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
