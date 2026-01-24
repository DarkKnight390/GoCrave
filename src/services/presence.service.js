import { onDisconnect, onValue, ref, serverTimestamp, set } from "firebase/database";
import { rtdb } from "./firebase";

const presenceRef = (uid) => ref(rtdb, `presence/${uid}`);
const runnerPresenceRef = (runnerId) => ref(rtdb, `runners/${runnerId}/presence`);

export const startPresence = ({ uid, runnerId }) => {
  if (!uid) return () => {};

  const userRef = presenceRef(uid);
  const infoRef = ref(rtdb, ".info/connected");
  let connectedUnsub = () => {};

  connectedUnsub = onValue(infoRef, (snap) => {
    if (snap.val() !== true) return;

    onDisconnect(userRef)
      .set({
        state: "offline",
        lastChanged: serverTimestamp(),
      })
      .catch(() => {});

    set(userRef, {
      state: "online",
      lastChanged: serverTimestamp(),
    }).catch(() => {});

    if (runnerId) {
      const rRef = runnerPresenceRef(runnerId);
      onDisconnect(rRef)
        .set({
          state: "offline",
          lastChanged: serverTimestamp(),
        })
        .catch(() => {});
      set(rRef, {
        state: "online",
        lastChanged: serverTimestamp(),
      }).catch(() => {});
    }
  });

  return () => {
    if (connectedUnsub) connectedUnsub();
  };
};

export const listenPresence = (uid, cb) => {
  if (!uid) {
    cb(null);
    return () => {};
  }
  return onValue(presenceRef(uid), (snap) => cb(snap.val() || null));
};

export const listenRunnerPresence = (runnerId, cb) => {
  if (!runnerId) {
    cb(null);
    return () => {};
  }
  return onValue(runnerPresenceRef(runnerId), (snap) => cb(snap.val() || null));
};
