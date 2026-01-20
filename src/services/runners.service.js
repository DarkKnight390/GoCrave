import { rtdb } from "./firebase";
import { get, onValue, ref, remove, update } from "firebase/database";

const runnerPath = (type, runnerId) =>
  ref(rtdb, `runners/${type}/${runnerId}`);

const goCraveRef = ref(rtdb, "runners/goCrave");
const independentRef = ref(rtdb, "runners/independent");
const subscriptionsRef = ref(rtdb, "subscriptions");
const runnersCoreRef = ref(rtdb, "runners");
const runnerCheckinsRef = ref(rtdb, "runnerCheckins");

export const listenRunners = (callback) => {
  let goCrave = {};
  let independent = {};

  const emit = () => {
    const list = [
      ...Object.values(goCrave).map((r) => ({ ...r, runnerType: "goCrave" })),
      ...Object.values(independent).map((r) => ({ ...r, runnerType: "independent" })),
    ];
    callback(list);
  };

  const unsubGo = onValue(goCraveRef, (snap) => {
    goCrave = snap.val() || {};
    emit();
  });

  const unsubInd = onValue(independentRef, (snap) => {
    independent = snap.val() || {};
    emit();
  });

  return () => {
    unsubGo();
    unsubInd();
  };
};

export const listenSubscriptions = (callback) =>
  onValue(subscriptionsRef, (snap) => {
    callback(snap.val() || {});
  });

export const listenRunnersCoreAll = (callback) =>
  onValue(runnersCoreRef, (snap) => {
    callback(snap.val() || {});
  });

export const listenRunnerCheckins = (callback) =>
  onValue(runnerCheckinsRef, (snap) => {
    callback(snap.val() || {});
  });

export const listenRunnerCore = (runnerId, cb) => {
  if (!runnerId) {
    cb(null);
    return () => {};
  }
  return onValue(ref(rtdb, `runners/${runnerId}`), (snap) => {
    cb(snap.exists() ? snap.val() : null);
  });
};

export const updateRunnerCore = async (runnerId, patch) => {
  if (!runnerId) throw new Error("Missing runner id");
  await update(ref(rtdb, `runners/${runnerId}`), patch);
};

export const listenRunnerMetrics = (runnerId, cb) => {
  if (!runnerId) {
    cb(null);
    return () => {};
  }
  return onValue(ref(rtdb, `runnerMetrics/${runnerId}`), (snap) => {
    cb(snap.exists() ? snap.val() : null);
  });
};

export const listenRunnerMetricsAll = (callback) =>
  onValue(ref(rtdb, "runnerMetrics"), (snap) => {
    callback(snap.val() || {});
  });

export const setRunnerAvailability = async (runnerId, availability) => {
  if (!runnerId) throw new Error("Missing runner id");
  const now = Date.now();
  const runnerRef = ref(rtdb, `runners/${runnerId}`);

  if (availability === "online") {
    const sessionId = String(now);
    await update(runnerRef, {
      availability,
      lastActiveAt: now,
      attendanceSessionId: sessionId,
      attendanceSessionStartAt: now,
    });

    await update(ref(rtdb, `runnerCheckins/${runnerId}`), {
      [sessionId]: {
        runnerId,
        checkinAt: now,
        startAt: now,
        endAt: 0,
        minutes: 0,
        status: "online",
      },
    });
    return;
  }

  const snap = await get(runnerRef);
  const runner = snap.exists() ? snap.val() : {};
  const sessionId = runner?.attendanceSessionId;
  const startAt = Number(runner?.attendanceSessionStartAt || 0);
  const minutes = startAt ? Math.max(0, Math.round((now - startAt) / 60000)) : 0;

  await update(runnerRef, {
    availability,
    lastActiveAt: now,
    attendanceSessionId: null,
    attendanceSessionStartAt: 0,
  });

  if (sessionId) {
    await update(ref(rtdb, `runnerCheckins/${runnerId}/${sessionId}`), {
      endAt: now,
      minutes,
      status: "offline",
    });
  }
};

