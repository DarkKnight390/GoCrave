import { useEffect, useRef, useState } from "react";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore";
import { listenChatThreads, listenThreadMeta } from "../../services/chat.service";
import { listenAllRunners } from "../../services/runnerAdmin.service";
import { onValue, query, ref, orderByChild, equalTo } from "firebase/database";
import { rtdb } from "../../services/firebase";
import { playTone } from "../../services/notifyAudio";

export default function CustomerLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const hideNav = pathname === "/customer/chat" || pathname.startsWith("/customer/chat/");
  const user = useAuthStore((s) => s.user);
  const [threads, setThreads] = useState([]);
  const [metaMap, setMetaMap] = useState({});
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [runnerNameMap, setRunnerNameMap] = useState({});
  const [msgBanner, setMsgBanner] = useState(null);
  const prevUnreadRef = useRef(null);
  const prevOrdersRef = useRef(null);
  const bannerTimerRef = useRef(null);

  useEffect(() => {
    if (!user?.uid) return undefined;
    const unsub = listenChatThreads(user.uid, setThreads);
    return () => unsub?.();
  }, [user?.uid]);

  useEffect(() => {
    const unsub = listenAllRunners((list) => {
      const map = {};
      list.forEach((runner) => {
        if (runner?.runnerId) map[runner.runnerId] = runner.name || "Runner";
      });
      setRunnerNameMap(map);
    });
    return () => unsub?.();
  }, []);

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

  useEffect(() => {
    const total = Object.values(metaMap).reduce((sum, meta) => {
      const count = Number(meta?.customerUnread || 0);
      return sum + count;
    }, 0);
    setUnreadTotal(total);
  }, [metaMap]);

  useEffect(() => {
    const prev = prevUnreadRef.current;
    if (prev !== null && unreadTotal > prev) {
      playTone("incomingMessage");
      const candidates = threads.map((t) => {
        const meta = metaMap[t.id] || {};
        return {
          id: t.id,
          runnerId: t.runnerId,
          type: t.type,
          updatedAt: meta.updatedAt || t.updatedAt || 0,
          preview: meta.lastMessage || t.lastMessage || "New message",
          name:
            t.type === "support"
              ? "GoCrave Support"
              : t.runnerName || runnerNameMap[t.runnerId] || "Runner",
        };
      });
      candidates.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      const latest = candidates[0] || null;
      if (latest) {
        setMsgBanner({
          id: latest.id,
          name: latest.name,
          preview: latest.preview,
        });
        if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
        bannerTimerRef.current = setTimeout(() => setMsgBanner(null), 9000);
      }
    }
    prevUnreadRef.current = unreadTotal;
  }, [metaMap, runnerNameMap, threads, unreadTotal]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    const ordersQuery = query(ref(rtdb, "orders"), orderByChild("userId"), equalTo(user.uid));
    const unsub = onValue(ordersQuery, (snap) => {
      const data = snap.val() || {};
      const current = {};
      const acceptedStatuses = new Set(["accepted", "on_route", "delivering"]);
      Object.values(data).forEach((order) => {
        if (!order?.orderId) return;
        const status = order.status || "pending";
        current[order.orderId] = status;
      });

      if (prevOrdersRef.current) {
        Object.entries(current).forEach(([orderId, status]) => {
          const prevStatus = prevOrdersRef.current[orderId];
          if (prevStatus && prevStatus !== status && acceptedStatuses.has(status)) {
            playTone("orderAccepted");
          }
        });
      }

      prevOrdersRef.current = current;
    });

    return () => unsub();
  }, [user?.uid]);

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, []);

  return (
    <div className="gc-shell">
      {msgBanner && (
        <div className="gc-msgBanner">
          <div className="gc-msgBannerMain">
            <div className="gc-msgBannerTitle">{msgBanner.name}</div>
            <div className="gc-msgBannerSub">{msgBanner.preview}</div>
          </div>
          <button
            className="gc-msgBannerBtn"
            type="button"
            onClick={() => {
              const target =
                msgBanner.id === "support"
                  ? "/customer/chat/support"
                  : `/customer/chat/${msgBanner.id}`;
              setMsgBanner(null);
              navigate(target);
            }}
          >
            Open
          </button>
          <button
            className="gc-msgBannerClose"
            type="button"
            onClick={() => setMsgBanner(null)}
            aria-label="Dismiss"
          >
            X
          </button>
        </div>
      )}

      <main className="gc-main">
        <Outlet />
      </main>

      {!hideNav && (
        <nav className="gc-bottomNav">
          <NavItem to="/customer/home" label="Home" icon={<HomeIcon />} />
          <NavItem to="/customer/runners" label="Runners" icon={<RunnerIcon />} />
          <NavItem to="/customer/chat" label="Chat" icon={<ChatIcon />} badge={unreadTotal} />
          <NavItem to="/customer/orders" label="Orders" icon={<ReceiptIcon />} />
          <NavItem to="/customer/profile" label="Profile" icon={<UserIcon />} />
        </nav>
      )}
    </div>
  );
}

function NavItem({ to, label, icon, badge }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => "gc-navItem" + (isActive ? " isActive" : "")}
    >
      <div className="gc-navIcon" aria-hidden="true">
        {icon}
      </div>
      {badge > 0 && (
        <span className="gc-navBadge" aria-label={`${badge} unread messages`}>
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      <div className="gc-navLabel">{label}</div>
    </NavLink>
  );
}

function HomeIcon() {
  return (
    <svg className="gc-navSvg" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}

function RunnerIcon() {
  return (
    <svg className="gc-navSvg" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 6a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM21 12l-6-2-2 3-3-1 2-4-4-2-2 3-3 5 3 1 2-3 4 2-2 6h3l2-6 3 1z" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg className="gc-navSvg" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg className="gc-navSvg" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 2h12a2 2 0 0 1 2 2v18l-2-1-2 1-2-1-2 1-2-1-2 1-2-1-2 1V4a2 2 0 0 1 2-2zm3 6h6v2H9V8zm0 4h6v2H9v-2z" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg className="gc-navSvg" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm-9 9a9 9 0 0 1 18 0v1H3z" />
    </svg>
  );
}
