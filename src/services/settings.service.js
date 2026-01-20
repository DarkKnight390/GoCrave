import { onValue, ref } from "firebase/database";
import { rtdb } from "./firebase";

const settingsRef = ref(rtdb, "admin/settings");

export const listenAppSettings = (callback) =>
  onValue(settingsRef, (snap) => {
    callback(snap.exists() ? snap.val() : {});
  });

export const listenDeliveryFee = (callback) =>
  onValue(ref(rtdb, "admin/settings/payments/defaultDeliveryFee"), (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    const value = Number(snap.val());
    callback(Number.isNaN(value) ? null : value);
  });
