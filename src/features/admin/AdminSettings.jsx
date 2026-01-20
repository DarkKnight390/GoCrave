import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "../../store/useAuthStore";
import { get, ref, update } from "firebase/database";
import { rtdb } from "../../services/firebase";
import { auth } from "../../services/firebase";
import {
  addRunnerWarning,
  backfillRunnerIndex,
  listenAllRunners,
  listenRunnerComplaints,
  listenRunnerMetrics,
  listenRunnerRatings,
  listenRunnerWarnings,
  updateRunnerCore,
} from "../../services/runnerAdmin.service";

const money = (n) =>
  new Intl.NumberFormat("en-JM", { style: "currency", currency: "JMD" }).format(n || 0);

export default function AdminSettings() {
  const user = useAuthStore((s) => s.user);
  const [runners, setRunners] = useState([]);
  const [selectedRunnerId, setSelectedRunnerId] = useState("");
  const [metrics, setMetrics] = useState({});
  const [complaints, setComplaints] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [indexMsg, setIndexMsg] = useState("");
  const [runnerPayout, setRunnerPayout] = useState("");
  const [savingPayout, setSavingPayout] = useState(false);

  const [warningReason, setWarningReason] = useState("");
  const [warningAction, setWarningAction] = useState("flag");
  const [testUid, setTestUid] = useState("");
  const [testMsg, setTestMsg] = useState("");

  useEffect(() => {
    const unsub = listenAllRunners((list) => setRunners(list));
    return () => unsub();
  }, []);

  useEffect(() => {
    get(ref(rtdb, "config/payouts/runnerPerDelivery")).then((snap) => {
      setRunnerPayout(snap.exists() ? String(snap.val()) : "1000");
    });
  }, []);

  useEffect(() => {
    if (!selectedRunnerId) return undefined;
    const unsub = listenRunnerMetrics(selectedRunnerId, setMetrics);
    return () => unsub();
  }, [selectedRunnerId]);

  useEffect(() => {
    if (!selectedRunnerId) return undefined;
    const unsub = listenRunnerComplaints(selectedRunnerId, setComplaints);
    return () => unsub();
  }, [selectedRunnerId]);

  useEffect(() => {
    if (!selectedRunnerId) return undefined;
    const unsub = listenRunnerRatings(selectedRunnerId, setRatings);
    return () => unsub();
  }, [selectedRunnerId]);

  useEffect(() => {
    if (!selectedRunnerId) return undefined;
    const unsub = listenRunnerWarnings(selectedRunnerId, setWarnings);
    return () => unsub();
  }, [selectedRunnerId]);

  const selectedRunner = useMemo(
    () => runners.find((r) => r.runnerId === selectedRunnerId),
    [runners, selectedRunnerId]
  );

  const updateStatus = (status) => {
    if (!selectedRunnerId) return;
    updateRunnerCore(selectedRunnerId, { status });
  };

  const updateVerification = (verificationStatus) => {
    if (!selectedRunnerId) return;
    updateRunnerCore(selectedRunnerId, { verificationStatus });
  };

  const updateType = (type) => {
    if (!selectedRunnerId) return;
    updateRunnerCore(selectedRunnerId, { type });
  };

  const submitWarning = async () => {
    if (!selectedRunner) return;
    await addRunnerWarning({
      runnerId: selectedRunner.runnerId,
      reason: warningReason,
      action: warningAction,
      createdByAdminId: user?.uid,
      currentWarnings: selectedRunner.warningsCount || 0,
    });
    if (warningAction === "suspend") {
      await updateRunnerCore(selectedRunner.runnerId, { status: "suspended" });
    }
    setWarningReason("");
    setWarningAction("flag");
  };

  const runBackfill = async () => {
    setIndexMsg("");
    try {
      const updated = await backfillRunnerIndex();
      setIndexMsg(updated > 0 ? `Backfilled ${updated} runner index entries.` : "No entries updated.");
    } catch (err) {
      setIndexMsg(err?.message || "Backfill failed.");
    }
  };

  const onSavePayout = async () => {
    setSavingPayout(true);
    try {
      const val = Number(runnerPayout);
      if (!Number.isFinite(val) || val <= 0) {
        setIndexMsg("Enter a valid payout amount.");
        return;
      }
      await update(ref(rtdb, "config/payouts"), {
        runnerPerDelivery: val,
        updatedAt: Date.now(),
      });
      setIndexMsg("OK Runner payout updated.");
    } finally {
      setSavingPayout(false);
    }
  };

  const onSendTestPush = async () => {
    setTestMsg("");
    try {
      const uid = testUid.trim();
      if (!uid) {
        setTestMsg("Enter a user UID.");
        return;
      }
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setTestMsg("Not logged in.");
        return;
      }
      const res = await fetch("http://localhost:8080/api/admin/push-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUid: uid }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setTestMsg(data?.error || "Failed to send.");
        return;
      }
      setTestMsg("OK Test push sent.");
    } catch (err) {
      setTestMsg(err?.message || "Failed to send.");
    }
  };

  return (
    <div className="gc-adminDashboard">
      <div className="gc-adminCard">
        <div className="gc-adminCardHeader">
          <div>
            <div className="gc-adminCardTitle">Runner Control</div>
            <div className="gc-adminCardSub">
              Activate, suspend, and review runner performance.
            </div>
          </div>
          <div className="gc-inlineActions">
            <select
              className="gc-select"
              value={selectedRunnerId}
              onChange={(e) => setSelectedRunnerId(e.target.value)}
            >
              <option value="">Select runner</option>
              {runners.map((runner) => (
                <option key={runner.runnerId} value={runner.runnerId}>
                  {runner.name || "Runner"} ({runner.runnerId})
                </option>
              ))}
            </select>
            <button className="gc-miniBtn" type="button" onClick={runBackfill}>
              Fix runner index
            </button>
          </div>
        </div>
        {indexMsg ? <p className="gc-muted">{indexMsg}</p> : null}

        {!selectedRunner ? (
          <p className="gc-muted">Select a runner to view details.</p>
        ) : (
          <>
            <div className="gc-adminSection">
              <h3 className="gc-panelTitle">Account status</h3>
              <div className="gc-inlineActions">
                <button className="gc-adminPrimary" type="button" onClick={() => updateStatus("active")}>
                  Activate
                </button>
                <button className="gc-miniBtn" type="button" onClick={() => updateStatus("suspended")}>
                  Suspend
                </button>
                <button className="gc-dangerBtn" type="button" onClick={() => updateStatus("inactive")}>
                  Deactivate
                </button>
              </div>
            </div>

            <div className="gc-adminSection">
              <h3 className="gc-panelTitle">Runner profile</h3>
              <div className="gc-formGrid">
                <input className="gc-input" value={selectedRunner.name || ""} readOnly />
                <input className="gc-input" value={selectedRunner.phone || ""} readOnly />
                <input className="gc-input" value={selectedRunner.address || ""} readOnly />
                <select
                  className="gc-input"
                  value={selectedRunner.type || "company"}
                  onChange={(e) => updateType(e.target.value)}
                >
                  <option value="company">Company</option>
                  <option value="independent">Independent</option>
                </select>
                <select
                  className="gc-input"
                  value={selectedRunner.verificationStatus || "pending"}
                  onChange={(e) => updateVerification(e.target.value)}
                >
                  <option value="pending">Pending</option>
                  <option value="verified">Verified</option>
                  <option value="rejected">Rejected</option>
                </select>
                <input
                  className="gc-input"
                  value={`Warnings: ${selectedRunner.warningsCount || 0}`}
                  readOnly
                />
                <input
                  className="gc-input"
                  value={`Rating: ${selectedRunner.ratingAvg || 0} (${selectedRunner.ratingCount || 0})`}
                  readOnly
                />
              </div>
            </div>

            <div className="gc-adminSection">
              <h3 className="gc-panelTitle">Analytics</h3>
              <div className="gc-formGrid">
                <input
                  className="gc-input"
                  value={`Deliveries: ${metrics.deliveriesCount || 0}`}
                  readOnly
                />
                <input
                  className="gc-input"
                  value={`Total earned: ${money(metrics.totalEarnings)}`}
                  readOnly
                />
                <input
                  className="gc-input"
                  value={`Last active: ${metrics.lastActiveAt || selectedRunner.lastActiveAt || "-"}`}
                  readOnly
                />
                <input
                  className="gc-input"
                  value={`Last on route: ${metrics.lastOnRouteAt || "-"}`}
                  readOnly
                />
                <input
                  className="gc-input"
                  value={`Last offline: ${metrics.lastOfflineAt || "-"}`}
                  readOnly
                />
              </div>
            </div>

            <div className="gc-adminSection">
              <h3 className="gc-panelTitle">Runner payout</h3>
              <div className="gc-formGrid">
                <input
                  className="gc-input"
                  placeholder="Runner payout (JMD)"
                  value={runnerPayout}
                  onChange={(e) => setRunnerPayout(e.target.value)}
                />
                <button className="gc-adminPrimary" type="button" onClick={onSavePayout}>
                  {savingPayout ? "Saving..." : "Save payout"}
                </button>
              </div>
            </div>

            <div className="gc-adminSection">
              <h3 className="gc-panelTitle">Push test</h3>
              <div className="gc-formGrid">
                <input
                  className="gc-input"
                  placeholder="Target UID"
                  value={testUid}
                  onChange={(e) => setTestUid(e.target.value)}
                />
                <button className="gc-adminPrimary" type="button" onClick={onSendTestPush}>
                  Send test push
                </button>
              </div>
              {testMsg ? <p className="gc-muted">{testMsg}</p> : null}
            </div>

            <div className="gc-adminSection">
              <h3 className="gc-panelTitle">Warnings</h3>
              <div className="gc-formGrid">
                <input
                  className="gc-input"
                  placeholder="Reason"
                  value={warningReason}
                  onChange={(e) => setWarningReason(e.target.value)}
                />
                <select
                  className="gc-input"
                  value={warningAction}
                  onChange={(e) => setWarningAction(e.target.value)}
                >
                  <option value="flag">Flag</option>
                  <option value="suspend">Suspend</option>
                </select>
                <button className="gc-adminPrimary" type="button" onClick={submitWarning}>
                  Issue warning
                </button>
              </div>
              {warnings.length === 0 ? (
                <p className="gc-muted">No warnings.</p>
              ) : (
                warnings
                  .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
                  .map((w) => (
                    <div key={w.createdAt} className="gc-menuItem">
                      <div>
                        <div className="gc-menuName">{w.action}</div>
                        <div className="gc-muted" style={{ fontSize: 12 }}>
                          {w.reason} - {new Date(w.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>

            <div className="gc-adminSection">
              <h3 className="gc-panelTitle">Complaints</h3>
              {complaints.length === 0 ? (
                <p className="gc-muted">No complaints.</p>
              ) : (
                complaints.map((c) => (
                  <div key={c.createdAt} className="gc-menuItem">
                    <div>
                      <div className="gc-menuName">{c.reason}</div>
                      <div className="gc-muted" style={{ fontSize: 12 }}>
                        Order: {c.orderId || "-"} - {c.status || "open"}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="gc-adminSection">
              <h3 className="gc-panelTitle">Ratings</h3>
              {ratings.length === 0 ? (
                <p className="gc-muted">No ratings.</p>
              ) : (
                ratings.map((r) => (
                  <div key={r.createdAt} className="gc-menuItem">
                    <div>
                      <div className="gc-menuName">{r.stars} stars</div>
                      <div className="gc-muted" style={{ fontSize: 12 }}>
                        Order: {r.orderId || "-"} - {new Date(r.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="gc-adminSection">
              <h3 className="gc-panelTitle">GEO location and range (future)</h3>
              <p className="gc-muted">
                Map controls and delivery radius will appear here.
              </p>
            </div>
          </>
        )}
       </div>
     </div>
   );
 }
