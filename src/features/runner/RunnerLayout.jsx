import { useEffect, useRef, useState } from "react";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore";
import { listenAvailableOrdersForRunner } from "../../services/rtdb.service";
import { listenRunnerIndexThreads, listenThreadMeta } from "../../services/chat.service";
import {
  getRunnerIdByUid,
  listenRunnerCore,
  setRunnerAvailability,
  updateRunnerCore,
} from "../../services/runners.service";
import { playTone } from "../../services/notifyAudio";

export default function RunnerLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const hideNav =
    pathname.startsWith("/runner/chat") || pathname.startsWith("/runner/track");
  const user = useAuthStore((s) => s.user);
  const [runnerId, setRunnerId] = useState(null);
  const [availability, setAvailability] = useState("online");
  const [lastActiveAt, setLastActiveAt] = useState(0);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [threads, setThreads] = useState([]);
  const [metaMap, setMetaMap] = useState({});
  const [orderBanner, setOrderBanner] = useState(null);
  const [msgBanner, setMsgBanner] = useState(null);
  const prevPendingRef = useRef(null);
  const prevUnreadRef = useRef(null);
  const bannerTimerRef = useRef(null);
  const msgTimerRef = useRef(null);

  useEffect(() => {
    if (!user?.uid) return undefined;
    let active = true;
    getRunnerIdByUid(user.uid, user.email).then((id) => {
      if (active) setRunnerId(id);
    });
    return () => {
      active = false;
    };
  }, [user?.uid, user?.email]);

  useEffect(() => {
    if (!runnerId) return undefined;
    const unsub = listenRunnerCore(runnerId, (core) => {
      setAvailability(core?.availability || "online");
      setLastActiveAt(core?.lastActiveAt || 0);
    });
    return () => unsub?.();
  }, [runnerId]);

  useEffect(() => {
    if (!runnerId || availability !== "online") return undefined;
    const idleMs = 60 * 60 * 1000;
    const interval = setInterval(() => {
      if (!lastActiveAt) return;
      if (Date.now() - lastActiveAt > idleMs) {
        setRunnerAvailability(runnerId, "offline");
      }
    }, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [availability, lastActiveAt, runnerId]);

  useEffect(() => {
    if (!runnerId || availability !== "online") return undefined;
    let lastPing = 0;
    const minGapMs = 2 * 60 * 1000;
    const ping = () => {
      const now = Date.now();
      if (now - lastPing < minGapMs) return;
      lastPing = now;
      updateRunnerCore(runnerId, { lastActiveAt: now });
    };
    const events = ["mousemove", "keydown", "touchstart", "visibilitychange", "focus"];
    events.forEach((evt) => window.addEventListener(evt, ping, { passive: true }));
    ping();
    return () => {
      events.forEach((evt) => window.removeEventListener(evt, ping));
    };
  }, [availability, runnerId]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    if (availability !== "online") {
      setPendingOrders([]);
      return () => {};
    }
    const unsub = listenAvailableOrdersForRunner(user.uid, setPendingOrders);
    return () => unsub?.();
  }, [availability, user?.uid]);

  useEffect(() => {
    const prev = prevPendingRef.current;
    if (prev !== null && pendingOrders.length > prev) {
      playTone("incomingOrder");
      const sorted = [...pendingOrders].sort(
        (a, b) => (b?.createdAt || 0) - (a?.createdAt || 0)
      );
      setOrderBanner(sorted[0] || null);
      if (bannerTimerRef.current) {
        clearTimeout(bannerTimerRef.current);
      }
      bannerTimerRef.current = setTimeout(() => {
        setOrderBanner(null);
      }, 9000);
    }
    prevPendingRef.current = pendingOrders.length;
  }, [pendingOrders.length]);

  useEffect(() => {
    if (!runnerId) return undefined;
    const unsub = listenRunnerIndexThreads(runnerId, setThreads);
    return () => unsub?.();
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

  useEffect(() => {
    const total = Object.values(metaMap).reduce((sum, meta) => {
      const count = Number(meta?.runnerUnread || 0);
      return sum + count;
    }, 0);
    const prev = prevUnreadRef.current;
    if (prev !== null && total > prev) {
      playTone("incomingMessage");
      const candidates = threads.map((t) => {
        const meta = metaMap[t.customerUid] || {};
        return {
          id: t.customerUid,
          name: t.customerName || "Customer",
          updatedAt: meta.updatedAt || t.updatedAt || 0,
          preview: meta.lastMessage || t.lastMessage || "New message",
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
        if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
        msgTimerRef.current = setTimeout(() => setMsgBanner(null), 9000);
      }
    }
    prevUnreadRef.current = total;
  }, [metaMap, threads]);

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
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
              setMsgBanner(null);
              navigate(`/runner/chat/${msgBanner.id}`);
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
            ×
          </button>
        </div>
      )}

      {orderBanner && (
        <div className="gc-orderBanner">
          <div className="gc-orderBannerMain">
            <div className="gc-orderBannerTitle">New incoming order</div>
            <div className="gc-orderBannerSub">
              {orderBanner.restaurantName || "Restaurant"} ·{" "}
              {orderBanner.delivery?.addressText || "Delivery"}
            </div>
          </div>
          <button
            className="gc-orderBannerBtn"
            type="button"
            onClick={() => {
              setOrderBanner(null);
              navigate("/runner/home");
            }}
          >
            View
          </button>
          <button
            className="gc-orderBannerClose"
            type="button"
            onClick={() => setOrderBanner(null)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
      <main className="gc-main">
        <Outlet />
      </main>

      {!hideNav && (
        <nav className="gc-bottomNav">
          <NavItem to="/runner/home" label="Home" icon={<HomeIcon />} />
          <NavItem to="/runner/chat" label="Chat" icon={<ChatIcon />} />
          <NavItem to="/runner/orders" label="Orders" icon={<OrdersIcon />} />
          <NavItem to="/runner/earnings" label="Earnings" icon={<EarningsIcon />} />
          <NavItem to="/runner/profile" label="Profile" icon={<UserIcon />} />
        </nav>
      )}
    </div>
  );
}

function NavItem({ to, label, icon }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => "gc-navItem" + (isActive ? " isActive" : "")}
    >
      <div className="gc-navIcon" aria-hidden="true">
        {icon}
      </div>
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

function OrdersIcon() {
  return (
    <svg className="gc-navSvg" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 3h14a2 2 0 0 1 2 2v14l-2-1-2 1-2-1-2 1-2-1-2 1-2-1-2 1V5a2 2 0 0 1 2-2zm3 6h8v2H8V9zm0 4h8v2H8v-2z" />
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

function EarningsIcon() {
  return (
    <svg className="gc-navSvg" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2zm1 15.5V19h-2v-1.4a4.6 4.6 0 0 1-3-1.6l1.6-1.2a3.1 3.1 0 0 0 2.4 1.1c1.2 0 2-.6 2-1.5s-.5-1.3-2.2-1.8c-2.2-.6-3.6-1.3-3.6-3.3a3.4 3.4 0 0 1 3-3.3V5h2v1.3a4.1 4.1 0 0 1 2.6 1.2l-1.4 1.4A2.6 2.6 0 0 0 12 8.1c-1.1 0-1.8.5-1.8 1.3s.6 1.1 2.3 1.6c2.4.7 3.5 1.7 3.5 3.5a3.6 3.6 0 0 1-3 3.5z" />
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
