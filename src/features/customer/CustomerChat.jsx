import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore";
import { deleteCustomerThread, listenChatThreads, listenThreadMeta } from "../../services/chat.service";
import { listenAllRunners } from "../../services/runnerAdmin.service";
import runner1 from "../../assets/avatars/runner1.jpg";
import runner2 from "../../assets/avatars/runner2.jpg";
import runner3 from "../../assets/avatars/runner3.jpg";
import runner4 from "../../assets/avatars/runner4.jpg";
import runner5 from "../../assets/avatars/runner5.jpg";

const avatars = [runner1, runner2, runner3, runner4, runner5];

const pickAvatar = (thread) => {
  const key = `${thread.runnerId || ""}${thread.runnerName || ""}${thread.id || ""}`;
  if (!key) return avatars[0];
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) % 100000;
  return avatars[Math.abs(hash) % avatars.length];
};

const formatThreadTime = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
};

export default function CustomerChat() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [threads, setThreads] = useState([]);
  const [q, setQ] = useState("");
  const [metaMap, setMetaMap] = useState({});
  const [runnerMap, setRunnerMap] = useState({});

  useEffect(() => {
    if (!user?.uid) return undefined;
    const unsub = listenChatThreads(user.uid, setThreads);
    return () => unsub?.();
  }, [user?.uid]);

  useEffect(() => {
    const unsub = listenAllRunners((list) => {
      const map = {};
      list.forEach((runner) => {
        if (runner?.runnerId) {
          map[runner.runnerId] = runner.name || "Runner";
        }
      });
      setRunnerMap(map);
    });
    return () => unsub();
  }, []);

  const list = useMemo(() => {
    const supportThread = {
      id: "support",
      type: "support",
      runnerName: "GoCrave Support",
      runnerId: null,
      lastMessage: "How can we help?",
      updatedAt: Date.now() - 1000 * 60 * 20,
      unreadCount: 0,
      isOnline: true,
    };

    const merged = threads?.length ? [...threads] : [];
    const hasSupport = merged.some((t) => t.id === "support");
    if (!hasSupport) merged.unshift(supportThread);

    merged.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    const query = q.trim().toLowerCase();
    if (!query) return merged;

    return merged.filter((t) => {
      const name = (t.runnerName || "Runner").toLowerCase();
      const msg = (t.lastMessage || "").toLowerCase();
      return name.includes(query) || msg.includes(query);
    });
  }, [threads, q]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    const unsubs = [];
    const baseList = [
      { id: "support", runnerId: null },
      ...threads.map((t) => ({ id: t.id, runnerId: t.runnerId || null })),
    ];

    baseList.forEach((t) => {
      unsubs.push(
        listenThreadMeta({ runnerId: t.runnerId, customerUid: user.uid }, (meta) => {
          setMetaMap((prev) => ({ ...prev, [t.id]: meta }));
        })
      );
    });

    return () => {
      unsubs.forEach((unsub) => unsub && unsub());
    };
  }, [threads, user?.uid]);

  return (
    <div className="gc-chatPage">
      <div className="gc-chatListHeader">
        <button className="gc-chatIconBtn" type="button" onClick={() => navigate("/customer")}
        >
          {"<"}
        </button>

        <div className="gc-chatHeaderTitles">
          <div className="gc-chatHeaderTitle">Chats</div>
          <div className="gc-chatHeaderSub">Messages and delivery updates</div>
        </div>

        <button className="gc-chatIconBtn" type="button">
          S
        </button>
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
            <div className="gc-emptyTitle">No conversations yet</div>
            <div className="gc-emptySub">When you place an order, your runner chat shows up here.</div>
          </div>
        ) : (
          list.map((thread) => {
            const isSupport = thread.id === "support" || thread.type === "support";
            const name = isSupport
              ? "GoCrave Support"
              : thread.runnerName || runnerMap[thread.runnerId] || "Runner";
            const time = formatThreadTime(thread.updatedAt);
            const preview = thread.lastMessage || "Start the chat";
            const unread = Number(metaMap[thread.id]?.customerUnread || 0);
            const online = !!thread.isOnline;

            return (
              <div
                key={thread.id}
                className={`gc-threadRow ${unread > 0 ? "is-unread" : ""}`}
                onClick={() => navigate(`/customer/chat/${thread.id}`)}
                role="listitem"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") navigate(`/customer/chat/${thread.id}`);
                }}
              >
                <div className="gc-avatarWrap">
                  <img className="gc-avatar" src={pickAvatar(thread)} alt={name} />
                  {!isSupport && (
                    <span className={`gc-onlineDot ${online ? "on" : "off"}`} aria-hidden="true" />
                  )}
                </div>

                <div className="gc-threadMain">
                  <div className="gc-threadTop">
                    <div className="gc-threadName">
                      {name}
                      {isSupport ? <span className="gc-chatSupportPill">Support</span> : null}
                    </div>
                    <div className="gc-threadTime">{time}</div>
                  </div>

                  <div className="gc-threadBottom">
                    <div className="gc-threadPreview">{preview}</div>

                    {unread > 0 ? (
                      <span className="gc-unreadBadge" aria-label={`${unread} unread`}>
                        {unread > 99 ? "99+" : unread}
                      </span>
                    ) : (
                      <button
                        className="gc-threadDelete"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCustomerThread({ customerUid: user.uid, threadId: thread.id });
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
