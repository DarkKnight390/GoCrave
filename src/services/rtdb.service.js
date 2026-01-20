import { rtdb, auth } from "./firebase";
import {
  ref,
  push,
  set,
  onValue,
  update,
  remove,
  serverTimestamp,
  get,
  query,
  orderByChild,
  equalTo,
} from "firebase/database";

const userProfileRef = (uid) => ref(rtdb, `users/${uid}`);

export const setUserProfile = async ({ uid, name, role, email }) => {
  if (!uid) throw new Error("Missing user id");

  const profile = {
    uid,
    name: name || "",
    role: role || "customer",
    email: email || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await set(userProfileRef(uid), profile);
  return profile;
};

export const getUserProfile = async (uid) => {
  if (!uid) return null;
  const snap = await get(userProfileRef(uid));
  return snap.exists() ? snap.val() : null;
};

export const listenUserProfile = (uid, callback) => {
  if (!uid) return () => {};
  return onValue(userProfileRef(uid), (snap) => {
    callback(snap.exists() ? snap.val() : null);
  });
};

/**
 * Creates an order under: /orders/{orderId}
 */
export const createOrder = async ({
  restaurantId,
  restaurantName,
  items,
  pricing,
  delivery,
  payment,
  liveLocation,
}) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");

  const ordersRef = ref(rtdb, "orders");
  const newOrderRef = push(ordersRef);
  const now = Date.now();

  const order = {
    orderId: newOrderRef.key,
    userId: user.uid,
    restaurantId: restaurantId || null,
    restaurantName: restaurantName || "",
    items: items || [],
    pricing: pricing || { subtotal: 0, deliveryFee: 0, tip: 0, total: 0 },
    delivery: delivery || { addressText: "", notes: "", phone: "" },
    payment: payment || { method: "cash" },
    status: "pending",
    createdAt: now,
    runnerId: null,
    liveLocation: liveLocation || { enabled: false },
  };

  await set(newOrderRef, order);
  try {
    const { notifyOrderCreated } = await import("./notifications.service");
    notifyOrderCreated(order.orderId).catch(() => {});
  } catch {
    // ignore push failures
  }
  return order;
};

export const createLiveLocationSession = async ({ orderId, customerUid, expiresAt }) => {
  if (!orderId || !customerUid) throw new Error("Missing live location fields");
  const sessionsRef = ref(rtdb, "liveLocationSessions");
  const newSessionRef = push(sessionsRef);
  const now = Date.now();

  const session = {
    sessionId: newSessionRef.key,
    orderId,
    customerUid,
    runnerUid: null,
    enabled: true,
    createdAt: now,
    expiresAt,
    status: "active",
  };

  await set(newSessionRef, session);
  return session;
};

