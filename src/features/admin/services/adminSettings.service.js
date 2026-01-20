import { getDatabase, ref, onValue, set, update } from "firebase/database";
import firebaseApp from "../../../../src/services/firebase";

const db = getDatabase(firebaseApp);
const ROOT = "/admin/settings";
const META_ROOT = "/admin/settings_meta";
const AUDIT_ROOT = "/admin/audit_log/settings";

function subscribeSettings(callback) {
  const r = ref(db, ROOT);
  const unsub = onValue(r, (snap) => {
    callback(snap.val());
  });
  // onValue returns an unsub function in modern SDK only if using onValue with ref API.
  // For compatibility, return a wrapper
  return () => r.off && r.off();
}

async function getSettings() {
  const r = ref(db, ROOT);
  return new Promise((resolve, reject) => {
    onValue(
      r,
      (snap) => {
        resolve(snap.val());
      },
      { onlyOnce: true },
      (err) => reject(err)
    );
  });
}

async function saveSettings(patch = {}) {
  // Patch is expected to be {namespace: {key: value}}
  const updates = {};
  const timestamp = Date.now();
  Object.keys(patch).forEach((namespace) => {
    Object.keys(patch[namespace]).forEach((key) => {
      const path = `${ROOT}/${namespace}/${key}`;
      updates[path] = patch[namespace][key];
      updates[`${META_ROOT}/${namespace}/${key}`] = {
        lastUpdatedAt: timestamp,
        lastUpdatedBy: "admin-ui", // client should include uid in future
      };
    });
  });
  await update(ref(db), updates);
  // Append a simple audit record
  const auditPath = `${AUDIT_ROOT}/${timestamp}`;
  await set(ref(db, auditPath), {
    patch,
    timestamp,
    user: "admin-ui",
  });
}

async function resetDefaults() {
  // For simplicity, reset to hardcoded defaults. In production, read defaults from a canonical file.
  const defaults = {
    general: {
      companyName: "GoCrave",
      supportEmail: "support@gocrave.app",
    },
    branding: {
      primaryColor: "#3b82f6",
    },
    security: {
      maintenanceMode: false,
      sessionTimeoutMinutes: 30,
    },
    payments: {
      currency: "NGN",
      defaultDeliveryFee: 200,
    },
  };
  const timestamp = Date.now();
  await set(ref(db, ROOT), defaults);
  await set(ref(db, `${META_ROOT}/schemaVersion`), { version: 1, updatedAt: timestamp });
  const auditPath = `${AUDIT_ROOT}/${timestamp}`;
  await set(ref(db, auditPath), {
    reset: true,
    defaults,
    timestamp,
    user: "admin-ui",
  });
}

export default {
  subscribeSettings,
  getSettings,
  saveSettings,
  resetDefaults,
};
