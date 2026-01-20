const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();

function sha256(str) {
  return crypto.createHash("sha256").update(str).digest("hex");
}

function maskKeepLast(str, last) {
  const s = String(str || "");
  if (s.length <= last) return "*".repeat(s.length);
  return "*".repeat(s.length - last) + s.slice(-last);
}

exports.createRunner = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Login required.");
  }

  const caller = await admin.auth().getUser(context.auth.uid);
  const role = caller.customClaims && caller.customClaims.role;
  if (role !== "admin") {
    throw new functions.https.HttpsError("permission-denied", "Admins only.");
  }

  const required = [
    "name",
    "dob",
    "age",
    "address",
    "trn",
    "idType",
    "idNumber",
    "runnerId",
    "phone",
    "runnerType",
    "loginEmail",
  ];

  for (const k of required) {
    if (!data || !data[k] || String(data[k]).trim() === "") {
      throw new functions.https.HttpsError("invalid-argument", `Missing: ${k}`);
    }
  }

  const runnerType = data.runnerType === "independent" ? "independent" : "goCrave";
  const runnerId = String(data.runnerId).trim().toUpperCase();

  if (!/^GC\d{4,}$/.test(runnerId)) {
    throw new functions.https.HttpsError("invalid-argument", "runnerId must look like GC8373");
  }

  const existingRunnerId = await admin
    .database()
    .ref(`runnerIndex/byRunnerId/${runnerId}`)
    .get();
  if (existingRunnerId.exists()) {
    throw new functions.https.HttpsError("already-exists", "Runner ID already exists.");
  }

  const phoneE164 = String(data.phone).replace(/\s+/g, "");
  const existingPhone = await admin.database().ref(`runnerIndex/byPhone/${phoneE164}`).get();
  if (existingPhone.exists()) {
    throw new functions.https.HttpsError("already-exists", "Phone already linked to another runner.");
  }

  const tempPassword =
    data.tempPassword && String(data.tempPassword).length >= 8
      ? String(data.tempPassword)
      : `GC@${runnerId}${Math.floor(Math.random() * 1000)}`;

  const user = await admin.auth().createUser({
    email: String(data.loginEmail).trim().toLowerCase(),
    password: tempPassword,
    displayName: String(data.name).trim(),
  });

  await admin.auth().setCustomUserClaims(user.uid, {
    role: "runner",
    runnerType,
    runnerId,
  });

  const runnerRecord = {
    runnerId,
    runnerType,
    name: String(data.name).trim(),
    dob: String(data.dob).trim(),
    age: Number(data.age),
    address: String(data.address).trim(),
    phone: phoneE164,
    trnMasked: maskKeepLast(data.trn, 3),
    trnHash: "sha256:" + sha256(String(data.trn).trim()),
    idType: String(data.idType).trim(),
    idMasked: maskKeepLast(data.idNumber, 4),
    idHash: "sha256:" + sha256(String(data.idNumber).trim()),
    termsAcceptedAt: Date.now(),
    termsVersion: "v1",
    status: "active",
    createdAt: Date.now(),
    createdBy: context.auth.uid,
    authUid: user.uid,
    loginEmail: String(data.loginEmail).trim().toLowerCase(),
  };

  const basePath =
    runnerType === "independent"
      ? `runners/independent/${runnerId}`
      : `runners/goCrave/${runnerId}`;

  const updates = {};
  updates[basePath] = runnerRecord;
  updates[`runnerIndex/byUid/${user.uid}`] = runnerId;
  updates[`runnerIndex/byRunnerId/${runnerId}`] = { type: runnerType, uid: user.uid };
  updates[`runnerIndex/byPhone/${phoneE164}`] = runnerId;

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

  await admin.database().ref().update(updates);

  return {
    ok: true,
    runnerId,
    runnerType,
    authUid: user.uid,
    loginEmail: runnerRecord.loginEmail,
    tempPassword,
  };
});
