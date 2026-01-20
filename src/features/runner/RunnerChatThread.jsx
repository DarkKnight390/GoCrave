import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore";
import {
  clearRunnerUnread,
  listenChatMessages,
  listenRunnerIndexThreads,
  listenThreadMeta,
  markRunnerDelivered,
  sendChatMessage,
  uploadChatAttachment,
} from "../../services/chat.service";
import { getRunnerIdByUid } from "../../services/runners.service";
import { playTone } from "../../services/notifyAudio";

const formatTime = (value) => {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "";
  }
};

export default function RunnerChatThread() {
  const navigate = useNavigate();
  const { customerUid } = useParams();
  const user = useAuthStore((s) => s.user);
  const [runnerId, setRunnerId] = useState(null);
  const [threads, setThreads] = useState([]);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [meta, setMeta] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const listRef = useRef(null);
  const fileRef = useRef(null);
  const lastMessageIdRef = useRef(null);

  useEffect(() => {
    if (!user?.uid) return undefined;
    let active = true;
    getRunnerIdByUid(user.uid, user.email).then((id) => {
      if (active) setRunnerId(id);
    });
    return () => {
      active = false;
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!runnerId) return undefined;
    const unsub = listenRunnerIndexThreads(runnerId, setThreads);
    return () => unsub();
  }, [runnerId]);

  useEffect(() => {
    if (!runnerId || !user?.uid || !customerUid) return undefined;
    const unsub = listenChatMessages({ runnerId, customerUid }, setMessages);
    return () => unsub();
  }, [runnerId, user?.uid, customerUid]);

  useEffect(() => {
    if (!runnerId || !customerUid) return;
    const lastCustomerMsg = messages
      .slice()
      .reverse()
      .find((m) => m?.role === "customer");
    clearRunnerUnread({
      runnerId,
      customerUid,
      lastReadAt: lastCustomerMsg?.createdAt || Date.now(),
    });
  }, [messages, runnerId, customerUid]);

  useEffect(() => {
    if (!runnerId || !customerUid) return undefined;
    const unsub = listenThreadMeta({ runnerId, customerUid }, setMeta);
    return () => unsub?.();
  }, [runnerId, customerUid]);


  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (!messages.length) return;
    const last = messages[messages.length - 1];
    const prevId = lastMessageIdRef.current;
    if (prevId && last?.id !== prevId && last?.role !== "runner") {
      playTone("incomingMessage");
    }
    lastMessageIdRef.current = last?.id || null;
  }, [messages]);

  useEffect(() => {
    if (!messages.length || !runnerId || !customerUid) return;
    const lastCustomerMsg = messages
      .slice()
      .reverse()
      .find((m) => m?.role === "customer");
    if (!lastCustomerMsg?.createdAt) return;
    if ((meta?.runnerDeliveredAt || 0) >= lastCustomerMsg.createdAt) return;
    markRunnerDelivered({
      runnerId,
      customerUid,
      lastDeliveredAt: lastCustomerMsg.createdAt,
    });
  }, [messages, meta?.runnerDeliveredAt, runnerId, customerUid]);

  const thread = useMemo(
    () => threads.find((item) => item.customerUid === customerUid),
    [threads, customerUid]
  );

  const contactName = thread?.customerName || "Customer";


  const send = async () => {
    const text = draft.trim();
    if (!text || !user?.uid || !runnerId) return;
    setDraft("");
    await sendChatMessage({
      runnerId,
      runnerName: null,
      customerUid,
      customerName: thread?.customerName || null,
      role: "runner",
      text,
    });
  };

  const sendAttachment = async (file) => {
    if (!file || !runnerId || !user?.uid) return;
    setUploading(true);
    try {
      const attachment = await uploadChatAttachment({ file, runnerId, customerUid });
      await sendChatMessage({
        runnerId,
        runnerName: null,
        customerUid,
        customerName: thread?.customerName || null,
        role: "runner",
        text: "",
        attachment,
      });
    } finally {
      setUploading(false);
    }
  };

  const receiptFor = (msg) => {
    if (msg?.role !== "runner") return null;
    const createdAt = msg.createdAt || 0;
    const customerReadAt = meta?.customerReadAt || 0;
    const customerDeliveredAt = meta?.customerDeliveredAt || 0;
    if (customerReadAt >= createdAt) return "read";
    if (customerDeliveredAt >= createdAt) return "delivered";
    return "sent";
  };

  return (
    <div className="gc-chatThreadPage">
      <div className="gc-chatTopbar">
        <button className="gc-iconBtn" type="button" onClick={() => navigate("/runner/chat")}>
          {"<"}
        </button>
        <div className="gc-chatTopbarInfo">
          <div className="gc-chatTopbarName">{contactName}</div>
          <div className="gc-chatTopbarStatus">Customer</div>
        </div>
        <div className="gc-chatTopbarActions" />
      </div>

      <div className="gc-chatScroll" ref={listRef}>
        <div className="gc-dayPill">Today</div>
        {messages.length === 0 ? (
          <div className="gc-emptyMsg">
            <div className="gc-emptyMsgTitle">No messages yet</div>
            <div className="gc-emptyMsgSub">Say hello to get started.</div>
          </div>
        ) : (
          messages.map((msg) => {
            const mine = msg.role === "runner";
            return (
              <div key={msg.id} className={`gc-row ${mine ? "mine" : "theirs"}`}>
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
                    {mine ? (
                      <span className={`gc-bubbleReceipt ${receiptFor(msg) || ""}`}>
                        {receiptFor(msg) === "sent" ? "✓" : "✓✓"}
                      </span>
                    ) : null}
                  </div>
                  {msg.action?.type === "track_order" ? (
                    <div className="gc-bubbleHint">Track button sent</div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="gc-composerFixed">
        <div className="gc-composerInputWrap">
          <textarea
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

        <button
          className={`gc-sendBtn ${draft.trim() ? "on" : ""}`}
          type="button"
          onClick={send}
          disabled={!draft.trim()}
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
