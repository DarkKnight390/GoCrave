import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listenSupportThreads } from "../../services/chat.service";

const formatThreadTime = (value) => {
  if (!value) return "";
  const d = new Date(value);
  const now = new Date();
  const isSameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (isSameDay) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
};

export default function AdminSupportChat() {
  const navigate = useNavigate();
  const [threads, setThreads] = useState([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    const unsub = listenSupportThreads(setThreads);
    return () => unsub();
  }, []);

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return threads;
    return threads.filter((t) => {
      const name = (t.customerName || "Customer").toLowerCase();
      const msg = (t.lastMessage || "").toLowerCase();
      return name.includes(query) || msg.includes(query);
    });
  }, [threads, q]);

  return (
    <div className="gc-adminDashboard">
      <div className="gc-adminCard">
        <div className="gc-adminCardHeader">
          <div>
            <div className="gc-adminCardTitle">Support Messages</div>
            <div className="gc-adminCardSub">Customers chatting with GoCrave support.</div>
          </div>
        </div>

        <div className="gc-filterBar">
          <input
            className="gc-input"
            placeholder="Search by name or message"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {list.length === 0 ? (
          <p className="gc-muted">No support chats yet.</p>
        ) : (
          <div className="gc-threadList" role="list">
            {list.map((thread) => {
              const name = thread.customerName || "Customer";
              const time = formatThreadTime(thread.updatedAt);
              const preview = thread.lastMessage || "Start the chat";
              const unread = Number(thread.supportUnread || 0);

              return (
                <button
                  key={thread.customerUid}
                  type="button"
                  className={`gc-threadRow ${unread > 0 ? "is-unread" : ""}`}
                  onClick={() => navigate(`/admin/messages/${thread.customerUid}`)}
                  role="listitem"
                >
                  <div className="gc-avatarWrap">
                    <div className="gc-avatar" aria-hidden="true">
                      {name.slice(0, 1).toUpperCase()}
                    </div>
                  </div>
                  <div className="gc-threadMain">
                    <div className="gc-threadTop">
                      <div className="gc-threadName">{name}</div>
                      <div className="gc-threadTime">{time}</div>
                    </div>
                    <div className="gc-threadBottom">
                      <div className="gc-threadPreview">{preview}</div>
                      {unread > 0 ? (
                        <span className="gc-unreadBadge" aria-label={`${unread} unread`}>
                          {unread > 99 ? "99+" : unread}
                        </span>
                      ) : (
                        <span className="gc-chev" aria-hidden="true">
                          {">"}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
