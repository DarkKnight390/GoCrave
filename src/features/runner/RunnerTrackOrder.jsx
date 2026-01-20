import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { onValue, ref, update } from "firebase/database";
import { MapContainer, TileLayer, CircleMarker, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { rtdb } from "../../services/firebase";
import { useAuthStore } from "../../store/useAuthStore";
import { setRunnerLocation } from "../../services/rtdb.service";

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

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points || points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 16, { animate: true });
      return;
    }
    map.fitBounds(points, { padding: [40, 40], animate: true });
  }, [map, points]);
  return null;
}

export default function RunnerTrackOrder() {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const user = useAuthStore((s) => s.user);
  const [order, setOrder] = useState(null);
  const [runnerLocation, setRunnerLocation] = useState(null);
  const [route, setRoute] = useState([]);
  const routeAbort = useRef(null);
  const lastRouteKeyRef = useRef("");
  const lastRouteAtRef = useRef(0);
  const routeCooldownRef = useRef(0);
  const lastRouteFromRef = useRef(null);
  const lastRouteToRef = useRef(null);
  const extendedRef = useRef(null);

  useEffect(() => {
    if (!orderId) return () => {};
    const unsub = onValue(ref(rtdb, `orders/${orderId}`), (snap) => {
      setOrder(snap.exists() ? snap.val() : null);
    });
    return () => unsub();
  }, [orderId]);

  useEffect(() => {
    if (!order?.runnerId) return () => {};
    const unsub = onValue(ref(rtdb, `runnerLocations/${order.runnerId}`), (snap) => {
      setRunnerLocation(snap.exists() ? snap.val() : null);
    });
    return () => unsub();
  }, [order?.runnerId]);

  const customerPin = order?.liveLocation?.customerLatLng || null;
  const runnerPin = runnerLocation?.lat && runnerLocation?.lng ? runnerLocation : null;
  const liveActive = !!order?.liveLocation?.runnerVisible;
  const expiresAt = order?.liveLocation?.expiresAt || null;

  useEffect(() => {
    if (!order?.orderId || !liveActive) return;
    if (!expiresAt) return;
    if (expiresAt > Date.now()) return;
    if (extendedRef.current === order.orderId) return;
    const nextExpires = Date.now() + 60 * 60 * 1000;
    const updates = {};
    updates[`orders/${order.orderId}/liveLocation/expiresAt`] = nextExpires;
    if (order?.liveLocation?.sessionId) {
      updates[`liveLocationSessions/${order.liveLocation.sessionId}/expiresAt`] = nextExpires;
    }
    update(ref(rtdb), updates).finally(() => {
      extendedRef.current = order.orderId;
    });
  }, [order?.orderId, order?.liveLocation?.sessionId, expiresAt, liveActive]);

  const points = useMemo(() => {
    const list = [];
    if (customerPin) list.push([customerPin.lat, customerPin.lng]);
    if (runnerPin) list.push([runnerPin.lat, runnerPin.lng]);
    return list;
  }, [customerPin, runnerPin]);

  useEffect(() => {
    if (!customerPin || !runnerPin || !liveActive) {
      setRoute([]);
      return;
    }
    const now = Date.now();
    const key = `${runnerPin.lat.toFixed(5)},${runnerPin.lng.toFixed(5)}->${customerPin.lat.toFixed(5)},${customerPin.lng.toFixed(5)}`;
    const movedEnough = lastRouteKeyRef.current && lastRouteKeyRef.current !== key;
    const movedFrom =
      lastRouteFromRef.current && haversine(lastRouteFromRef.current, runnerPin);
    const movedTo =
      lastRouteToRef.current && haversine(lastRouteToRef.current, customerPin);
    const movedMeters = Math.max(movedFrom || 0, movedTo || 0);
    const movedOverThreshold = movedMeters >= 20;
    const minInterval = 15000;
    if (!movedOverThreshold && !movedEnough && now - lastRouteAtRef.current < minInterval) {
      return;
    }
    if (now < routeCooldownRef.current) return;
    if (routeAbort.current) routeAbort.current.abort();
    const controller = new AbortController();
    routeAbort.current = controller;
    const ghKey = import.meta.env.VITE_GRAPHHOPPER_KEY;
    if (!ghKey) return;
    const url = `https://graphhopper.com/api/1/route?point=${runnerPin.lat},${runnerPin.lng}&point=${customerPin.lat},${customerPin.lng}&vehicle=car&points_encoded=false&key=${ghKey}`;
    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) {
          const err = new Error("route_failed");
          err.status = res.status;
          throw err;
        }
        return res.json();
      })
      .then((data) => {
        const coords = data?.paths?.[0]?.points?.coordinates || [];
        const line = coords.map(([lng, lat]) => [lat, lng]);
        setRoute(line);
        lastRouteKeyRef.current = key;
        lastRouteAtRef.current = now;
        lastRouteFromRef.current = { lat: runnerPin.lat, lng: runnerPin.lng };
        lastRouteToRef.current = { lat: customerPin.lat, lng: customerPin.lng };
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        if (now - lastRouteAtRef.current < minInterval) return;
        routeCooldownRef.current = now + (err?.status === 429 ? 60000 : 30000);
      });
    return () => controller.abort();
  }, [customerPin, runnerPin, liveActive]);

  useEffect(() => {
    if (!user?.uid) return () => {};
    if (!order?.liveLocation?.enabled) return () => {};
    if (!order?.runnerId) return () => {};
    if (!navigator.geolocation) return () => {};

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setRunnerLocation(order.runnerId, {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [order?.liveLocation?.enabled, order?.runnerId, user?.uid]);

  return (
    <div className="gc-trackPage">
      <div className="gc-trackHeader">
        <button className="gc-checkoutBack" type="button" onClick={() => navigate(-1)}>
          ←
        </button>
        <div>
          <div className="gc-trackTitle">Runner navigation</div>
          <div className="gc-trackSub">{orderId}</div>
        </div>
      </div>

      <div className="gc-trackCard">
        <div className="gc-trackMeta">
          <div>
            <div className="gc-trackLabel">Destination</div>
            <div className="gc-trackValue">
              {order?.delivery?.addressText || "Drop-off location"}
            </div>
          </div>
          <div>
            <div className="gc-trackLabel">Status</div>
            <div className="gc-trackValue">{order?.status || "pending"}</div>
          </div>
        </div>
        <div className="gc-trackHint">
          {liveActive ? "Navigation active." : "Waiting for live location."}
        </div>
      </div>

      <div className="gc-trackMapWrap">
        <MapContainer
          center={[18.0123, -76.79]}
          zoom={15}
          scrollWheelZoom={false}
          className="gc-trackMap"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds points={points} />
          {customerPin ? (
            <CircleMarker center={[customerPin.lat, customerPin.lng]} radius={10} pathOptions={{ color: "#2563eb" }} />
          ) : null}
          {runnerPin ? (
            <CircleMarker center={[runnerPin.lat, runnerPin.lng]} radius={10} pathOptions={{ color: "#f97316" }} />
          ) : null}
          {route.length > 0 ? (
            <Polyline positions={route} pathOptions={{ color: "#f97316", weight: 4, opacity: 0.85 }} />
          ) : customerPin && runnerPin ? (
            <Polyline
              positions={[
                [runnerPin.lat, runnerPin.lng],
                [customerPin.lat, customerPin.lng],
              ]}
              pathOptions={{ color: "#f97316", weight: 4, opacity: 0.8, dashArray: "6 8" }}
            />
          ) : null}
        </MapContainer>
      </div>
    </div>
  );
}
