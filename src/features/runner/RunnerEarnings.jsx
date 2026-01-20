import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "../../store/useAuthStore";
import { getRunnerIdByUid, listenRunnerMetrics } from "../../services/runners.service";

const money = (n) =>
  new Intl.NumberFormat("en-JM", { style: "currency", currency: "JMD" }).format(n || 0);

export default function RunnerEarnings() {
  const user = useAuthStore((s) => s.user);
  const [runnerId, setRunnerId] = useState(null);
  const [metrics, setMetrics] = useState({});

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
    const unsub = listenRunnerMetrics(runnerId, setMetrics);
    return () => unsub?.();
  }, [runnerId]);

  const summary = useMemo(
    () => ({
      total: Number(metrics.totalEarnings || 0),
      deliveries: Number(metrics.deliveriesCount || 0),
    }),
    [metrics]
  );

  return (
    <div className="gc-page">
      <div className="gc-topbar">
        <div>
          <div className="gc-pill">Earnings</div>
          <h2 className="gc-pageTitle">Your payout</h2>
          <p className="gc-muted">Live totals update after each delivery.</p>
        </div>
      </div>

      <div className="gc-panel" style={{ marginTop: 12 }}>
        <div className="gc-summaryLine">
          <span>Total earned</span>
          <span>{money(summary.total)}</span>
        </div>
        <div className="gc-summaryLine">
          <span>Deliveries</span>
          <span>{summary.deliveries}</span>
        </div>
      </div>
    </div>
  );
}
