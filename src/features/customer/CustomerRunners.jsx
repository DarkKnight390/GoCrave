import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onValue, ref } from "firebase/database";
import { listenAllRunners } from "../../services/runnerAdmin.service";
import { rtdb } from "../../services/firebase";
import runner1 from "../../assets/avatars/runner1.jpg";
import runner2 from "../../assets/avatars/runner2.jpg";
import runner3 from "../../assets/avatars/runner3.jpg";
import runner4 from "../../assets/avatars/runner4.jpg";
import runner5 from "../../assets/avatars/runner5.jpg";
import { useCartStore } from "../../store/useCartStore";

const formatTime = (value) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch (e) {
    return "-";
  }
};

const avatars = [runner1, runner2, runner3, runner4, runner5];

const pickAvatar = (runner) => {
  const key = `${runner.runnerId || ""}${runner.name || ""}`;
  if (!key) return avatars[0];
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) % 100000;
  }
  return avatars[Math.abs(hash) % avatars.length];
};

const renderStars = (avg) => {
  const val = Number(avg || 0);
  const full = Math.round(val);
  return "★★★★★".slice(0, full) + "☆☆☆☆☆".slice(0, 5 - full);
};

const formatRating = (avg) => Number(avg || 0).toFixed(1);
const runnerKey = (id) => String(id || "").trim().toUpperCase();

