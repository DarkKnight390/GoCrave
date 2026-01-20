import { onValue, push, ref, runTransaction, set, update } from "firebase/database";
import { rtdb } from "./firebase";

export const listenRatingRequests = (customerUid, cb) => {
  if (!customerUid) return () => {};
  const reqRef = ref(rtdb, `ratingRequests/${customerUid}`);
  return onValue(reqRef, (snap) => {
    const val = snap.val() || {};
    const list = Object.values(val).filter((r) => r?.status === "pending");
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    cb(list);
  });
};

export const submitRunnerRating = async ({ customerUid, runnerId, orderId, stars }) => {
  if (!customerUid || !runnerId || !orderId) throw new Error("Missing rating info");
  const rating = {
    orderId,
    customerUid,
    runnerId,
    stars: Number(stars),
    createdAt: Date.now(),
  };

  const ratingRef = push(ref(rtdb, `runnerRatings/${runnerId}`));
  await set(ratingRef, rating);

  const metricsRef = ref(rtdb, `runnerMetrics/${runnerId}`);
  await runTransaction(metricsRef, (current) => {
    const val = current || {};
    const count = Number(val.ratingCount || 0);
    const avg = Number(val.ratingAvg || 0);
    const nextCount = count + 1;
    const nextAvg = (avg * count + Number(stars)) / nextCount;
    return {
      ...val,
      ratingCount: nextCount,
      ratingAvg: Number(nextAvg.toFixed(2)),
    };
  });

  await update(ref(rtdb, `ratingRequests/${customerUid}/${orderId}`), {
    status: "completed",
    completedAt: Date.now(),
  });
};

export const dismissRatingRequest = async ({ customerUid, orderId }) => {
  if (!customerUid || !orderId) return;
  await update(ref(rtdb, `ratingRequests/${customerUid}/${orderId}`), {
    status: "dismissed",
    completedAt: Date.now(),
  });
};
