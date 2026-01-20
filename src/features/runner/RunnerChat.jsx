import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore";
import { listenRunnerIndexThreads, listenThreadMeta } from "../../services/chat.service";
import { getRunnerIdByUid } from "../../services/runners.service";

const formatThreadTime = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
};

export default function RunnerChat() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [runnerId, setRunnerId] = useState(null);
  const [threads, setThreads] = useState([]);
  const [q, setQ] = useState("");
  const [metaMap, setMetaMap] = useState({});

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
    if (!runnerId) return undefined;
    const unsubs = [];
    threads.forEach((t) => {
      unsubs.push(
        listenThreadMeta({ runnerId, customerUid: t.customerUid }, (meta) => {
          setMetaMap((prev) => ({ ...prev, [t.customerUid]: meta }));
        })
      );
    });
    return () => {
      unsubs.forEach((unsub) => unsub && unsub());
    };
  }, [runnerId, threads]);

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
    <div className="gc-chatPage">
      <div className="gc-chatListHeader">
        <button className="gc-chatIconBtn" type="button" onClick={() => navigate("/runner")}>
          {"<"}
        </button>
        <div className="gc-chatHeaderTitles">
          <div className="gc-chatHeaderTitle">Runner Chats</div>
          <div className="gc-chatHeaderSub">Customers messaging you</div>
        </div>
      </div>

      <div className="gc-searchWrap">
        <div className="gc-search">
          <span className="gc-searchIcon">S</span>
          <input
            className="gc-searchInput"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search chats"
            aria-label="Search chats"
          />
          {q ? (
            <button className="gc-clearBtn" type="button" onClick={() => setQ("")} aria-label="Clear search">
              x
            </button>
          ) : null}
        </div>
      </div>

      <div className="gc-threadList" role="list">
        {list.length === 0 ? (
          <div className="gc-emptyState">
            <div className="gc-emptyTitle">No messages yet</div>
            <div className="gc-emptySub">Customer messages will show up here.</div>
          </div>
        ) : (
          list.map((thread) => {
            const name = thread.customerName || "Customer";
            const time = formatThreadTime(thread.updatedAt);
            const preview = thread.lastMessage || "Start the chat";
            const unread = Number(metaMap[thread.customerUid]?.runnerUnread || 0);
            return (
              <button
                key={thread.customerUid}
                type="button"
                className={`gc-threadRow ${unread > 0 ? "is-unread" : ""}`}
                onClick={() => navigate(`/runner/chat/${thread.customerUid}`)}
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
          })
        )}
      </div>
    </div>
  );
}