export default function CustomerRunners() {
  const navigate = useNavigate();
  const [runners, setRunners] = useState([]);
  const [metricsMap, setMetricsMap] = useState({});
  const [metricsError, setMetricsError] = useState("");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [activeRunner, setActiveRunner] = useState(null);
  const setRunner = useCartStore((s) => s.setRunner);

  useEffect(() => {
    const unsub = listenAllRunners((list) => setRunners(list));
    return () => unsub();
  }, []);

  useEffect(() => {
    const metricsRef = ref(rtdb, "runnerMetrics");
    const unsub = onValue(
      metricsRef,
      (snap) => {
        const data = snap.val() || {};
        setMetricsMap(data);
        setMetricsError("");
        window.__metrics = data;
        window.__dbUrl = rtdb.app.options.databaseURL;
      },
      (err) => {
        setMetricsError(err?.message || "Failed to load ratings.");
        window.__metricsError = err?.message || "Failed to load ratings.";
        window.__dbUrl = rtdb.app.options.databaseURL;
        console.error("runnerMetrics read failed:", err);
      }
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return runners
      .filter((runner) => {
        if (statusFilter !== "all" && runner.status !== statusFilter) return false;
        if (typeFilter !== "all") {
          const type = runner.type || runner.runnerType;
          if (type !== typeFilter) return false;
        }
        if (!q) return true;
        return (
          (runner.name || "").toLowerCase().includes(q) ||
          (runner.runnerId || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const aKey = runnerKey(a.runnerId);
        const bKey = runnerKey(b.runnerId);
        const aRating = metricsMap[aKey]?.ratingAvg ?? a.ratingAvg ?? 0;
        const bRating = metricsMap[bKey]?.ratingAvg ?? b.ratingAvg ?? 0;
        return bRating - aRating;
      });
  }, [query, runners, statusFilter, typeFilter, metricsMap]);

  return (
    <div className="gc-page" style={{ padding: 18 }}>
      <div className="gc-restHeader">
        <div>
          <div className="gc-pill">Customer Runners</div>
          <h2 className="gc-pageTitle">Find a runner</h2>
          <p className="gc-muted">Browse active runners and see their ratings.</p>
        </div>
      </div>

      <div className="gc-panel" style={{ marginBottom: 12 }}>
        <div className="gc-formGrid">
          <input
            className="gc-input"
            placeholder="Search by name or ID"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className="gc-input"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">All types</option>
            <option value="company">GoCrave</option>
            <option value="independent">Independent</option>
          </select>
          <select
            className="gc-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="active">Active only</option>
            <option value="all">All statuses</option>
            <option value="suspended">Suspended</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div className="gc-panel">
        <h3 className="gc-panelTitle">Available runners</h3>

        {filtered.length === 0 ? (
          <p className="gc-muted">No runners match your search.</p>
        ) : (
          <div className="gc-runnerGrid">
            {filtered.map((runner) => {
              const key = runnerKey(runner.runnerId);
              const ratingAvg = metricsMap[key]?.ratingAvg ?? runner.ratingAvg ?? 0;
              const ratingCount =
                metricsMap[key]?.ratingCount ?? runner.ratingCount ?? 0;
              return (
                <div
                  key={runner.runnerId}
                  className="gc-runnerCard isClickable"
                  onClick={() => setActiveRunner(runner)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setActiveRunner(runner);
                  }}
                >
                  <div className="gc-runnerBadge">
                    {runner.status === "active" ? "Available" : "Unavailable"}
                  </div>
                  <div className="gc-runnerHeader">
                    <img
                      className="gc-runnerAvatar"
                      src={pickAvatar(runner)}
                      alt={runner.name || "Runner"}
                    />
                    <div>
                      <div className="gc-runnerName">{runner.name || "Runner"}</div>
                      <div className="gc-runnerMeta">{runner.runnerId}</div>
                    </div>
                  </div>
                  <div className="gc-runnerMeta">
                    {runner.type === "independent" ? "Independent" : "GoCrave"} -{" "}
                    {runner.status || "active"}
                  </div>
                  <div className="gc-runnerStats">
                    <span>
                      {renderStars(ratingAvg)} {formatRating(ratingAvg)} ({ratingCount})
                    </span>
                    <span>Last active: {formatTime(runner.lastActiveAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {metricsError ? (
          <p className="gc-muted" style={{ marginTop: 8 }}>
            Ratings unavailable: {metricsError}
          </p>
        ) : null}
      </div>

      {activeRunner && (
        <div className="gc-modalOverlay" role="presentation" onClick={() => setActiveRunner(null)}>
          <div
            className="gc-modalCard"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="gc-runnerDetailHeader">
              <img
                className="gc-runnerDetailAvatar"
                src={pickAvatar(activeRunner)}
                alt={activeRunner.name || "Runner"}
              />
              <div>
                <h2 className="gc-pageTitle">{activeRunner.name || "Runner"}</h2>
                <div className="gc-muted" style={{ marginTop: 4 }}>
                  {renderStars(
                    metricsMap[runnerKey(activeRunner.runnerId)]?.ratingAvg ??
                      activeRunner.ratingAvg ??
                      0
                  )}{" "}
                  {formatRating(
                    metricsMap[runnerKey(activeRunner.runnerId)]?.ratingAvg ??
                      activeRunner.ratingAvg ??
                      0
                  )}{" "}
                  (
                  {metricsMap[runnerKey(activeRunner.runnerId)]?.ratingCount ??
                    activeRunner.ratingCount ??
                    0}
                  )
                </div>
                <div className="gc-muted">
                  {activeRunner.runnerId} -{" "}
                  {activeRunner.type === "independent" ? "Independent" : "GoCrave"} -{" "}
                  {activeRunner.status || "active"}
                </div>
              </div>
            </div>

            <div className="gc-formGrid" style={{ marginTop: 12 }}>
              <input
                className="gc-input"
                value={`Rating: ${formatRating(
                  metricsMap[runnerKey(activeRunner.runnerId)]?.ratingAvg ??
                    activeRunner.ratingAvg ??
                    0
                )} (${
                  metricsMap[runnerKey(activeRunner.runnerId)]?.ratingCount ??
                  activeRunner.ratingCount ??
                  0
                })`}
                readOnly
              />
              <input
                className="gc-input"
                value={`Last active: ${formatTime(activeRunner.lastActiveAt)}`}
                readOnly
              />
              <input
                className="gc-input"
                value={`Phone: ${activeRunner.phone || "-"}`}
                readOnly
              />
              <input
                className="gc-input"
                value={`Address: ${activeRunner.address || "-"}`}
                readOnly
              />
            </div>

            <div className="gc-inlineActions" style={{ marginTop: 16 }}>
              <button className="gc-miniBtn" type="button" onClick={() => setActiveRunner(null)}>
                Close
              </button>
              <button
                className="gc-chatBtn"
                type="button"
                onClick={() => {
                  setRunner({
                    id: activeRunner.runnerId,
                    name: activeRunner.name || "Runner",
                  });
                  setActiveRunner(null);
                  navigate(`/customer/chat/runner_${activeRunner.runnerId}`);
                }}
              >
                Message
              </button>
              <button
                className="gc-btn"
                type="button"
                onClick={() => {
                  setRunner({
                    id: activeRunner.runnerId,
                    name: activeRunner.name || "Runner",
                  });
                  setActiveRunner(null);
                  navigate("/customer/restaurants");
                }}
              >
                Place Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
