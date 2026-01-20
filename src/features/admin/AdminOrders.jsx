import { useEffect, useMemo, useState } from "react";
import { listenOrders, updateOrderStatus } from "../../services/rtdb.service";
import { listenRunners } from "../../services/runners.service";

const statusLabel = (status) => {
  switch (status) {
    case "pending":
      return "Pending";
    case "accepted":
    case "on_route":
    case "delivering":
      return "On route";
    case "delivered":
      return "Delivered";
    case "cancelled":
      return "Rejected";
    default:
      return status;
  }
};

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [runners, setRunners] = useState([]);
  const [assignments, setAssignments] = useState({});

  useEffect(() => {
    const unsub = listenOrders((list) => setOrders(list));
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = listenRunners((list) => {
      setRunners(
        list.filter(
          (r) =>
            r.runnerType === "goCrave" &&
            r.status !== "inactive" &&
            r.status !== "suspended"
        )
      );
    });
    return () => unsub();
  }, []);

  const pendingOrders = useMemo(
    () => orders.filter((o) => o.status === "pending"),
    [orders]
  );
  const onRouteOrders = useMemo(
    () => orders.filter((o) => ["accepted", "on_route", "delivering"].includes(o.status)),
    [orders]
  );
  const deliveredOrders = useMemo(
    () => orders.filter((o) => o.status === "delivered"),
    [orders]
  );

  const assignRunner = (orderId, runnerId) => {
    setAssignments((s) => ({ ...s, [orderId]: runnerId }));
  };

  const acceptOrder = async (order) => {
    const runnerId = assignments[order.orderId];
    if (!runnerId) {
      alert("Select a GoCrave runner before accepting.");
      return;
    }
    await updateOrderStatus(order.orderId, {
      status: "accepted",
      runnerId,
    });
  };

  const rejectOrder = async (order) => {
    await updateOrderStatus(order.orderId, {
      status: "cancelled",
      runnerId: null,
    });
  };

  return (
    <div className="gc-adminDashboard">
      <div className="gc-adminCard">
        <div className="gc-adminCardHeader">
          <div>
            <div className="gc-adminCardTitle">Orders</div>
            <div className="gc-adminCardSub">
              Manage pending, on route, and delivered orders.
            </div>
          </div>
        </div>

        <div className="gc-restGrid">
          <div className="gc-panel">
            <h3 className="gc-panelTitle">Pending</h3>
            {pendingOrders.length === 0 ? (
              <p className="gc-muted">No pending orders.</p>
            ) : (
              pendingOrders.map((order) => (
                <div key={order.orderId} className="gc-menuItem" style={{ alignItems: "center" }}>
                  <div>
                    <div className="gc-menuName">{order.restaurantName}</div>
                    <div className="gc-muted" style={{ fontSize: 12 }}>
                      {order.delivery?.addressText || "Delivery spot"} • {statusLabel(order.status)}
                    </div>
                    <div className="gc-muted" style={{ fontSize: 12 }}>
                      Total: {order.pricing?.total || 0}
                    </div>
                  </div>
                  <div className="gc-inlineActions">
                    <select
                      className="gc-select"
                      value={assignments[order.orderId] || ""}
                      onChange={(e) => assignRunner(order.orderId, e.target.value)}
                    >
                      <option value="">Assign runner</option>
                      {runners.map((runner) => (
                        <option key={runner.runnerId} value={runner.runnerId}>
                          {runner.name} ({runner.runnerId})
                        </option>
                      ))}
                    </select>
                    <button className="gc-miniBtn" type="button" onClick={() => acceptOrder(order)}>
                      Accept
                    </button>
                    <button className="gc-dangerBtn" type="button" onClick={() => rejectOrder(order)}>
                      Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="gc-panel">
            <h3 className="gc-panelTitle">On route</h3>
            {onRouteOrders.length === 0 ? (
              <p className="gc-muted">No active deliveries.</p>
            ) : (
              onRouteOrders.map((order) => (
                <div key={order.orderId} className="gc-menuItem">
                  <div>
                    <div className="gc-menuName">{order.restaurantName}</div>
                    <div className="gc-muted" style={{ fontSize: 12 }}>
                      {order.delivery?.addressText || "Delivery spot"} • {statusLabel(order.status)}
                    </div>
                    <div className="gc-muted" style={{ fontSize: 12 }}>
                      Runner: {order.runnerId || "-"}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="gc-panel" style={{ marginTop: 16 }}>
          <h3 className="gc-panelTitle">Delivered</h3>
          {deliveredOrders.length === 0 ? (
            <p className="gc-muted">No delivered orders yet.</p>
          ) : (
            deliveredOrders.map((order) => (
              <div key={order.orderId} className="gc-menuItem">
                <div>
                  <div className="gc-menuName">{order.restaurantName}</div>
                  <div className="gc-muted" style={{ fontSize: 12 }}>
                    {order.delivery?.addressText || "Delivery spot"} • {statusLabel(order.status)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
