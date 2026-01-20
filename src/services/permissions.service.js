import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { Camera } from "@capacitor/camera";
import { PushNotifications } from "@capacitor/push-notifications";

const PROMPT_KEY = "gc_permissions_prompted_v1";

const requestWebLocation = () =>
  new Promise((resolve) => {
    if (!navigator?.geolocation?.getCurrentPosition) {
      resolve({ state: "unavailable" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => resolve({ state: "granted" }),
      () => resolve({ state: "denied" }),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });

const requestWebMicrophone = async () => {
  if (!navigator?.mediaDevices?.getUserMedia) return { state: "unavailable" };
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((track) => track.stop());
  return { state: "granted" };
};

export const requestAppPermissions = async () => {
  const isNative = Capacitor.isNativePlatform();
  const results = {};

  try {
    results.notifications = isNative
      ? await PushNotifications.requestPermissions()
      : { state: "skipped" };
  } catch {
    results.notifications = { state: "error" };
  }

  try {
    results.location = isNative
      ? await Geolocation.requestPermissions()
      : await requestWebLocation();
  } catch {
    results.location = { state: "error" };
  }

  try {
    results.photos = isNative
      ? await Camera.requestPermissions({ permissions: ["photos"] })
      : { state: "skipped" };
  } catch {
    results.photos = { state: "error" };
  }

  try {
    results.microphone = await requestWebMicrophone();
  } catch {
    results.microphone = { state: "error" };
  }

  return results;
};

export const requestAppPermissionsOnce = async (uid) => {
  if (typeof window === "undefined") return null;
  const key = uid ? `${PROMPT_KEY}_${uid}` : PROMPT_KEY;
  if (localStorage.getItem(key)) return null;
  localStorage.setItem(key, "1");
  return requestAppPermissions();
};