export const recordRunnerDelivery = async (runnerId, amountJMD = 0) => {
  if (!runnerId) throw new Error("Missing runner id");
  const metricsRef = ref(rtdb, `runnerMetrics/${runnerId}`);
  const snap = await get(metricsRef);
  const current = snap.exists() ? snap.val() : {};
  const deliveriesCount = Number(current.deliveriesCount || 0) + 1;
  const totalEarnings = Number(current.totalEarnings || 0) + Number(amountJMD || 0);

  await update(metricsRef, {
    deliveriesCount,
    totalEarnings,
    lastOnRouteAt: Date.now(),
  });
};

export const isRunnerIdAvailable = async (runnerId) => {
  if (!runnerId) return false;
  const snap = await get(ref(rtdb, `runnerIndex/byRunnerId/${runnerId}`));
  if (!snap.exists()) return true;
  const val = snap.val();
  return val?.type === "reserved";
};

export const reserveRunnerId = async (runnerId, adminUid) => {
  if (!runnerId) throw new Error("Missing runner id");
  const refPath = ref(rtdb, `runnerIndex/byRunnerId/${runnerId}`);
  const snap = await get(refPath);
  if (snap.exists()) return false;
  await update(refPath, {
    uid: "reserved",
    type: "reserved",
    reservedBy: adminUid || "admin",
    reservedAt: Date.now(),
  });
  return true;
};

export const isPhoneAvailable = async (phoneE164) => {
  if (!phoneE164) return false;
  const snap = await get(ref(rtdb, `runnerIndex/byPhone/${phoneE164}`));
  return !snap.exists();
};

export const getRunnerIdByUid = async (uid, email) => {
  if (!uid) return null;
  const snap = await get(ref(rtdb, `runnerIndex/byUid/${uid}`));
  if (snap.exists()) return snap.val();

  const runnersSnap = await get(ref(rtdb, "runners"));
  if (!runnersSnap.exists()) return null;
  const val = runnersSnap.val() || {};

  const findByAuthUid = (obj) => {
    if (!obj || typeof obj !== "object") return null;
    return Object.entries(obj).find(([, runner]) => runner?.authUid === uid);
  };

  const findByEmail = (obj) => {
    if (!obj || typeof obj !== "object" || !email) return null;
    const lowered = String(email).toLowerCase();
    return Object.entries(obj).find(([, runner]) => {
      const loginEmail = runner?.loginEmail || runner?.email;
      return loginEmail && String(loginEmail).toLowerCase() === lowered;
    });
  };

  let match = null;
  if (val.goCrave || val.independent) {
    match =
      findByAuthUid(val.goCrave || {}) ||
      findByAuthUid(val.independent || {}) ||
      findByEmail(val.goCrave || {}) ||
      findByEmail(val.independent || {});
  }

  if (!match) {
    match = findByAuthUid(val) || findByEmail(val);
  }

  if (!match) return null;
  const [runnerId] = match;
  await update(ref(rtdb, `runnerIndex/byUid/${uid}`), runnerId);
  return runnerId;
};

