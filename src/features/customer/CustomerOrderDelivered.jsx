import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { onValue, ref } from "firebase/database";
import { rtdb } from "../../services/firebase";
import { submitRunnerRating, dismissRatingRequest } from "../../services/ratings.service";
import { useAuthStore } from "../../store/useAuthStore";

const money = (n) =>
  new Intl.NumberFormat("en-JM", { style: "currency", currency: "JMD" }).format(n || 0);

const renderStars = (value) => {
  const val = Math.max(0, Math.min(5, Number(value || 0)));
  return "★★★★★☆☆☆☆☆".slice(5 - val, 10 - val);
};

const formatDate = (value) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "-";
  }
};

export default function CustomerOrderDelivered() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [order, setOrder] = useState(null);
  const [ratingRequest, setRatingRequest] = useState(null);
  const [stars, setStars] = useState(0);
  const [ratingBusy, setRatingBusy] = useState(false);

  useEffect(() => {
    if (!orderId) return () => {};
    const unsub = onValue(ref(rtdb, `orders/${orderId}`), (snap) => {
      setOrder(snap.exists() ? snap.val() : null);
    });
    return () => unsub();
  }, [orderId]);

  useEffect(() => {
    if (!user?.uid || !orderId) return () => {};
    const unsub = onValue(ref(rtdb, `ratingRequests/${user.uid}/${orderId}`), (snap) => {
      setRatingRequest(snap.exists() ? snap.val() : null);
    });
    return () => unsub();
  }, [user?.uid, orderId]);

  const history = useMemo(() => {
    if (!order?.statusHistory) return [];
    const list = Object.values(order.statusHistory);
    return list.sort((a, b) => (a?.at || 0) - (b?.at || 0));
  }, [order?.statusHistory]);

  const canRate =
    order?.status === "delivered" &&
    ratingRequest?.status === "pending" &&
    order?.runnerId;

  const submitRating = async () => {
    if (!user?.uid || !order?.runnerId || !orderId || stars < 1) return;
    setRatingBusy(true);
    try {
      await submitRunnerRating({
        customerUid: user.uid,
        runnerId: order.runnerId,
        orderId,
        stars,
      });
    } finally {
      setRatingBusy(false);
    }
  };

  const dismissRating = async () => {
    if (!user?.uid || !orderId) return;
    setRatingBusy(true);
    try {
      await dismissRatingRequest({ customerUid: user.uid, orderId });
    } finally {
      setRatingBusy(false);
    }
  };

  if (!order) {
    return (
      <div className="gc-page" style={{ padding: 18 }}>
        <div className="gc-panel">
          <h2 className="gc-panelTitle">Order not found</h2>
          <p className="gc-muted">We could not load this order.</p>
          <button className="gc-miniBtn" type="button" onClick={() => navigate("/customer/orders")}>
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="gc-page" style={{ padding: 18 }}>
      <div className="gc-panel">
        <div className="gc-orderHeader">
          <div>
            <div className="gc-pill">Order</div>
            <h2 className="gc-pageTitle">
              {order.restaurantName || "Restaurant"} - #{String(order.orderId).slice(-4)}
            </h2>
            <div className="gc-muted" style={{ marginTop: 6 }}>
              Status: <b>{order.status || "pending"}</b>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="gc-muted">Placed</div>
            <div style={{ fontWeight: 800 }}>{formatDate(order.createdAt)}</div>
          </div>
        </div>

        <div className="gc-orderGrid" style={{ marginTop: 14 }}>
          <div className="gc-panel" style={{ margin: 0 }}>
            <div className="gc-panelTitle">Items</div>
            {order.items?.length ? (
              order.items.map((item) => (
                <div key={item.id || item.name} className="gc-menuItem" style={{ alignItems: "center" }}>
                  <div>
                    <div className="gc-menuName">{item.name}</div>
                    <div className="gc-muted" style={{ fontSize: 12 }}>
                      {item.qty || 1} x {money(item.price || 0)}
                    </div>
                  </div>
                  <div style={{ fontWeight: 800 }}>{money((item.price || 0) * (item.qty || 1))}</div>
                </div>
              ))
            ) : (
              <div className="gc-muted">No items listed.</div>
            )}
          </div>

          <div className="gc-panel" style={{ margin: 0 }}>
            <div className="gc-panelTitle">Order Summary</div>
            <div className="gc-summaryRow">
              <span>Subtotal</span>
              <span>{money(order?.pricing?.subtotal || 0)}</span>
            </div>
            <div className="gc-summaryRow">
              <span>Delivery fee</span>
              <span>{money(order?.pricing?.deliveryFee || 0)}</span>
            </div>
            <div className="gc-summaryRow">
              <span>Tip</span>
              <span>{money(order?.pricing?.tip || 0)}</span>
            </div>
            <div className="gc-summaryRow total">
              <span>Total</span>
              <span>{money(order?.pricing?.total || 0)}</span>
            </div>

            <div className="gc-panelTitle" style={{ marginTop: 16 }}>
              Delivery
            </div>
            <div className="gc-muted" style={{ fontSize: 13 }}>
              {order?.delivery?.addressText || "-"}
            </div>
            <div className="gc-muted" style={{ fontSize: 13 }}>
              Phone: {order?.delivery?.phone || "-"}
            </div>
            {order?.delivery?.notes ? (
              <div className="gc-muted" style={{ fontSize: 13 }}>
                Notes: {order.delivery.notes}
              </div>
            ) : null}
          </div>
        </div>

        {history.length > 0 ? (
          <div className="gc-panel" style={{ marginTop: 16 }}>
            <div className="gc-panelTitle">Status History</div>
            <div className="gc-orderHistory">
              {history.map((item, idx) => (
                <div key={`${item.status}-${idx}`} className="gc-historyRow">
                  <span className="gc-historyStatus">{item.status}</span>
                  <span className="gc-muted">{formatDate(item.at)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {canRate ? (
          <div className="gc-panel" style={{ marginTop: 16 }}>
          <div className="gc-panelTitle">Rate your runner</div>
            <div className="gc-ratingStars">
              {[1, 2, 3, 4, 5].map((val) => (
                <button
                  key={val}
                  type="button"
                  className={`gc-ratingStar ${stars >= val ? "isActive" : ""}`}
                  onClick={() => setStars(val)}
                >
                  ★
                </button>
              ))}
            </div>
            <div className="gc-inlineActions" style={{ marginTop: 10 }}>
              <button className="gc-miniBtn" type="button" onClick={dismissRating} disabled={ratingBusy}>
                Later
              </button>
              <button className="gc-btn" type="button" onClick={submitRating} disabled={ratingBusy || stars < 1}>
                Submit rating
              </button>
            </div>
          </div>
        ) : null}

        <div className="gc-inlineActions" style={{ marginTop: 16 }}>
          <button className="gc-miniBtn" type="button" onClick={() => navigate("/customer/orders")}>
            Back to Orders
          </button>
          {order?.status !== "delivered" && order?.status !== "cancelled" ? (
            <button className="gc-btn" type="button" onClick={() => navigate(`/customer/track/${orderId}`)}>
              Track order
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
