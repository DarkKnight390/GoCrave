import { useEffect, useMemo, useState } from "react";
import SettingsModal from "../../components/SettingsModal";
import { useAuthStore } from "../../store/useAuthStore";
import { getRunnerIdByUid, listenRunnerCore, listenRunnerMetrics } from "../../services/runners.service";

export default function RunnerProfile() {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const [runnerId, setRunnerId] = useState(null);
  const [runnerCore, setRunnerCore] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
    const unsub = listenRunnerCore(runnerId, setRunnerCore);
    return () => unsub?.();
  }, [runnerId]);

  useEffect(() => {
    if (!runnerId) return () => {};
    const unsub = listenRunnerMetrics(runnerId, setMetrics);
    return () => unsub?.();
  }, [runnerId]);

  const info = useMemo(
    () => ({
      name: profile?.name || runnerCore?.name || "Runner",
      status: runnerCore?.status || "active",
      type: runnerCore?.type || "company",
      runnerId: runnerId || "-",
      phone: runnerCore?.phone || "-",
      ratingAvg:
        metrics?.ratingAvg != null ? metrics.ratingAvg : runnerCore?.ratingAvg || 0,
      ratingCount:
        metrics?.ratingCount != null ? metrics.ratingCount : runnerCore?.ratingCount || 0,
    }),
    [profile?.name, runnerCore, runnerId, metrics]
  );

  return (
    <div className="gc-page">
      <div className="gc-topbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="gc-pill">Profile</div>
          <h2 className="gc-pageTitle">Runner profile</h2>
          <p className="gc-muted">Account status and identity.</p>
        </div>
        <div>
          <button
            aria-label="Open settings"
            onClick={() => setSettingsOpen(true)}
            style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer" }}
            title="Settings"
          >
            ⚙️
          </button>
        </div>
      </div>

      <div className="gc-panel" style={{ marginTop: 12 }}>
        <div className="gc-infoRow">
          <span className="gc-infoKey">Name</span>
          <span className="gc-infoVal">{info.name}</span>
        </div>
        <div className="gc-infoRow">
          <span className="gc-infoKey">Runner ID</span>
          <span className="gc-infoVal">{info.runnerId}</span>
        </div>
        <div className="gc-infoRow">
          <span className="gc-infoKey">Type</span>
          <span className="gc-infoVal">{info.type === "company" ? "GoCrave" : "Independent"}</span>
        </div>
        <div className="gc-infoRow">
          <span className="gc-infoKey">Status</span>
          <span className="gc-infoVal">{info.status}</span>
        </div>
        <div className="gc-infoRow">
          <span className="gc-infoKey">Phone</span>
          <span className="gc-infoVal">{info.phone}</span>
        </div>
        <div className="gc-infoRow">
          <span className="gc-infoKey">Rating</span>
          <span className="gc-infoVal">
            {info.ratingAvg} ({info.ratingCount})
          </span>
        </div>
      </div>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
