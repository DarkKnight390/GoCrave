import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../../services/auth.service";
import { useAuthStore } from "../../store/useAuthStore";
import { onValue, ref } from "firebase/database";
import { rtdb } from "../../services/firebase";
import {
  acceptOrderAsRunner,
  listenAvailableOrdersForRunner,
  listenRunnerOrders,
  rejectOrderAsRunner,
  setRunnerLocation,
  updateOrderStatus,
} from "../../services/rtdb.service";
import { sendChatMessage } from "../../services/chat.service";
import {
  getRunnerIdByUid,
  listenRunnerCore,
  listenRunnerMetrics,
  recordRunnerDelivery,
  setRunnerAvailability,
} from "../../services/runners.service";
import { getRestaurant } from "../../services/restaurants.service";

const money = (n) =>
  new Intl.NumberFormat("en-JM", { style: "currency", currency: "JMD" }).format(n || 0);

const haversine = (a, b) => {
  if (!a || !b) return 0;
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.sqrt(h));
};

export default function RunnerHome() {
  const { profile, user } = useAuthStore();
  const navigate = useNavigate();
  const [pendingOrders, setPendingOrders] = useState([]);
  const [myOrders, setMyOrders] = useState([]);
  const [busy, setBusy] = useState("");
  const [runnerId, setRunnerId] = useState(null);
  const [runnerCore, setRunnerCore] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [availability, setAvailability] = useState("online");
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [battery, setBattery] = useState(null);
  const [network, setNetwork] = useState(null);
  const [runnerCoords, setRunnerCoords] = useState(null);
  const [areaLabel, setAreaLabel] = useState("Kingston 8");
  const [etaInfo, setEtaInfo] = useState(null);
  const [etaLoading, setEtaLoading] = useState(false);
  const [restaurantInfo, setRestaurantInfo] = useState(null);
  const [lastDeliveredAmount, setLastDeliveredAmount] = useState(null);
  const [lastDeliveredId, setLastDeliveredId] = useState(null);
  const [deliverMsg, setDeliverMsg] = useState("");
  const [payoutPerDelivery, setPayoutPerDelivery] = useState(1000);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const geoRef = useRef({ lat: null, lng: null, at: 0 });
  const etaRouteRef = useRef({
    lastAt: 0,
    cooldownUntil: 0,
    lastFrom: null,
    lastTo: null,
  });

  const onLogout = async () => {
    await logout();
    navigate("/");
  };

  useEffect(() => {
    if (!user?.uid) return () => {};
    if (availability !== "online") {
      setPendingOrders([]);
      return () => {};
    }
    const unsub = listenAvailableOrdersForRunner(user.uid, setPendingOrders);
    return () => unsub();
  }, [user?.uid, availability]);

  useEffect(() => {
    if (!user?.uid) return () => {};
    const unsub = listenRunnerOrders(user.uid, setMyOrders);
    return () => unsub();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    let active = true;
    getRunnerIdByUid(user.uid, user.email).then((id) => {
      if (active) setRunnerId(id);
    });
    return () => {
      active = false;
    };
  }, [user?.uid, user?.email]);

  useEffect(() => {
    if (!runnerId) return () => {};
    const unsubCore = listenRunnerCore(runnerId, setRunnerCore);
    const unsubMetrics = listenRunnerMetrics(runnerId, setMetrics);
    return () => {
      unsubCore?.();
      unsubMetrics?.();
    };
  }, [runnerId]);

  useEffect(() => {
    if (runnerCore?.availability) {
      setAvailability(runnerCore.availability);
    }
    if (runnerCore?.area) {
      setAreaLabel(runnerCore.area);
    } else if (profile?.area) {
      setAreaLabel(profile.area);
    }
  }, [runnerCore?.availability, runnerCore?.area, profile?.area]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsAccuracy(pos.coords.accuracy);
        setRunnerCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => setGpsAccuracy(null),
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 8000 }
    );
  }, []);

  useEffect(() => {
    let cleanup = () => {};
    if (navigator.getBattery) {
      navigator.getBattery().then((bat) => {
        const update = () =>
          setBattery({
            level: Math.round(bat.level * 100),
            charging: bat.charging,
          });
        update();
        bat.addEventListener("levelchange", update);
        bat.addEventListener("chargingchange", update);
        cleanup = () => {
          bat.removeEventListener("levelchange", update);
          bat.removeEventListener("chargingchange", update);
        };
      });
    }
    return () => cleanup();
  }, []);

  useEffect(() => {
    const connection = navigator.connection;
    if (!connection) return () => {};
    const update = () =>
      setNetwork({
        type: connection.effectiveType || "unknown",
        downlink: connection.downlink || null,
      });
    update();
    connection.addEventListener("change", update);
    return () => connection.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const payoutRef = ref(rtdb, "config/payouts/runnerPerDelivery");
    return onValue(payoutRef, (snap) => {
      const val = snap.exists() ? Number(snap.val()) : 1000;
      setPayoutPerDelivery(Number.isFinite(val) ? val : 1000);
    });
  }, []);

  const accept = async (order) => {
    if (!user?.uid) return;
    setBusy(order.orderId);
    try {
      await acceptOrderAsRunner(order.orderId, user.uid);
      const resolvedRunnerId = runnerId || (await getRunnerIdByUid(user.uid));
      if (resolvedRunnerId && order?.userId) {
        await sendChatMessage({
          runnerId: resolvedRunnerId,
          runnerName: profile?.name || "Runner",
          customerUid: order.userId,
          customerName: null,
          role: "runner",
          text: "Order accepted. Tap below to track your order.",
          action: {
            type: "track_order",
            label: "Track order",
            orderId: order.orderId,
          },
        });
      }
    } finally {
      setBusy("");
    }
  };

  const reject = async (order) => {
    if (!user?.uid) return;
    setBusy(order.orderId);
    try {
      await rejectOrderAsRunner(order.orderId, user.uid);
    } finally {
      setBusy("");
    }
  };

  const markDelivered = async (order) => {
    if (!order?.orderId) return;
    setBusy(order.orderId);
    setDeliverMsg("");
    try {
      const resolvedRunnerId =
        runnerId || (user?.uid ? await getRunnerIdByUid(user.uid, user.email) : null);
      await updateOrderStatus(order.orderId, {
        status: "delivered",
        deliveredAt: Date.now(),
        updatedByRole: "runner",
      });
      if (resolvedRunnerId) {
        await recordRunnerDelivery(resolvedRunnerId, payoutPerDelivery);
      }
      setLastDeliveredAmount(payoutPerDelivery);
      setLastDeliveredId(order.orderId);
      setDeliverMsg("✅ Marked as delivered.");
    } catch (err) {
      setDeliverMsg(err?.message || "Failed to mark delivered.");
    } finally {
      setBusy("");
    }
  };

  const cancelOrder = async (order) => {
    if (!order?.orderId || !user?.uid) return;
    const reason = cancelReason.trim();
    setCancelBusy(true);
    try {
      await updateOrderStatus(order.orderId, {
        status: "cancelled",
        cancelledAt: Date.now(),
        cancelledBy: "runner",
        cancelReason: reason || "Runner requested cancellation.",
        updatedByRole: "runner",
      });
      if (order.userId && runnerId) {
        await sendChatMessage({
          runnerId,
          runnerName: profile?.name || "Runner",
          customerUid: order.userId,
          customerName: null,
          role: "runner",
          text: `Order cancelled: ${reason || "Runner requested cancellation."}`,
        });
      }
      setShowCancel(false);
      setCancelReason("");
    } finally {
      setCancelBusy(false);
    }
  };

  const activeOrders = useMemo(
    () =>
      myOrders.filter((order) =>
        ["accepted", "on_route", "picked_up"].includes(order.status)
      ),
    [myOrders]
  );

  useEffect(() => {
    if (!runnerId) return () => {};
    const liveOrder = activeOrders.find((o) =>
      ["accepted", "on_route", "picked_up"].includes(o?.status)
    );
    if (!liveOrder) return () => {};
    if (!navigator.geolocation) return () => {};

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setRunnerLocation(user.uid, {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
        });
        setRunnerCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setGpsAccuracy(pos.coords.accuracy);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [activeOrders, runnerId, user?.uid]);

  const primaryOrder = activeOrders[0] || null;
  const runnerTypeLabel =
    runnerCore?.type === "company" ? "GoCrave Verified" : "Independent Runner";
  const gpsStatus =
    gpsAccuracy == null
      ? { label: "GPS off", tone: "bad" }
      : gpsAccuracy <= 20
      ? { label: "GPS good", tone: "ok" }
      : gpsAccuracy <= 50
      ? { label: "GPS weak", tone: "warn" }
      : { label: "GPS poor", tone: "bad" };
  const alertsCount = Number(runnerCore?.warningsCount || 0);
  const deliveriesCount = Number(metrics?.deliveriesCount || 0);
  const totalEarnings = Number(metrics?.totalEarnings || 0);
  const ratingAvgValue =
    metrics?.ratingAvg != null ? metrics.ratingAvg : runnerCore?.ratingAvg || 0;
  const ratingAvg = Number(ratingAvgValue || 0).toFixed(1);

  const distanceText = etaInfo?.distanceKm
    ? `${etaInfo.distanceKm.toFixed(1)} km`
    : "-- km";
  const etaText = etaInfo?.etaMin ? `${Math.round(etaInfo.etaMin)} mins` : "-- mins";

  const toggleAvailability = async () => {
    if (!runnerId) return;
    const next = availability === "online" ? "offline" : "online";
    setAvailability(next);
    await setRunnerAvailability(runnerId, next);
  };

  useEffect(() => {
    if (!primaryOrder?.restaurantId) {
      setRestaurantInfo(null);
      return;
    }
    getRestaurant(primaryOrder.restaurantId).then((data) => {
      setRestaurantInfo(data);
    });
  }, [primaryOrder?.restaurantId]);

  useEffect(() => {
    if (!runnerCoords) return;
    const now = Date.now();
    const last = geoRef.current;
    const movedFar =
      last.lat == null ||
      Math.abs(runnerCoords.lat - last.lat) > 0.002 ||
      Math.abs(runnerCoords.lng - last.lng) > 0.002;
    if (!movedFar && now - last.at < 120000) return;
    geoRef.current = { ...runnerCoords, at: now };

    const apiBase = import.meta.env.VITE_RUNNER_API_URL || "http://localhost:8080";
    const url = `${apiBase}/api/geocode/reverse?lat=${runnerCoords.lat}&lng=${runnerCoords.lng}`;
    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const address = data?.address || {};
        const city = address.city || address.town || address.county || address.state;
        const suburb = address.suburb || address.neighbourhood || address.village;
        const postcode = address.postcode || "";
        const base = city || suburb || "Current area";
        const label = postcode ? `${base} ${postcode}` : base;
        setAreaLabel(label);
      })
      .catch(() => {});
  }, [runnerCoords]);

  useEffect(() => {
    let active = true;
    const dest = primaryOrder?.liveLocation?.customerLatLng || null;
    const ghKey = import.meta.env.VITE_GRAPHHOPPER_KEY;
    if (!dest || !runnerCoords || !ghKey) {
      setEtaInfo(null);
      return;
    }
    const now = Date.now();
    if (etaRouteRef.current.cooldownUntil && now < etaRouteRef.current.cooldownUntil) {
      return;
    }
    const movedFrom =
      etaRouteRef.current.lastFrom &&
      haversine(etaRouteRef.current.lastFrom, runnerCoords);
    const movedTo =
      etaRouteRef.current.lastTo && haversine(etaRouteRef.current.lastTo, dest);
    const movedMeters = Math.max(movedFrom || 0, movedTo || 0);
    const movedEnough = movedMeters >= 20;
    const minInterval = 15000;
    if (!movedEnough && now - etaRouteRef.current.lastAt < minInterval) {
      return;
    }

    const fetchRoute = async (from, to) => {
      const url = `https://graphhopper.com/api/1/route?point=${from.lat},${from.lng}&point=${to.lat},${to.lng}&vehicle=car&points_encoded=false&key=${ghKey}`;
      const res = await fetch(url);
      if (!res.ok) {
        const err = new Error("route_failed");
        err.status = res.status;
        throw err;
      }
      const data = await res.json();
      const path = data?.paths?.[0];
      if (!path) return null;
      return {
        distanceKm: (path.distance || 0) / 1000,
        etaMin: (path.time || 0) / 60000,
      };
    };

    const run = async () => {
      setEtaLoading(true);
      const now = Date.now();
      const movedFrom =
        etaRouteRef.current.lastFrom &&
        haversine(etaRouteRef.current.lastFrom, runnerCoords);
      const movedTo =
        etaRouteRef.current.lastTo && haversine(etaRouteRef.current.lastTo, dest);
      const movedMeters = Math.max(movedFrom || 0, movedTo || 0);
      const movedEnough = movedMeters >= 20;
      const minInterval = 15000;
      if (!movedEnough && now - etaRouteRef.current.lastAt < minInterval) {
        setEtaLoading(false);
        return;
      }
      if (now < etaRouteRef.current.cooldownUntil) {
        setEtaLoading(false);
        return;
      }
      const restCoords =
        restaurantInfo?.lat != null && restaurantInfo?.lng != null
          ? { lat: Number(restaurantInfo.lat), lng: Number(restaurantInfo.lng) }
          : null;

      if (!restCoords) {
        try {
          const direct = await fetchRoute(runnerCoords, dest);
          if (direct && active) {
            setEtaInfo({ ...direct, mode: "direct" });
            etaRouteRef.current.lastAt = now;
            etaRouteRef.current.lastFrom = { ...runnerCoords };
            etaRouteRef.current.lastTo = { ...dest };
          }
        } catch (err) {
          etaRouteRef.current.cooldownUntil = now + (err?.status === 429 ? 60000 : 30000);
        } finally {
          setEtaLoading(false);
        }
        return;
      }

      try {
        const toPickup = await fetchRoute(runnerCoords, restCoords);
        const toDropoff = await fetchRoute(restCoords, dest);
        if (active) {
          setEtaInfo({
            mode: "pickup_dropoff",
            pickup: toPickup,
            dropoff: toDropoff,
          });
          etaRouteRef.current.lastAt = now;
          etaRouteRef.current.lastFrom = { ...runnerCoords };
          etaRouteRef.current.lastTo = { ...dest };
        }
      } catch (err) {
        etaRouteRef.current.cooldownUntil = now + (err?.status === 429 ? 60000 : 30000);
      } finally {
        setEtaLoading(false);
      }
    };

    run().catch(() => setEtaLoading(false));
    return () => {
      active = false;
    };
  }, [primaryOrder?.liveLocation?.customerLatLng, runnerCoords, restaurantInfo]);

  return (
    <div className="gc-page gc-runnerHome">
      <div className="gc-runnerStatusBar">
        <button
          className={`gc-runnerToggle ${availability === "online" ? "isOnline" : ""}`}
          type="button"
          onClick={toggleAvailability}
        >
          <span className="gc-runnerToggleDot" />
          <span className="gc-runnerToggleText">
            {availability === "online" ? "ONLINE" : "OFFLINE"}
          </span>
        </button>

        <div className="gc-runnerStatusCenter">
          <div className="gc-runnerArea">{areaLabel}</div>
          <div className={`gc-runnerGps ${gpsStatus.tone}`}>{gpsStatus.label}</div>
        </div>

        <div className="gc-runnerStatusRight">
          <div className="gc-runnerStatChip">
            <span className="gc-runnerStatLabel">BAT</span>
            <span className="gc-runnerStatValue">
              {battery?.level != null ? `${battery.level}%` : "--"}
            </span>
          </div>
          <div className="gc-runnerStatChip">
            <span className="gc-runnerStatLabel">NET</span>
            <span className="gc-runnerStatValue">
              {network?.type ? network.type.toUpperCase() : "--"}
            </span>
          </div>
          <button className={`gc-runnerAlert ${alertsCount ? "hasAlerts" : ""}`} type="button">
            ALERTS {alertsCount ? `(${alertsCount})` : ""}
          </button>
        </div>
      </div>

      <div className="gc-runnerHeader">
        <div>
          <div className="gc-runnerTitle">Runner Home</div>
          <div className="gc-runnerSub">
            {profile?.name ? `Welcome, ${profile.name}.` : "Ready for deliveries."}
          </div>
        </div>
        <div className="gc-runnerBadge">{runnerTypeLabel}</div>
      </div>

      <div className="gc-earningsBar">
        <div className="gc-earningsItem">
          <div className="gc-earningsLabel">Today</div>
          <div className="gc-earningsValue">{money(totalEarnings)}</div>
        </div>
        <div className="gc-earningsItem">
          <div className="gc-earningsLabel">Deliveries</div>
          <div className="gc-earningsValue">{deliveriesCount}</div>
        </div>
        <div className="gc-earningsItem">
          <div className="gc-earningsLabel">Rating</div>
          <div className="gc-earningsValue">{ratingAvg}</div>
        </div>
      </div>

      {deliverMsg ? (
        <div className="gc-deliveredToast">
          <div className="gc-deliveredTitle">{deliverMsg}</div>
          {lastDeliveredId ? (
            <div className="gc-deliveredSub">
              Order #{String(lastDeliveredId).slice(-4)} • {money(lastDeliveredAmount || 0)}
            </div>
          ) : null}
        </div>
      ) : lastDeliveredId ? (
        <div className="gc-deliveredToast">
          <div className="gc-deliveredTitle">Delivered #{String(lastDeliveredId).slice(-4)}</div>
          <div className="gc-deliveredSub">
            You earned {money(lastDeliveredAmount || 0)} on this order.
          </div>
        </div>
      ) : null}

      {primaryOrder ? (
        <div className="gc-activeOrder">
          <div className="gc-activeOrderTop">
            <div>
              <div className="gc-activeOrderLabel">ACTIVE ORDER</div>
              <div className="gc-activeOrderId">
                #{String(primaryOrder.orderId || "").slice(-4).toUpperCase()}
              </div>
            </div>
            <button className="gc-activeOrderGhost" type="button" onClick={onLogout}>
              Log out
            </button>
          </div>

          <div className="gc-activeOrderCard">
            <div className="gc-activeOrderRow">
              <div className="gc-activeOrderName">
                {primaryOrder.restaurantName || "Restaurant"}
              </div>
              <div className="gc-activeOrderMeta">
                {primaryOrder.items?.length || 0} items
              </div>
            </div>
            <div className="gc-activeOrderRow">
              <div className="gc-activeOrderKey">Pickup</div>
              <div className="gc-activeOrderVal">
                {primaryOrder.restaurantName || "Pickup location"}
              </div>
            </div>
            <div className="gc-activeOrderRow">
              <div className="gc-activeOrderKey">Drop-off</div>
              <div className="gc-activeOrderVal">
                {primaryOrder.delivery?.addressText || "Delivery address"}
              </div>
            </div>
            <div className="gc-activeOrderRow">
              <div className="gc-activeOrderKey">Distance / ETA</div>
              <div className="gc-activeOrderVal">
                {etaInfo?.mode === "pickup_dropoff" ? (
                  <div className="gc-etaStack">
                    <div>
                      Pickup:{" "}
                      {etaInfo.pickup
                        ? `${etaInfo.pickup.distanceKm.toFixed(1)} km • ${Math.round(
                            etaInfo.pickup.etaMin
                          )} mins`
                        : "--"}
                    </div>
                    <div>
                      Drop-off:{" "}
                      {etaInfo.dropoff
                        ? `${etaInfo.dropoff.distanceKm.toFixed(1)} km • ${Math.round(
                            etaInfo.dropoff.etaMin
                          )} mins`
                        : "--"}
                    </div>
                  </div>
                ) : (
                  <>
                    {distanceText} • {etaText}
                  </>
                )}
              </div>
              <button
                className="gc-etaRefresh"
                type="button"
                onClick={() => setEtaInfo(null)}
                disabled={etaLoading}
                title="Refresh ETA"
              >
                {etaLoading ? "..." : "↻"}
              </button>
            </div>
            {primaryOrder.delivery?.notes ? (
              <div className="gc-activeOrderNote">
                Customer note: {primaryOrder.delivery.notes}
              </div>
            ) : null}
          </div>

          <button
            className="gc-activeOrderPrimary"
            type="button"
            onClick={() => navigate(`/runner/track/${primaryOrder.orderId}`)}
          >
            NAVIGATE TO PICKUP
          </button>
          <div className="gc-activeOrderActions">
            <button
              className="gc-activeOrderAction"
              type="button"
              disabled={busy === primaryOrder.orderId}
              onClick={() =>
                updateOrderStatus(primaryOrder.orderId, {
                  status: "on_route",
                  onRouteAt: Date.now(),
                  updatedByRole: "runner",
                })
              }
            >
              Mark on route
            </button>
            <button
              className="gc-activeOrderAction"
              type="button"
              disabled={busy === primaryOrder.orderId}
              onClick={() =>
                updateOrderStatus(primaryOrder.orderId, {
                  status: "picked_up",
                  pickedUpAt: Date.now(),
                  updatedByRole: "runner",
                })
              }
            >
              Mark picked up
            </button>
          </div>
          <button
            className="gc-activeOrderPrimary isSuccess"
            type="button"
            disabled={busy === primaryOrder.orderId}
            onClick={() => markDelivered(primaryOrder)}
          >
            MARK AS DELIVERED
          </button>

          <div className="gc-activeOrderActions">
            <button className="gc-activeOrderAction" type="button">
              Call customer
            </button>
            <button
              className="gc-activeOrderAction"
              type="button"
              onClick={() => navigate(`/runner/chat`)}
            >
              Message customer
            </button>
            <button
              className="gc-activeOrderAction danger"
              type="button"
              onClick={() => setShowCancel(true)}
            >
              Cancel order
            </button>
          </div>
        </div>
      ) : null}

      <div className="gc-incoming">
        <div className="gc-incomingHeader">Incoming Orders ({pendingOrders.length})</div>
        {pendingOrders.length === 0 ? (
          <div className="gc-muted">No pending orders right now.</div>
        ) : (
          pendingOrders.map((order) => (
            <div key={order.orderId} className="gc-incomingCard">
              <div className="gc-incomingMain">
                <div className="gc-incomingName">{order.restaurantName || "Restaurant"}</div>
                <div className="gc-incomingMeta">
                  {order.delivery?.addressText || "Delivery"}
                </div>
                <div className="gc-incomingMeta">
                  Est payout: {money(order.pricing?.total || 0)}
                </div>
              </div>
              <div className="gc-incomingActions">
                <button
                  className="gc-incomingAccept"
                  type="button"
                  disabled={busy === order.orderId || availability !== "online"}
                  onClick={() => accept(order)}
                >
                  ACCEPT
                </button>
                <button
                  className="gc-incomingDecline"
                  type="button"
                  disabled={busy === order.orderId}
                  onClick={() => reject(order)}
                >
                  DECLINE
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="gc-scheduled">
        <div className="gc-scheduledTitle">Scheduled / Pending</div>
        <div className="gc-scheduledRow">
          <span>Scheduled</span>
          <span>0</span>
        </div>
        <div className="gc-scheduledRow">
          <span>Pending acceptance</span>
          <span>{pendingOrders.length}</span>
        </div>
      </div>

      <div className="gc-mapPreview">
        <div className="gc-mapPreviewHeader">Map preview</div>
        <div className="gc-mapPreviewBody">
          <div className="gc-mapPin runner">Runner</div>
          <div className="gc-mapPin pickup">Pickup</div>
          <div className="gc-mapPin dropoff">Drop-off</div>
        </div>
      </div>

      {showCancel && primaryOrder && (
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
                onClick={() => cancelOrder(primaryOrder)}
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
