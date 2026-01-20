import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onValue, query, ref, orderByChild, equalTo } from "firebase/database";
import { rtdb } from "../../services/firebase";
import { useAuthStore } from "../../store/useAuthStore";
import { updateOrderStatus } from "../../services/rtdb.service";
import { sendChatMessage } from "../../services/chat.service";

const money = (n) =>
  new Intl.NumberFormat("en-JM", { style: "currency", currency: "JMD" }).format(n || 0);
const CANCEL_WINDOW_MS = 15 * 60 * 1000;

export default function CustomerOrders() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("all");
  const [cancelOrder, setCancelOrder] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);

  useEffect(() => {
    if (!user?.uid) return () => {};
    const ordersQuery = query(ref(rtdb, "orders"), orderByChild("userId"), equalTo(user.uid));
    const unsub = onValue(ordersQuery, (snap) => {
      const val = snap.val() || {};
      const list = Object.values(val);
      setOrders(list);
    });
    return () => unsub();
  }, [user?.uid]);

  const sorted = useMemo(() => {
    const list = [...orders].sort((a, b) => (b?.createdAt || 0) - (a?.createdAt || 0));
    if (filter === "all") return list;
    return list.filter((o) => (o?.status || "pending") === filter);
  }, [orders, filter]);

  const submitCancel = async () => {
    if (!cancelOrder?.orderId || !user?.uid) return;
    const reason = cancelReason.trim();
    setCancelBusy(true);
    try {
      await updateOrderStatus(cancelOrder.orderId, {
        status: "cancelled",
        cancelledAt: Date.now(),
        cancelledBy: "customer",
        cancelReason: reason || "Customer requested cancellation.",
      });
      if (cancelOrder.runnerId) {
        await sendChatMessage({
          runnerId: cancelOrder.runnerId,
          runnerName: null,
          customerUid: user.uid,
          customerName: profile?.name || null,
          role: "customer",
          text: `Order cancelled: ${reason || "Customer requested cancellation."}`,
        });
      }
      setCancelOrder(null);
      setCancelReason("");
    } finally {
      setCancelBusy(false);
    }
  };

  return (
    <div className="gc-page">
      <div className="gc-topbar">
        <div>
          <div className="gc-pill">Orders</div>
          <h2 className="gc-pageTitle">Your orders</h2>
          <p className="gc-muted">Delivered and active orders.</p>
        </div>
      </div>

      <div className="gc-panel" style={{ marginTop: 12 }}>
        <div className="gc-filterChips" style={{ marginBottom: 12 }}>
          {[
            { id: "all", label: "All" },
            { id: "pending", label: "Pending" },
            { id: "accepted", label: "Accepted" },
            { id: "delivered", label: "Delivered" },
            { id: "cancelled", label: "Cancelled" },
          ].map((chip) => (
            <button
              key={chip.id}
              type="button"
              className={`gc-chip ${filter === chip.id ? "isActive" : ""}`}
              onClick={() => setFilter(chip.id)}
            >
              {chip.label}
            </button>
          ))}
        </div>
        {sorted.length === 0 ? (
          <p className="gc-muted">No orders yet.</p>
        ) : (
          sorted.map((order) => {
            const createdAt = Number(order?.createdAt || 0);
            const canCancel =
              createdAt > 0 &&
              Date.now() - createdAt <= CANCEL_WINDOW_MS &&
              order.status !== "delivered" &&
              order.status !== "cancelled";

            return (
              <div key={order.orderId} className="gc-menuItem" style={{ alignItems: "center" }}>
                <div>
                  <div className="gc-menuName">
                    {order.restaurantName || "Restaurant"} - #{String(order.orderId).slice(-4)}
                  </div>
                  <div className="gc-muted" style={{ fontSize: 12 }}>
                    {order.items?.length || 0} items - {order.status || "pending"}
                  </div>
                  <div className="gc-muted" style={{ fontSize: 12 }}>
                  {order.createdAt
                    ? new Date(order.createdAt).toLocaleString([], {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : ""}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 900 }}>{money(order?.pricing?.total || 0)}</div>
                {order.status === "delivered" || order.status === "cancelled" ? (
                  <button
                    className="gc-miniBtn"
                    type="button"
                    style={{ marginTop: 8 }}
                    onClick={() => navigate(`/customer/checkout/delivered/${order.orderId}`)}
                  >
                    View
                  </button>
                ) : (
                  <button
                    className="gc-miniBtn brand"
                    type="button"
                    style={{ marginTop: 8 }}
                      onClick={() => navigate(`/customer/track/${order.orderId}`)}
                    >
                      Track
                    </button>
                  )}
                  {canCancel ? (
                    <button
                      className="gc-miniBtn gc-cancelBtn"
                      type="button"
                      style={{ marginTop: 8 }}
                      onClick={() => {
                        setCancelOrder(order);
                        setCancelReason("");
                      }}
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      {cancelOrder && (
        <div
          className="gc-chatModalOverlay"
          role="presentation"
          onClick={() => setCancelOrder(null)}
        >
          <div
            className="gc-chatModalCard"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="gc-chatModalTitle">Cancel order</div>
            <div className="gc-chatModalText">Reason for cancellation</div>
            <textarea
              className="gc-cancelTextarea"
              rows={3}
              placeholder="Add a short reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
            <div className="gc-chatModalActions">
              <button
                className="gc-miniBtn"
                type="button"
                onClick={() => setCancelOrder(null)}
                disabled={cancelBusy}
              >
                Back
              </button>
              <button
                className="gc-btn"
                type="button"
                onClick={submitCancel}
                disabled={cancelBusy}
              >
                Confirm cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
