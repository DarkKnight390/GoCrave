import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  clearSupportUnread,
  listenChatMessages,
  listenSupportThreads,
  sendChatMessage,
} from "../../services/chat.service";

const formatTime = (value) => {
  if (!value) return "";
  try {
    return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
};

export default function AdminSupportChatThread() {
  const navigate = useNavigate();
  const { customerUid } = useParams();
  const [threads, setThreads] = useState([]);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    const unsub = listenSupportThreads(setThreads);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!customerUid) return undefined;
    const unsub = listenChatMessages({ runnerId: null, customerUid }, setMessages);
    return () => unsub();
  }, [customerUid]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (!customerUid) return;
    clearSupportUnread({ customerUid });
  }, [customerUid]);

  const thread = useMemo(
    () => threads.find((item) => item.customerUid === customerUid),
    [threads, customerUid]
  );

  const contactName = thread?.customerName || "Customer";

  const send = async () => {
    const text = draft.trim();
    if (!text || !customerUid) return;
    setDraft("");
    await sendChatMessage({
      runnerId: null,
      runnerName: null,
      customerUid,
      customerName: thread?.customerName || null,
      role: "support",
      text,
    });
  };

  return (
    <div className="gc-chatThreadPage">
      <div className="gc-chatTopbar">
        <button className="gc-iconBtn" type="button" onClick={() => navigate("/admin/messages")}>
          {"<"}
        </button>
        <div className="gc-chatTopbarInfo">
          <div className="gc-chatTopbarName">{contactName}</div>
          <div className="gc-chatTopbarStatus">Support chat</div>
        </div>
      </div>

      <div className="gc-chatScroll" ref={listRef}>
        <div className="gc-dayPill">Today</div>
        {messages.length === 0 ? (
          <div className="gc-emptyMsg">
            <div className="gc-emptyMsgTitle">No messages yet</div>
            <div className="gc-emptyMsgSub">Send a reply to assist the customer.</div>
          </div>
        ) : (
          messages.map((msg) => {
            const mine = msg.role === "support";
            return (
              <div key={msg.id} className={`gc-row ${mine ? "mine" : "theirs"}`}>
                <div className="gc-bubble">
                  <div className="gc-bubbleText">{msg.text}</div>
                  <div className="gc-bubbleMeta">{formatTime(msg.createdAt)}</div>
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

        <button className={`gc-sendBtn ${draft.trim() ? "on" : ""}`} type="button" onClick={send}>
          Send
        </button>
      </div>
    </div>
  );
}
