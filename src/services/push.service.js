import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { ref, set } from "firebase/database";
import { app, rtdb } from "./firebase";

let nativePushInitialized = false;

const registerMessagingSw = async () => {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  } catch {
    return null;
  }
};

export const requestPushPermission = async (uid) => {
  if (!uid) return null;

  if (Capacitor.isNativePlatform()) {
    if (nativePushInitialized) return null;
    nativePushInitialized = true;
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") return null;

    PushNotifications.register();

    PushNotifications.addListener("registration", async (token) => {
      if (!token?.value) return;
      if (typeof window !== "undefined") {
        window.__fcmToken = token.value;
      }
      console.log("FCM token (native):", token.value);
      await set(ref(rtdb, `fcmTokens/${uid}/${token.value}`), {
        token: token.value,
        createdAt: Date.now(),
        platform: "android",
      });
    });

    return null;
  }

  if (!("Notification" in window)) return null;

  const supported = await isSupported();
  if (!supported) return null;

  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
  if (Notification.permission !== "granted") return null;

  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey) return null;

  const messaging = getMessaging(app);
  const swReg = await registerMessagingSw();
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: swReg || undefined,
  });
  if (!token) return null;

  if (typeof window !== "undefined") {
    window.__fcmToken = token;
  }
  console.log("FCM token (web):", token);
  await set(ref(rtdb, `fcmTokens/${uid}/${token}`), {
    token,
    createdAt: Date.now(),
  });

  return token;
};