export const createRunnerRecord = async ({
  runnerId,
  runnerType,
  authUid,
  loginEmail,
  name,
  dob,
  age,
  address,
  phone,
  trnMasked,
  trnHash,
  idType,
  idMasked,
  idHash,
}) => {
  if (!runnerId || !runnerType || !authUid) {
    throw new Error("Missing runner info");
  }

  const runnerRecord = {
    runnerId,
    runnerType,
    name,
    dob,
    age,
    address,
    phone,
    trnMasked,
    trnHash,
    idType,
    idMasked,
    idHash,
    termsAcceptedAt: Date.now(),
    termsVersion: "v1",
    status: "active",
    createdAt: Date.now(),
    createdBy: authUid,
    authUid,
    loginEmail,
  };

  const basePath =
    runnerType === "independent"
      ? `runners/independent/${runnerId}`
      : `runners/goCrave/${runnerId}`;

  const updates = {};
  updates[basePath] = runnerRecord;
  updates[`runners/${runnerId}`] = {
    runnerId,
    type: runnerType === "independent" ? "independent" : "company",
    status: "active",
    verificationStatus: "pending",
    warningsCount: 0,
    ratingAvg: 0,
    ratingCount: 0,
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
    authUid,
    loginEmail,
    name,
    dob,
    age,
    address,
    phone,
    trnMasked,
    trnHash,
    idType,
    idMasked,
    idHash,
  };
  updates[`runnerMetrics/${runnerId}`] = {
    deliveriesCount: 0,
    totalEarnings: 0,
    lastOnRouteAt: 0,
    lastOfflineAt: 0,
  };
  updates[`runnerIndex/byUid/${authUid}`] = runnerId;
  updates[`runnerIndex/byRunnerId/${runnerId}`] = { type: runnerType, uid: authUid };
  updates[`runnerIndex/byPhone/${phone}`] = runnerId;
  updates[`users/${authUid}`] = {
    uid: authUid,
    name,
    role: "runner",
    email: loginEmail,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  if (runnerType === "independent") {
    updates[`subscriptions/${runnerId}`] = {
      plan: "independent_monthly_5000",
      amountJMD: 5000,
      status: "inactive",
      activeUntil: 0,
      lastPaidAt: 0,
      createdAt: Date.now(),
    };
  }

  await update(ref(rtdb), updates);
};

export const updateRunner = async (runnerType, runnerId, patch) => {
  if (!runnerType || !runnerId) throw new Error("Missing runner info");
  await update(runnerPath(runnerType, runnerId), patch);
};

export const deleteRunnerRecord = async (runner) => {
  if (!runner?.runnerId) throw new Error("Missing runner info");
  const runnerId = runner.runnerId;
  const paths = [
    `runners/goCrave/${runnerId}`,
    `runners/independent/${runnerId}`,
    `runners/${runnerId}`,
    `runnerMetrics/${runnerId}`,
    `runnerCheckins/${runnerId}`,
    `runnerRatings/${runnerId}`,
    `runnerComplaints/${runnerId}`,
    `runnerWarnings/${runnerId}`,
    `subscriptions/${runnerId}`,
    `chatsRunnerIndex/${runnerId}`,
    `runnerIndex/byRunnerId/${runnerId}`,
  ];

  if (runner.authUid) {
    paths.push(`runnerIndex/byUid/${runner.authUid}`);
    paths.push(`users/${runner.authUid}`);
  }
  if (runner.phone) {
    paths.push(`runnerIndex/byPhone/${runner.phone}`);
  }

  await Promise.allSettled(paths.map((path) => remove(ref(rtdb, path))));
};

export const deactivateRunner = async (runnerType, runnerId) => {
  await updateRunner(runnerType, runnerId, { status: "inactive" });
  if (runnerType === "independent") {
    await update(ref(rtdb, `subscriptions/${runnerId}`), {
      status: "inactive",
      activeUntil: 0,
    });
  }
};

export const reactivateRunner = async (runnerType, runnerId) => {
  await updateRunner(runnerType, runnerId, { status: "active" });
};

export const activateSubscription = async (runnerId, days = 30) => {
  const now = Date.now();
  await update(ref(rtdb, `subscriptions/${runnerId}`), {
    status: "active",
    activeUntil: now + days * 24 * 60 * 60 * 1000,
    lastPaidAt: now,
  });

  const paymentRef = ref(rtdb, `subscriptions/${runnerId}/payments`);
  const newPayment = {
    amountJMD: 5000,
    paidAt: now,
    status: "paid",
  };
  await update(paymentRef, { [now]: newPayment });
};

export const addPayment = async (runnerId, amountJMD, paidAt, days = 30) => {
  if (!runnerId) throw new Error("Missing runner id");
  const paidAtMs = Number(paidAt) || Date.now();
  const amount = Number(amountJMD) || 0;
  const paymentRef = ref(rtdb, `subscriptions/${runnerId}/payments`);

  await update(paymentRef, {
    [paidAtMs]: {
      amountJMD: amount,
      paidAt: paidAtMs,
      status: "paid",
    },
  });

  await update(ref(rtdb, `subscriptions/${runnerId}`), {
    status: "active",
    activeUntil: paidAtMs + days * 24 * 60 * 60 * 1000,
    lastPaidAt: paidAtMs,
  });
};
