import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { onValue, ref } from "firebase/database";
import { listenAllRunners } from "../../services/runnerAdmin.service";
import { rtdb } from "../../services/firebase";
import { useCartStore } from "../../store/useCartStore";
import runner1 from "../../assets/avatars/runner1.jpg";
import runner2 from "../../assets/avatars/runner2.jpg";
import runner3 from "../../assets/avatars/runner3.jpg";
import runner4 from "../../assets/avatars/runner4.jpg";
import runner5 from "../../assets/avatars/runner5.jpg";

const avatars = [runner1, runner2, runner3, runner4, runner5];

const pickAvatar = (runner) => {
  const key = `${runner?.runnerId || ""}${runner?.name || ""}`;
  if (!key) return avatars[0];
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) % 100000;
  }
  return avatars[Math.abs(hash) % avatars.length];
};

const formatTime = (value) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch (e) {
    return "-";
  }
};

const renderStars = (avg) => {
  const val = Number(avg || 0);
  const full = Math.round(val);
  return "★★★★★".slice(0, full) + "☆☆☆☆☆".slice(0, 5 - full);
};

const formatRating = (avg) => Number(avg || 0).toFixed(1);
const runnerKey = (id) => String(id || "").trim().toUpperCase();

export default function CustomerRunnerDetail() {
  const navigate = useNavigate();
  const { runnerId } = useParams();
  const [runners, setRunners] = useState([]);
  const [metricsMap, setMetricsMap] = useState({});
  const setRunner = useCartStore((s) => s.setRunner);

  useEffect(() => {
    const unsub = listenAllRunners((list) => setRunners(list));
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onValue(ref(rtdb, "runnerMetrics"), (snap) => {
      setMetricsMap(snap.val() || {});
    });
    return () => unsub();
  }, []);

  const runner = useMemo(
    () => runners.find((item) => item.runnerId === runnerId),
    [runners, runnerId]
  );

  if (!runner) {
    return (
      <div className="gc-page" style={{ padding: 18 }}>
        <div className="gc-panel">
          <h2 className="gc-panelTitle">Runner not found</h2>
          <p className="gc-muted">The runner you selected is not available.</p>
          <button className="gc-miniBtn" type="button" onClick={() => navigate("/customer/runners")}>
            Back to runners
          </button>
        </div>
      </div>
    );
  }

  const key = runnerKey(runner.runnerId);
  const ratingAvg = metricsMap[key]?.ratingAvg ?? runner.ratingAvg ?? 0;
  const ratingCount = metricsMap[key]?.ratingCount ?? runner.ratingCount ?? 0;

  return (
    <div className="gc-page" style={{ padding: 18 }}>
      <div className="gc-panel">
        <div className="gc-runnerDetailHeader">
          <img className="gc-runnerDetailAvatar" src={pickAvatar(runner)} alt={runner.name || "Runner"} />
          <div>
            <h2 className="gc-pageTitle">{runner.name || "Runner"}</h2>
            <div className="gc-muted" style={{ marginTop: 4 }}>
              {renderStars(ratingAvg)} {formatRating(ratingAvg)} ({ratingCount})
            </div>
            <div className="gc-muted">
              {runner.runnerId} - {runner.type === "independent" ? "Independent" : "GoCrave"} -{" "}
              {runner.status || "active"}
            </div>
          </div>
        </div>

        <div className="gc-formGrid" style={{ marginTop: 12 }}>
          <input
            className="gc-input"
            value={`Rating: ${formatRating(ratingAvg)} (${ratingCount})`}
            readOnly
          />
          <input
            className="gc-input"
            value={`Last active: ${formatTime(runner.lastActiveAt)}`}
            readOnly
          />
          <input className="gc-input" value={`Phone: ${runner.phone || "-"}`} readOnly />
          <input className="gc-input" value={`Address: ${runner.address || "-"}`} readOnly />
        </div>

        <div className="gc-inlineActions" style={{ marginTop: 16 }}>
          <button className="gc-miniBtn" type="button" onClick={() => navigate("/customer/runners")}>
            Back
          </button>
          <button
            className="gc-btn"
            type="button"
            onClick={() => {
              setRunner({ id: runner.runnerId, name: runner.name || "Runner" });
              navigate("/customer/restaurants");
            }}
          >
            Place Order
          </button>
        </div>
      </div>
    </div>
  );
}
