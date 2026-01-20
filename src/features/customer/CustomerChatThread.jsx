import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore";
import { useCartStore } from "../../store/useCartStore";
import {
  clearCustomerUnread,
  ensureCustomerThread,
  listenChatMessages,
  listenChatThreads,
  listenThreadMeta,
  markCustomerDelivered,
  sendChatMessage,
  uploadChatAttachment,
} from "../../services/chat.service";
import { listenRunnerPresence } from "../../services/presence.service";
import { listenAllRunners } from "../../services/runnerAdmin.service";
import { playTone } from "../../services/notifyAudio";
import { onValue, query, ref, orderByChild, equalTo } from "firebase/database";
import { rtdb } from "../../services/firebase";
import { updateOrderStatus } from "../../services/rtdb.service";

const formatTime = (value) => {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "";
  }
};

const money = (n) =>
  new Intl.NumberFormat("en-JM", { style: "currency", currency: "JMD" }).format(n || 0);
const CANCEL_WINDOW_MS = 15 * 60 * 1000;

export default function CustomerChatThread() {
  const navigate = useNavigate();
  const { threadId } = useParams();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);

  const setRunner = useCartStore((s) => s.setRunner);
  const runner = useCartStore((s) => s.runner);
  const cartItems = useCartStore((s) => s.items);
  const cartRestaurant = useCartStore((s) => s.restaurant);
  const cartSubtotal = useCartStore((s) => s.subtotal);

  const [threads, setThreads] = useState([]);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [runnerPresence, setRunnerPresence] = useState(null);
  const [showAddOrder, setShowAddOrder] = useState(false);
  const [runnerMap, setRunnerMap] = useState({});
  const [runnerAuthMap, setRunnerAuthMap] = useState({});
  const [activeOrder, setActiveOrder] = useState(null);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const [meta, setMeta] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  const listRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const lastMessageIdRef = useRef(null);

  const thread = useMemo(() => threads.find((item) => item.id === threadId), [threads, threadId]);
  const isSupport = threadId === "support";
  const runnerId = !isSupport && threadId ? threadId.replace(/^runner_/, "") : null;

  useEffect(() => {
    if (!user?.uid) return undefined;
    const unsub = listenChatThreads(user.uid, setThreads);
    return () => unsub?.();
  }, [user?.uid]);

  useEffect(() => {
    const unsub = listenAllRunners((list) => {
      const map = {};
      const authMap = {};
      list.forEach((r) => {
        if (r?.runnerId) map[r.runnerId] = r.name || "Runner";
        if (r?.runnerId && r?.authUid) authMap[r.runnerId] = r.authUid;
      });
      setRunnerMap(map);
      setRunnerAuthMap(authMap);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user?.uid) return undefined;
    const unsub = listenChatMessages({ runnerId, customerUid: user.uid }, setMessages);
    return () => unsub?.();
  }, [runnerId, user?.uid]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    const lastRunnerMsg = messages
      .slice()
      .reverse()
      .find((m) => m?.role === "runner");
    clearCustomerUnread({
      runnerId,
      customerUid: user.uid,
      lastReadAt: lastRunnerMsg?.createdAt || Date.now(),
    });
  }, [messages, runnerId, user?.uid]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    const unsub = listenThreadMeta({ runnerId, customerUid: user.uid }, setMeta);
    return () => unsub?.();
  }, [runnerId, user?.uid]);

  useEffect(() => {
    if (!runnerId) return undefined;
    const unsub = listenRunnerPresence(runnerId, setRunnerPresence);
    return () => unsub();
  }, [runnerId]);

  const runnerUid = runnerId ? runnerAuthMap[runnerId] : null;

  useEffect(() => {
    if (!user?.uid) return undefined;
    const ordersQuery = query(ref(rtdb, "orders"), orderByChild("userId"), equalTo(user.uid));
    const unsub = onValue(ordersQuery, (snap) => {
      const val = snap.val() || {};
      const list = Object.values(val)
        .filter((o) => o?.runnerId && o.runnerId === runnerId)
        .filter((o) => o?.status !== "delivered" && o?.status !== "cancelled")
        .sort((a, b) => (b?.createdAt || 0) - (a?.createdAt || 0));
      setActiveOrder(list[0] || null);
    });
    return () => unsub();
  }, [runnerId, user?.uid]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (!messages.length) return;
    const last = messages[messages.length - 1];
    const prevId = lastMessageIdRef.current;
    if (prevId && last?.id !== prevId && last?.role !== "customer") {
      playTone("incomingMessage");
    }
    lastMessageIdRef.current = last?.id || null;
  }, [messages]);

  useEffect(() => {
    if (!messages.length || !user?.uid) return;
    const lastRunnerMsg = messages
      .slice()
      .reverse()
      .find((m) => m?.role === "runner");
    if (!lastRunnerMsg?.createdAt) return;
    if ((meta?.customerDeliveredAt || 0) >= lastRunnerMsg.createdAt) return;
    markCustomerDelivered({
      runnerId,
      customerUid: user.uid,
      lastDeliveredAt: lastRunnerMsg.createdAt,
    });
  }, [messages, meta?.customerDeliveredAt, runnerId, user?.uid]);


  useEffect(() => {
    if (thread?.runnerId) {
      setRunner({ id: thread.runnerId, name: thread.runnerName || "Runner" });
    }
  }, [setRunner, thread?.runnerId, thread?.runnerName]);

  useEffect(() => {
    if (!user?.uid || !runnerId) return;
    const name = thread?.runnerName || runnerMap[runnerId];
    if (!name) return;
    ensureCustomerThread({ customerUid: user.uid, runnerId, runnerName: name });
  }, [runnerId, runnerMap, thread?.runnerName, user?.uid]);

  const contactName = isSupport
    ? "GoCrave Support"
    : thread?.runnerName || runnerMap[runnerId] || "Runner";
  const isRunnerOnline = runnerPresence?.state === "online";
  const contactStatus = isSupport
    ? "Typically replies fast"
    : isRunnerOnline
    ? "Online"
    : "Offline";

  const orderCard = useMemo(() => {
    if (!cartItems.length || !cartRestaurant) return null;
    return {
      orderId: "GC-" + String(Date.now()).slice(-5),
      restaurant: cartRestaurant?.name || "-",
      items: `${cartItems.length} items`,
      total: cartSubtotal(),
      address: profile?.workplaceLocation || "-",
      badge: "On the way",
    };
  }, [cartItems.length, cartRestaurant?.name, cartSubtotal, profile?.workplaceLocation]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !user?.uid) return;

    setDraft("");
    inputRef.current?.focus();

    await sendChatMessage({
      runnerId,
      runnerName: thread?.runnerName || runner?.name || null,
      customerUid: user.uid,
      customerName: profile?.name || null,
      role: "customer",
      text,
    });
  };

  const sendAttachment = async (file) => {
    if (!file || !user?.uid) return;
    setUploading(true);
    try {
      const attachment = await uploadChatAttachment({ file, runnerId, customerUid: user.uid });
      await sendChatMessage({
        runnerId,
        runnerName: thread?.runnerName || runner?.name || null,
        customerUid: user.uid,
        customerName: profile?.name || null,
        role: "customer",
        text: "",
        attachment,
      });
    } finally {
      setUploading(false);
    }
  };

  const canCancel =
    !!activeOrder &&
    !!activeOrder.createdAt &&
    Date.now() - Number(activeOrder.createdAt || 0) <= CANCEL_WINDOW_MS;

  const submitCancel = async () => {
    if (!activeOrder?.orderId || !user?.uid) return;
    const reason = cancelReason.trim();
    setCancelBusy(true);
    try {
      await updateOrderStatus(activeOrder.orderId, {
        status: "cancelled",
        cancelledAt: Date.now(),
        cancelledBy: "customer",
        cancelReason: reason || "Customer requested cancellation.",
      });
      await sendChatMessage({
        runnerId,
        runnerName: thread?.runnerName || runnerMap[runnerId] || null,
        customerUid: user.uid,
        customerName: profile?.name || null,
        role: "customer",
        text: `Order cancelled: ${reason || "Customer requested cancellation."}`,
      });
      setShowCancel(false);
      setCancelReason("");
    } finally {
      setCancelBusy(false);
    }
  };

  const grouped = useMemo(() => {
    const out = [];
    for (let i = 0; i < messages.length; i += 1) {
      const msg = messages[i];
      const prev = messages[i - 1];
      const next = messages[i + 1];

      const mine = msg.role === "customer";
      const prevSame = prev && prev.role === msg.role;
      const nextSame = next && next.role === msg.role;

      out.push({
        ...msg,
        _mine: mine,
        _start: !prevSame,
        _end: !nextSame,
      });
    }
    return out;
  }, [messages]);

  const receiptFor = (msg) => {
    if (!msg?._mine) return null;
    const createdAt = msg.createdAt || 0;
    const runnerReadAt = meta?.runnerReadAt || 0;
    const runnerDeliveredAt = meta?.runnerDeliveredAt || 0;
    if (runnerReadAt >= createdAt) return "read";
    if (runnerDeliveredAt >= createdAt) return "delivered";
    return "sent";
  };


  return (
    <div className="gc-chatThreadPage">
      <div className="gc-chatTopbar">
        <button className="gc-iconBtn" type="button" onClick={() => navigate("/customer/chat")}
        >
          {"<"}
        </button>

        <div className="gc-chatTopbarInfo" role="button" tabIndex={0}>
          <div className="gc-chatTopbarName">{contactName}</div>
          <div className="gc-chatTopbarStatus">
            <span className={`gc-presenceDot ${contactStatus === "Online" ? "on" : "off"}`} />
            {contactStatus}
          </div>
        </div>

        <div className="gc-chatTopbarActions">
          <button className="gc-iconBtn" type="button">...</button>
        </div>
      </div>

      {orderCard && (
        <div className="gc-orderPin">
          <div className="gc-orderPinCard">
            <div className="gc-orderPinRow">
              <div>
                <div className="gc-orderPinLabel">Order</div>
                <div className="gc-orderPinId">{orderCard.orderId}</div>
              </div>
              <div className="gc-orderPinBadge">{orderCard.badge}</div>
            </div>

            <div className="gc-orderPinDetails">
              <div className="gc-orderPinRestaurant">{orderCard.restaurant}</div>
              <div className="gc-orderPinMeta">
                {orderCard.items} - {money(orderCard.total)}
              </div>
              <div className="gc-orderPinMeta">Drop-off: {orderCard.address}</div>
            </div>
          </div>
        </div>
      )}

      <div className="gc-chatScroll" ref={listRef}>
        <div className="gc-dayPill">Today</div>

        {grouped.length === 0 ? (
          <div className="gc-emptyMsg">
            <div className="gc-emptyMsgTitle">No messages yet</div>
            <div className="gc-emptyMsgSub">Start the chat to coordinate your delivery.</div>
          </div>
        ) : (
          grouped.map((msg) => (
            <div
              key={msg.id}
              className={`gc-row ${msg._mine ? "mine" : "theirs"} ${msg._start ? "start" : ""} ${
                msg._end ? "end" : ""
              }`}
            >
              <div className="gc-bubble">
                {msg.attachment?.url ? (
                  <button
                    className="gc-chatImageBtn"
                    type="button"
                    onClick={() => setLightbox(msg.attachment.url)}
                    aria-label="View image"
                  >
                    <img
                      className="gc-chatImage"
                      src={msg.attachment.url}
                      alt={msg.attachment.name || "Photo"}
                    />
                  </button>
                ) : null}
                {msg.text ? <div className="gc-bubbleText">{msg.text}</div> : null}
                <div className="gc-bubbleMeta">
                  {formatTime(msg.createdAt)}
                  {msg._mine ? (
                    <span className={`gc-bubbleReceipt ${receiptFor(msg) || ""}`}>
                      {receiptFor(msg) === "sent" ? "✓" : "✓✓"}
                    </span>
                  ) : null}
                </div>
                {msg.action?.type === "track_order" ? (
                  <div className="gc-bubbleActions">
                    <button
                      className="gc-bubbleBtn"
                      type="button"
                      onClick={() =>
                        navigate(`/customer/track/${msg.action?.orderId || "-"}`)
                      }
                    >
                      {msg.action?.label || "Track order"}
                    </button>
                    {canCancel ? (
                      <button
                        className="gc-bubbleBtn danger"
                        type="button"
                        onClick={() => setShowCancel(true)}
                      >
                        Cancel order
                      </button>
                    ) : null}
                  </div>
                ) : null}
                <span className="gc-tail" aria-hidden="true" />
              </div>
            </div>
          ))
        )}
      </div>

      {!isSupport && canCancel ? (
        <div className="gc-cancelRow">
          <button
            className="gc-cancelPulse"
            type="button"
            onClick={() => setShowCancel(true)}
          >
            Cancel order
          </button>
        </div>
      ) : null}


      <div className="gc-composerFixed">
        <div className="gc-composerInputWrap">
          <textarea
            ref={inputRef}
            className="gc-composerInput"
            placeholder="Message"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
        </div>

        <button
          className="gc-attachBtn"
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          aria-label="Attach photo"
        >
          📷
        </button>

        <button className="gc-addOrderBtn" type="button" onClick={() => setShowAddOrder(true)}>
          Add order
        </button>

        <button
          className={`gc-sendBtn ${draft.trim() ? "on" : ""}`}
          type="button"
          onClick={send}
          disabled={!draft.trim()}
          aria-label="Send"
        >
          Send
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) sendAttachment(file);
            e.target.value = "";
          }}
        />
      </div>

      {showAddOrder && (
        <div className="gc-chatModalOverlay" role="presentation" onClick={() => setShowAddOrder(false)}>
          <div
            className="gc-chatModalCard"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="gc-chatModalTitle">Add order</div>
            <div className="gc-chatModalText">
              Go to restaurants to add items to your cart.
            </div>
            <div className="gc-chatModalActions">
              <button className="gc-miniBtn" type="button" onClick={() => setShowAddOrder(false)}>
                Cancel
              </button>
              <button
                className="gc-btn"
                type="button"
                onClick={() => navigate("/customer/restaurants")}
              >
                Open menu
              </button>
            </div>
          </div>
        </div>
      )}

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

      {lightbox ? (
        <div className="gc-imageLightbox" role="presentation" onClick={() => setLightbox(null)}>
          <button className="gc-imageLightboxClose" type="button" aria-label="Close">
            ×
          </button>
          <img className="gc-imageLightboxImg" src={lightbox} alt="Attachment" />
        </div>
      ) : null}
    </div>
  );
}
