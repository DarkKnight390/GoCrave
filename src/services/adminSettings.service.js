import { rtdb } from "./firebase";
import { onValue, push, ref, update } from "firebase/database";

const configRoot = ref(rtdb, "config");
const adminSecurityRef = ref(rtdb, "config/admin/security");
const adminApprovalRef = ref(rtdb, "config/admin/approvalRules");
const adminEmergencyRef = ref(rtdb, "config/admin/emergency");
const opsRunnersRef = ref(rtdb, "config/ops/runners");
const opsIncidentRef = ref(rtdb, "config/ops/incidentThresholds");
const configMetaRef = ref(rtdb, "config/meta");

const adminsRef = ref(rtdb, "admins");
const rolesRef = ref(rtdb, "roles");
const auditLogsRef = ref(rtdb, "auditLogs");

const bumpMeta = async (actorUid) => {
  await update(configMetaRef, {
    version: Date.now(),
    updatedAt: Date.now(),
    updatedBy: actorUid || "admin",
  });
};

export const listenAdminSecurity = (cb) => onValue(adminSecurityRef, (s) => cb(s.val() || {}));
export const listenAdminApprovals = (cb) => onValue(adminApprovalRef, (s) => cb(s.val() || {}));
export const listenAdminEmergency = (cb) => onValue(adminEmergencyRef, (s) => cb(s.val() || {}));
export const listenOpsRunners = (cb) => onValue(opsRunnersRef, (s) => cb(s.val() || {}));
export const listenOpsIncident = (cb) => onValue(opsIncidentRef, (s) => cb(s.val() || {}));

export const updateAdminSecurity = async (patch, actorUid) => {
  await update(adminSecurityRef, patch);
  await bumpMeta(actorUid);
};
export const updateAdminApprovals = async (patch, actorUid) => {
  await update(adminApprovalRef, patch);
  await bumpMeta(actorUid);
};
export const updateAdminEmergency = async (patch, actorUid) => {
  await update(adminEmergencyRef, patch);
  await bumpMeta(actorUid);
};
export const updateOpsRunners = async (patch, actorUid) => {
  await update(opsRunnersRef, patch);
  await bumpMeta(actorUid);
};
export const updateOpsIncident = async (patch, actorUid) => {
  await update(opsIncidentRef, patch);
  await bumpMeta(actorUid);
};

export const listenAdmins = (cb) => onValue(adminsRef, (s) => cb(s.val() || {}));
export const listenRoles = (cb) => onValue(rolesRef, (s) => cb(s.val() || {}));

export const upsertAdmin = async (uid, data) => {
  if (!uid) throw new Error("Missing admin uid");
  await update(ref(rtdb, `admins/${uid}`), data);
};

export const updateAdmin = async (uid, patch) => {
  if (!uid) throw new Error("Missing admin uid");
  await update(ref(rtdb, `admins/${uid}`), patch);
};

export const updateRole = async (roleId, patch) => {
  if (!roleId) throw new Error("Missing role id");
  await update(ref(rtdb, `roles/${roleId}`), patch);
};

export const appendAuditLog = async ({ actorUid, action, target, before, after }) => {
  const entry = {
    actorUid: actorUid || "admin",
    action,
    target,
    before: before || null,
    after: after || null,
    createdAt: Date.now(),
  };
  const newRef = push(auditLogsRef);
  await update(newRef, entry);
};

export const listenAuditLogs = (cb, limit = 50) =>
  onValue(auditLogsRef, (s) => {
    const val = s.val() || {};
    const list = Object.values(val)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, limit);
    cb(list);
  });
