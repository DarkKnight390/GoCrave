import { rtdb } from "./firebase";
import { ref, get, update } from "firebase/database";

export async function getUserProfile(uid) {
  const snap = await get(ref(rtdb, `users/${uid}`));
  return snap.exists() ? snap.val() : null;
}

export async function updateUserProfile(uid, data) {
  // Only allow updating these fields (security + sanity)
  const allowed = ["name", "workplaceLocation", "phone", "defaultPaymentMethod"];

  const patch = {};
  for (const key of allowed) {
    if (key in data) patch[key] = data[key];
  }

  patch.updatedAt = Date.now();

  await update(ref(rtdb, `users/${uid}`), patch);
  return patch;
}