export const updateOrderLiveLocation = async (orderId, patch) => {
  if (!orderId) throw new Error("Missing order id");
  const orderRef = ref(rtdb, `orders/${orderId}`);
  await update(orderRef, {
    liveLocation: patch,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Listen to all orders (later we’ll filter by workplace)
 */
export const listenOrders = (callback) => {
  const ordersRef = ref(rtdb, "orders");
  return onValue(ordersRef, (snap) => {
    const val = snap.val() || {};
    const list = Object.values(val).sort((a, b) => (b?.createdAt || 0) - (a?.createdAt || 0));
    callback(list);
  });
};

export const listenAvailableOrdersForRunner = (runnerUid, callback) => {
  if (!runnerUid) return () => {};
  const ordersRef = query(ref(rtdb, "orders"), orderByChild("status"), equalTo("pending"));
  return onValue(ordersRef, (snap) => {
    const val = snap.val() || {};
    const list = Object.values(val)
      .filter((order) => order?.status === "pending")
      .filter((order) => !order?.rejectedBy?.[runnerUid])
      .sort((a, b) => (b?.createdAt || 0) - (a?.createdAt || 0));
    callback(list);
  });
};

export const listenRunnerOrders = (runnerUid, callback) => {
  if (!runnerUid) return () => {};
  const ordersRef = query(ref(rtdb, "orders"), orderByChild("runnerId"), equalTo(runnerUid));
  return onValue(ordersRef, (snap) => {
    const val = snap.val() || {};
    const list = Object.values(val)
      .sort((a, b) => (b?.createdAt || 0) - (a?.createdAt || 0));
    callback(list);
  });
};

/**
 * Runner accepts an order
 */
export const acceptOrder = async (orderId) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");

  const orderRef = ref(rtdb, `orders/${orderId}`);
  await update(orderRef, {
    status: "accepted",
    runnerId: user.uid,
    updatedAt: serverTimestamp(),
  });

  const snap = await get(orderRef);
  if (snap.exists()) {
    const order = snap.val() || {};
    const sessionId = order?.liveLocation?.sessionId;
    if (sessionId) {
      await update(ref(rtdb, `liveLocationSessions/${sessionId}`), {
        runnerUid: user.uid,
        status: "active",
      });
    }
  }
};

export const updateOrderStatus = async (orderId, patch) => {
  if (!orderId) throw new Error("Missing order id");
  const orderRef = ref(rtdb, `orders/${orderId}`);
  const now = Date.now();
  const updates = { ...patch, updatedAt: serverTimestamp() };
  if (patch?.status) {
    updates[`statusTimestamps/${patch.status}`] = now;
  }
  await update(orderRef, updates);

  if (patch?.status) {
    const historyRef = push(ref(rtdb, `orders/${orderId}/statusHistory`));
    await set(historyRef, {
      status: patch.status,
      at: now,
      by: patch.updatedByRole || patch.updatedBy || "system",
    });
  }

  if (patch?.runnerId) {
    const snap = await get(orderRef);
    if (snap.exists()) {
      const order = snap.val() || {};
      const sessionId = order?.liveLocation?.sessionId;
      if (sessionId) {
        await update(ref(rtdb, `liveLocationSessions/${sessionId}`), {
          runnerUid: patch.runnerId,
          status: "active",
        });
      }
    }
  }

  if (patch?.status === "delivered" || patch?.status === "cancelled") {
    const snap = await get(orderRef);
    if (snap.exists()) {
      const order = snap.val() || {};
      const runnerId = order?.runnerId;
      const customerUid = order?.userId;
      if (runnerId && customerUid) {
        await remove(ref(rtdb, `runnerLocationAccess/${runnerId}/${customerUid}`));
      }
      await update(ref(rtdb, `orders/${orderId}/liveLocation`), {
        runnerVisible: false,
      });
      if (patch?.status === "delivered" && runnerId && customerUid) {
        await set(ref(rtdb, `ratingRequests/${customerUid}/${orderId}`), {
          orderId,
          runnerId,
          customerUid,
          createdAt: Date.now(),
          status: "pending",
        });
      }
    }
  }

  if (patch?.status === "cancelled") {
    try {
      const { notifyOrderCancelled } = await import("./notifications.service");
      notifyOrderCancelled(orderId).catch(() => {});
    } catch {
      // ignore push failures
    }
  }

  if (patch?.status === "delivered") {
    try {
      const { notifyOrderDelivered } = await import("./notifications.service");
      notifyOrderDelivered(orderId).catch(() => {});
    } catch {
      // ignore push failures
    }
  }
};

export const acceptOrderAsRunner = async (orderId, runnerUid) => {
  if (!orderId || !runnerUid) throw new Error("Missing order info");
  const orderRef = ref(rtdb, `orders/${orderId}`);
  const now = Date.now();
  await update(orderRef, {
    status: "accepted",
    runnerId: runnerUid,
    updatedAt: serverTimestamp(),
    "statusTimestamps/accepted": now,
  });

  await set(push(ref(rtdb, `orders/${orderId}/statusHistory`)), {
    status: "accepted",
    at: now,
    by: "runner",
  });

  const snap = await get(orderRef);
  if (snap.exists()) {
    const order = snap.val() || {};
    const sessionId = order?.liveLocation?.sessionId;
    const prevExpires = order?.liveLocation?.expiresAt || null;
    const shouldExtend = !prevExpires || prevExpires < now;
    const nextExpiresAt = shouldExtend ? now + 60 * 60 * 1000 : prevExpires;
    if (sessionId) {
      await update(ref(rtdb, `liveLocationSessions/${sessionId}`), {
        runnerUid,
        status: "active",
        expiresAt: nextExpiresAt,
      });
    }
    await update(ref(rtdb, `orders/${orderId}/liveLocation`), {
      enabled: true,
      runnerVisible: true,
      expiresAt: nextExpiresAt,
    });
    if (order?.userId) {
      await set(ref(rtdb, `runnerLocationAccess/${runnerUid}/${order.userId}`), true);
    }
  }

  try {
    const { notifyOrderAccepted } = await import("./notifications.service");
    notifyOrderAccepted(orderId).catch(() => {});
  } catch {
    // ignore push failures
  }
};

export const rejectOrderAsRunner = async (orderId, runnerUid) => {
  if (!orderId || !runnerUid) throw new Error("Missing order info");
  const orderRef = ref(rtdb, `orders/${orderId}`);
  await update(orderRef, {
    [`rejectedBy/${runnerUid}`]: true,
    updatedAt: serverTimestamp(),
  });
};

export const setRunnerLocation = async (runnerUid, coords) => {
  if (!runnerUid || !coords) return;
  await update(ref(rtdb, `runnerLocations/${runnerUid}`), {
    lat: coords.lat,
    lng: coords.lng,
    accuracy: coords.accuracy || null,
    heading: coords.heading || null,
    speed: coords.speed || null,
    updatedAt: Date.now(),
  });
};
