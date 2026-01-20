import { auth, rtdb } from "./firebase";
import { onValue, push, ref, update, get } from "firebase/database";

const runnersRef = ref(rtdb, "runners");
const adminBaseUrl = import.meta.env.VITE_RUNNER_API_URL || "http://localhost:8080";

const isPlaceholderRunner = (runner) => {
  if (!runner || typeof runner !== "object") return true;
  const name = String(runner.name || "").trim();
  const authUid = String(runner.authUid || "").trim();
  const phone = String(runner.phone || "").trim();
  const email = String(runner.loginEmail || runner.email || "").trim();
  if (!name && !authUid && !phone && !email) return true;
  if (name.toLowerCase() === "runner" && !authUid) return true;
  return false;
};

export const listenAllRunners = (cb) =>
  onValue(runnersRef, (snap) => {
    const val = snap.val() || {};
    const list = [];
    const seen = new Set();

    const addRunner = (runner, fallbackId) => {
      if (!runner || typeof runner !== "object") return;
      const runnerId = runner.runnerId || fallbackId;
      if (!runnerId || seen.has(runnerId)) return;
      if (isPlaceholderRunner(runner)) return;
      seen.add(runnerId);
      list.push({ ...runner, runnerId });
    };

    if (val.goCrave || val.independent) {
      Object.entries(val.goCrave || {}).forEach(([id, runner]) => {
        addRunner({ ...runner, type: runner.type || "company" }, id);
      });
      Object.entries(val.independent || {}).forEach(([id, runner]) => {
        addRunner({ ...runner, type: runner.type || "independent" }, id);
      });
    }

    Object.entries(val).forEach(([id, runner]) => {
      if (id === "goCrave" || id === "independent") return;
      addRunner(runner, id);
    });

    cb(list);
  });

export const listenRunnerMetrics = (runnerId, cb) =>
  onValue(ref(rtdb, `runnerMetrics/${runnerId}`), (snap) => cb(snap.val() || {}));

export const listenRunnerComplaints = (runnerId, cb) =>
  onValue(ref(rtdb, `runnerComplaints/${runnerId}`), (snap) => {
    const val = snap.val() || {};
    cb(Object.values(val));
  });

export const listenRunnerRatings = (runnerId, cb) =>
  onValue(ref(rtdb, `runnerRatings/${runnerId}`), (snap) => {
    const val = snap.val() || {};
    cb(Object.values(val));
  });

export const listenRunnerWarnings = (runnerId, cb) =>
  onValue(ref(rtdb, `runnerWarnings/${runnerId}`), (snap) => {
    const val = snap.val() || {};
    cb(Object.values(val));
  });

export const updateRunnerCore = async (runnerId, patch) => {
  if (!runnerId) throw new Error("Missing runner id");
  await update(ref(rtdb, `runners/${runnerId}`), patch);
};

export const backfillRunnerIndex = async () => {
  const snap = await get(ref(rtdb, "runners"));
  if (!snap.exists()) return 0;
  const val = snap.val() || {};
  const updates = {};
  let count = 0;

  const add = (runner, runnerId) => {
    if (!runnerId || !runner?.authUid) return;
    updates[`runnerIndex/byUid/${runner.authUid}`] = runnerId;
    count += 1;
  };

  if (val.goCrave || val.independent) {
    Object.entries(val.goCrave || {}).forEach(([id, runner]) => add(runner, id));
    Object.entries(val.independent || {}).forEach(([id, runner]) => add(runner, id));
  }

  Object.entries(val).forEach(([id, runner]) => {
    if (id === "goCrave" || id === "independent") return;
    add(runner, id);
  });

  if (count > 0) {
    await update(ref(rtdb), updates);
  }
  return count;
};

export const addRunnerWarning = async ({
  runnerId,
  reason,
  action,
  createdByAdminId,
  currentWarnings,
}) => {
  if (!runnerId) throw new Error("Missing runner id");
  const warningsRef = ref(rtdb, `runnerWarnings/${runnerId}`);
  const newRef = push(warningsRef);
  await update(newRef, {
    reason: reason || "",
    action: action || "flag",
    createdByAdminId: createdByAdminId || "admin",
    createdAt: Date.now(),
  });

  const runnerRef = ref(rtdb, `runners/${runnerId}`);
  await update(runnerRef, { warningsCount: Number(currentWarnings || 0) + 1 });
};

export const deleteRunnerAdmin = async (runnerId) => {
  if (!runnerId) throw new Error("Missing runner id");
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");

  const token = await user.getIdToken();
  const res = await fetch(`${adminBaseUrl}/api/admin/delete-runner`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ runnerId }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || "Failed to delete runner");
  }

  return res.json();
};
