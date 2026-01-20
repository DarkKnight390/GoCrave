import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { onValue, ref } from "firebase/database";
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { rtdb } from "../../services/firebase";

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

export default function CustomerTrackOrder() {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [runnerLocation, setRunnerLocation] = useState(null);
  const [route, setRoute] = useState([]);
  const [etaMinutes, setEtaMinutes] = useState(null);
  const [toast, setToast] = useState("");
  const routeAbort = useRef(null);
  const lastRouteKeyRef = useRef("");
  const lastRouteAtRef = useRef(0);
  const routeCooldownRef = useRef(0);
  const lastRouteFromRef = useRef(null);
  const lastRouteToRef = useRef(null);

  useEffect(() => {
    if (!orderId) return () => {};
    const unsub = onValue(ref(rtdb, `orders/${orderId}`), (snap) => {
      setOrder(snap.exists() ? snap.val() : null);
    });
    return () => unsub();
  }, [orderId]);

  useEffect(() => {
    if (!order?.runnerId || !order?.liveLocation?.runnerVisible) {
      setRunnerLocation(null);
      return () => {};
    }
    const unsub = onValue(ref(rtdb, `runnerLocations/${order.runnerId}`), (snap) => {
      setRunnerLocation(snap.exists() ? snap.val() : null);
    });
    return () => unsub();
  }, [order?.runnerId, order?.liveLocation?.runnerVisible]);

  const customerPin = order?.liveLocation?.customerLatLng || null;
  const runnerPin = runnerLocation?.lat && runnerLocation?.lng ? runnerLocation : null;
  const displayRunnerPin = useMemo(() => {
    if (!runnerPin) return null;
    if (!customerPin) return runnerPin;
    const distance = haversine(customerPin, runnerPin);
    if (distance > 5) return runnerPin;
    return {
      ...runnerPin,
      lat: runnerPin.lat + 0.00015,
      lng: runnerPin.lng + 0.00015,
    };
  }, [customerPin, runnerPin]);

  const center = useMemo(() => {
    if (runnerPin) return [runnerPin.lat, runnerPin.lng];
    if (customerPin) return [customerPin.lat, customerPin.lng];
    return [18.0123, -76.79];
  }, [customerPin, runnerPin]);

  const status = order?.status || "pending";
  const isCancelled = status === "cancelled";
  const expiresAt = order?.liveLocation?.expiresAt || null;
  const notExpired = !expiresAt || expiresAt > Date.now();
  const liveActive = !!order?.liveLocation?.runnerVisible && notExpired;

  const points = useMemo(() => {
    const list = [];
    if (customerPin) list.push([customerPin.lat, customerPin.lng]);
    if (displayRunnerPin && liveActive) list.push([displayRunnerPin.lat, displayRunnerPin.lng]);
    return list;
  }, [customerPin, displayRunnerPin, liveActive]);

  useEffect(() => {
    if (!customerPin || !runnerPin || !liveActive) {
      setRoute([]);
      setEtaMinutes(null);
      return;
    }
    const distanceMeters = haversine(customerPin, runnerPin);
    const speed = runnerPin.speed;
    const etaSeconds = speed && speed > 1 ? distanceMeters / speed : distanceMeters / 8;
    setEtaMinutes(Math.max(1, Math.round(etaSeconds / 60)));
  }, [customerPin, runnerPin, liveActive]);

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
    if (notExpired) return;
    setToast("Live location ended.");
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [notExpired]);

  useEffect(() => {
    if (isCancelled) {
      navigate("/customer/orders", { replace: true });
    }
  }, [isCancelled, navigate]);

  return (
    <div className="gc-trackPage">
      <div className="gc-trackHeader">
        <button className="gc-checkoutBack" type="button" onClick={() => navigate(-1)}>
          ←
        </button>
        <div>
          <div className="gc-trackTitle">Track order</div>
          <div className="gc-trackSub">Status: {status}</div>
        </div>
      </div>

      <div className="gc-trackCard">
        <div className="gc-trackMeta">
          <div>
            <div className="gc-trackLabel">Order</div>
            <div className="gc-trackValue">{orderId}</div>
          </div>
          <div>
            <div className="gc-trackLabel">Runner</div>
            <div className="gc-trackValue">{order?.runnerId || "Waiting..."}</div>
          </div>
        </div>
        <div className="gc-trackHint">
          {liveActive
            ? "Live location active."
            : notExpired
            ? "Live location will appear when a runner accepts."
            : "Live location ended."}
        </div>
        {etaMinutes !== null ? (
          <div className="gc-trackEta">ETA: {etaMinutes} min</div>
        ) : null}
      </div>

      <div className="gc-trackMapWrap">
        <MapContainer center={center} zoom={15} scrollWheelZoom={false} className="gc-trackMap">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds points={points} />
          {customerPin ? (
            <CircleMarker
              center={[customerPin.lat, customerPin.lng]}
              radius={10}
              pathOptions={{ color: "#2563eb", fillColor: "#2563eb", fillOpacity: 0.85 }}
            >
              <Popup>Customer</Popup>
            </CircleMarker>
          ) : null}
          {displayRunnerPin && liveActive ? (
            <CircleMarker
              center={[displayRunnerPin.lat, displayRunnerPin.lng]}
              radius={12}
              pathOptions={{ color: "#f97316", fillColor: "#f97316", fillOpacity: 0.9 }}
            >
              <Popup>Runner</Popup>
            </CircleMarker>
          ) : null}
          {route.length > 0 ? (
            <Polyline positions={route} pathOptions={{ color: "#f97316", weight: 4, opacity: 0.8 }} />
          ) : customerPin && runnerPin && liveActive ? (
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
      {toast ? <div className="gc-trackToast">{toast}</div> : null}
    </div>
  );
}
