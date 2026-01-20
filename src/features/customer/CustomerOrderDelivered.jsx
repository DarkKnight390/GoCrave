import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { onValue, ref } from "firebase/database";
import { rtdb } from "../../services/firebase";
import { listenAllRunners } from "../../services/runnerAdmin.service";
import {
  dismissRatingRequest,
  submitRunnerRating,
} from "../../services/ratings.service";
import { useAuthStore } from "../../store/useAuthStore";
import runner1 from "../../assets/avatars/runner1.jpg";
import runner2 from "../../assets/avatars/runner2.jpg";
import runner3 from "../../assets/avatars/runner3.jpg";
import runner4 from "../../assets/avatars/runner4.jpg";
import runner5 from "../../assets/avatars/runner5.jpg";

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

export default function CustomerOrderDelivered() {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const user = useAuthStore((s) => s.user);
  const [order, setOrder] = useState(null);
  const [runners, setRunners] = useState([]);
  const [ratingStars, setRatingStars] = useState(5);
  const [ratingBusy, setRatingBusy] = useState(false);
  const [ratingMsg, setRatingMsg] = useState("");
  const ratingTimerRef = useRef(null);

  useEffect(() => {
    if (!orderId) return () => {};
    const unsub = onValue(ref(rtdb, `orders/${orderId}`), (snap) => {
      setOrder(snap.exists() ? snap.val() : null);
    });
    return () => unsub();
  }, [orderId]);

  useEffect(() => {
    const unsub = listenAllRunners((list) => setRunners(list));
    return () => unsub();
  }, []);

  useEffect(() => {
    return () => {
      if (ratingTimerRef.current) clearTimeout(ratingTimerRef.current);
    };
  }, []);

  const runnerName = useMemo(() => {
    if (!order?.runnerId) return "Runner";
    const found = runners.find((r) => r.authUid === order.runnerId || r.runnerId === order.runnerId);
    return found?.name || "Runner";
  }, [order?.runnerId, runners]);

  const runnerAvatar = useMemo(() => {
    if (!order?.runnerId) return runner1;
    const found = runners.find((r) => r.authUid === order.runnerId || r.runnerId === order.runnerId);
    const key = `${found?.runnerId || ""}${found?.name || ""}`;
    const avatars = [runner1, runner2, runner3, runner4, runner5];
    if (!key) return avatars[0];
    let hash = 0;
    for (let i = 0; i < key.length; i += 1) {
      hash = (hash * 31 + key.charCodeAt(i)) % 100000;
    }
    return avatars[Math.abs(hash) % avatars.length];
  }, [order?.runnerId, runners]);

  const items = order?.items || [];
  const statusHistory = useMemo(() => buildStatusHistory(order), [order]);

  return (
    <div className="gc-page">
      <div className="gc-panel" style={{ marginTop: 16 }}>
        <h2 className="gc-pageTitle">Delivered</h2>
        <p className="gc-muted">Your order has been delivered.</p>

        <div style={{ marginTop: 12 }}>
          <div className="gc-summaryLine">
            <span>Order ID</span>
            <span>{orderId}</span>
          </div>
          <div className="gc-summaryLine">
            <span>Restaurant</span>
            <span>{order?.restaurantName || "-"}</span>
          </div>
          <div className="gc-summaryLine">
            <span>Runner</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <img
                src={runnerAvatar}
                alt={runnerName}
                style={{ width: 28, height: 28, borderRadius: 10, objectFit: "cover" }}
              />
              {runnerName}
            </span>
          </div>
          <div className="gc-summaryLine">
            <span>Total</span>
            <span>{money(order?.pricing?.total || 0)}</span>
          </div>
        </div>

        {items.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div className="gc-panelTitle">Items</div>
            {items.map((item) => (
              <div key={item.id} className="gc-summaryRow">
                <div>
                  <div className="gc-summaryItem">{item.name}</div>
                  <div className="gc-summaryMeta">Qty {item.qty}</div>
                </div>
                <div className="gc-summaryPrice">{money(item.price * item.qty)}</div>
              </div>
            ))}
          </div>
        )}

        {statusHistory.length > 0 ? (
          <div style={{ marginTop: 14 }}>
            <div className="gc-panelTitle">Order history</div>
            <div className="gc-statusHistory">
              {statusHistory.map((entry, idx) => (
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
          </div>
        ) : null}

        {order?.runnerId && (
          <div style={{ marginTop: 14 }}>
            <div className="gc-panelTitle">Rate your runner</div>
            <div className="gc-ratingStars">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`gc-ratingStar ${ratingStars >= n ? "isActive" : ""}`}
                  onClick={() => setRatingStars(n)}
                >
                  ★
                </button>
              ))}
            </div>
            <div className="gc-ratingActions">
              <button
                className="gc-chatBtn"
                type="button"
                onClick={() => navigate(`/customer/chat/runner_${order.runnerId}`)}
              >
                Message runner
              </button>
              <button
                className="gc-btn"
                type="button"
                disabled={ratingBusy}
                onClick={async () => {
                  if (!user?.uid) return;
                  setRatingBusy(true);
                  try {
                    await submitRunnerRating({
                      customerUid: user.uid,
                      runnerId: order.runnerId,
                      orderId,
                      stars: ratingStars,
                    });
                    await dismissRatingRequest({ customerUid: user.uid, orderId });
                    setRatingMsg("Thanks! Your rating was submitted.");
                    if (ratingTimerRef.current) clearTimeout(ratingTimerRef.current);
                    ratingTimerRef.current = setTimeout(() => setRatingMsg(""), 3000);
                  } finally {
                    setRatingBusy(false);
                  }
                }}
              >
                Submit rating
              </button>
            </div>
            {ratingMsg ? <div className="gc-muted" style={{ marginTop: 10 }}>{ratingMsg}</div> : null}
          </div>
        )}
      </div>

      <div className="gc-inlineActions" style={{ marginTop: 16 }}>
        <button className="gc-miniBtn" type="button" onClick={() => navigate("/customer/home")}>
          Back home
        </button>
        <button
          className="gc-btn"
          type="button"
          onClick={() => navigate("/customer/chat")}
        >
          Message support
        </button>
      </div>
    </div>
  );
}
