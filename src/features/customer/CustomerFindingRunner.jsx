import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { onValue, ref } from "firebase/database";
import { rtdb } from "../../services/firebase";
import { getRunnerIdByUid } from "../../services/runners.service";
import { playTone } from "../../services/notifyAudio";
import { updateOrderStatus } from "../../services/rtdb.service";
import { useAuthStore } from "../../store/useAuthStore";
import { sendChatMessage } from "../../services/chat.service";

const CANCEL_WINDOW_MS = 15 * 60 * 1000;

export default function CustomerFindingRunner() {
  const navigate = useNavigate();
  const location = useLocation();
  const orderId = location.state?.orderId || "GC-Order";
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const [order, setOrder] = useState(null);
  const [runnerChatId, setRunnerChatId] = useState(null);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const prevStatusRef = useRef(null);

  useEffect(() => {
    if (!orderId || orderId === "GC-Order") return () => {};
    const unsub = onValue(ref(rtdb, `orders/${orderId}`), (snap) => {
      setOrder(snap.exists() ? snap.val() : null);
    });
    return () => unsub();
  }, [orderId]);

  useEffect(() => {
    if (!order?.runnerId) {
      setRunnerChatId(null);
      return;
    }
    let active = true;
    getRunnerIdByUid(order.runnerId).then((id) => {
      if (active) setRunnerChatId(id);
    });
    return () => {
      active = false;
    };
  }, [order?.runnerId]);

  const status = order?.status || "pending";
  const accepted = status === "accepted" || status === "on_route" || status === "delivering";
  const cancelled = status === "cancelled";
  const delivered = status === "delivered";
  const canCancel =
    !!order?.createdAt &&
    Date.now() - Number(order.createdAt || 0) <= CANCEL_WINDOW_MS &&
    !delivered &&
    !cancelled;

  useEffect(() => {
    const prev = prevStatusRef.current;
    if (prev && prev !== status && accepted) {
      playTone("orderAccepted");
    }
    prevStatusRef.current = status;
  }, [accepted, status]);

  useEffect(() => {
    if (delivered) {
      navigate(`/customer/checkout/delivered/${orderId}`, { replace: true });
    }
  }, [delivered, navigate, orderId]);

  useEffect(() => {
    if (cancelled) {
      navigate("/customer/orders", { replace: true });
    }
  }, [cancelled, navigate]);

  const submitCancel = async () => {
    if (!order?.orderId || !user?.uid) return;
    const reason = cancelReason.trim();
    setCancelBusy(true);
    try {
      await updateOrderStatus(order.orderId, {
        status: "cancelled",
        cancelledAt: Date.now(),
        cancelledBy: "customer",
        cancelReason: reason || "Customer requested cancellation.",
      });
      if (order.runnerId) {
        await sendChatMessage({
          runnerId: order.runnerId,
          runnerName: null,
          customerUid: user.uid,
          customerName: profile?.name || null,
          role: "customer",
          text: `Order cancelled: ${reason || "Customer requested cancellation."}`,
        });
      }
      setShowCancel(false);
      setCancelReason("");
    } finally {
      setCancelBusy(false);
    }
  };

  return (
    <div className="gc-page">
      <div className="gc-panel gc-findingPanel">
        <div className="gc-findingPulse" aria-hidden="true" />
        <h2 className="gc-pageTitle">
          {accepted ? "Runner accepted" : cancelled ? "Order cancelled" : "Finding a runner"}
        </h2>
        <p className="gc-muted">
          {accepted
            ? "Your runner is on the way. You can chat with them now."
            : cancelled
            ? "This order was cancelled. You can place a new order."
            : "We are matching your order with the best available runner."}
        </p>
        <div className="gc-findingMeta">Order ID: {orderId}</div>
        <div className="gc-inlineActions" style={{ marginTop: 16 }}>
          <button className="gc-miniBtn" type="button" onClick={() => navigate("/customer/home")}>
            Back to Home
          </button>
          {accepted ? (
            <button
              className="gc-miniBtn brand"
              type="button"
              onClick={() => navigate(`/customer/track/${orderId}`)}
            >
              Track order
            </button>
          ) : (
            <button className="gc-miniBtn brand" type="button" onClick={() => navigate("/customer/chat")}>
              Open Chat
            </button>
          )}
        </div>
      </div>

      {canCancel ? (
        <div className="gc-cancelRow">
          <button className="gc-cancelPulse" type="button" onClick={() => setShowCancel(true)}>
            Cancel order
          </button>
        </div>
      ) : null}

      {showCancel && (
        <div className="gc-chatModalOverlay" role="presentation" onClick={() => setShowCancel(false)}>
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
                onClick={() => setShowCancel(false)}
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
