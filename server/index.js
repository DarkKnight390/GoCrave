require("dotenv").config();
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const twilio = require("twilio");

const app = express();
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
  : [];
app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
  })
);
app.use(express.json());

const path = require("path");
const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
  "gocrave-app-firebase-adminsdk-fbsvc-cc6df44204.json";
const databaseURL = process.env.FIREBASE_DATABASE_URL;

if (!databaseURL) {
  throw new Error("Missing FIREBASE_DATABASE_URL");
}

const serviceAccountFile = path.isAbsolute(serviceAccountPath)
  ? serviceAccountPath
  : path.join(__dirname, "..", serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(require(serviceAccountFile)),
  databaseURL,
});

const payoutCache = { value: 1000 };
const payoutRef = admin.database().ref("config/payouts/runnerPerDelivery");
payoutRef.on("value", (snap) => {
  const value = snap.exists() ? Number(snap.val()) : 1000;
  payoutCache.value = Number.isFinite(value) ? value : 1000;
});

const getAuthUid = async (req) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  const decoded = await admin.auth().verifyIdToken(token);
  return decoded?.uid || null;
};

const sendFcmToUser = async (uid, payload) => {
  const tokensSnap = await admin.database().ref(`fcmTokens/${uid}`).get();
  if (!tokensSnap.exists()) return;
  const tokens = Object.keys(tokensSnap.val() || {});
  if (!tokens.length) return;
  await admin.messaging().sendEachForMulticast({
    tokens,
    notification: payload.notification,
    data: payload.data || {},
  });
};

const getAllFcmTokens = async () => {
  const snap = await admin.database().ref("fcmTokens").get();
  if (!snap.exists()) return [];
  const val = snap.val() || {};
  const out = [];
  Object.values(val).forEach((byToken) => {
    if (!byToken) return;
    Object.entries(byToken).forEach(([key, entry]) => {
      if (entry && typeof entry === "object" && entry.token) {
        out.push(entry.token);
        return;
      }
      out.push(key);
    });
  });
  return Array.from(new Set(out.filter(Boolean)));
};

const sendFcmToTokens = async (tokens, payload) => {
  if (!tokens?.length) return;
  const size = 500;
  for (let i = 0; i < tokens.length; i += size) {
    const batch = tokens.slice(i, i + size);
    await admin.messaging().sendEachForMulticast({
      tokens: batch,
      notification: payload.notification,
      data: payload.data || {},
    });
  }
};

const sendFcmToUsers = async (uids, payload) => {
  const uniq = Array.from(new Set((uids || []).filter(Boolean)));
  if (!uniq.length) return;
  await Promise.allSettled(uniq.map((uid) => sendFcmToUser(uid, payload)));
};

const getAdmins = async () => {
  const snap = await admin.database().ref("users").get();
  if (!snap.exists()) return [];
  const val = snap.val() || {};
  return Object.values(val)
    .filter((u) => u?.role === "admin" && u?.uid)
    .map((u) => u.uid);
};

const getOnlineRunnerUids = async () => {
  const snap = await admin.database().ref("runners").get();
  if (!snap.exists()) return [];
  const val = snap.val() || {};
  return Object.values(val)
    .filter((r) => r?.authUid)
    .filter((r) => r?.availability === "online")
    .filter((r) => r?.status !== "inactive" && r?.status !== "suspended" && r?.status !== "banned")
    .map((r) => r.authUid);
};

const getOrder = async (orderId) => {
  const snap = await admin.database().ref(`orders/${orderId}`).get();
  return snap.exists() ? snap.val() : null;
};

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/geocode/reverse", async (req, res) => {
  try {
    const lat = req.query.lat;
    const lng = req.query.lng;
    if (!lat || !lng) return res.status(400).json({ error: "missing_coords" });
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
      lat
    )}&lon=${encodeURIComponent(lng)}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "GoCrave/1.0 (support@gocrave.app)",
      },
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: "geocode_failed" });
    }
    const data = await response.json();
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "server_error" });
  }
});

app.post("/api/runner/deliver", async (req, res) => {
  try {
    const uid = await getAuthUid(req);
    if (!uid) return res.status(401).json({ error: "unauthorized" });

    const { orderId } = req.body || {};
    if (!orderId) return res.status(400).json({ error: "missing_orderId" });

    const orderRef = admin.database().ref(`orders/${orderId}`);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists()) return res.status(404).json({ error: "order_not_found" });

    const order = orderSnap.val() || {};
    if (order.runnerId !== uid) {
      return res.status(403).json({ error: "runner_mismatch" });
    }
    if (order.status !== "accepted" && order.status !== "on_the_way") {
      return res.status(400).json({ error: "invalid_status" });
    }

    const runnerIdSnap = await admin.database().ref(`runnerIndex/byUid/${uid}`).get();
    const runnerId = runnerIdSnap.exists() ? runnerIdSnap.val() : null;
    if (!runnerId) return res.status(400).json({ error: "runner_id_missing" });

    const amount = payoutCache.value;
    const now = Date.now();

    await orderRef.update({ status: "delivered", deliveredAt: now, updatedAt: now });

    if (order.userId) {
      await admin
        .database()
        .ref(`runnerLocationAccess/${uid}/${order.userId}`)
        .remove();
      await admin
        .database()
        .ref(`orders/${orderId}/liveLocation`)
        .update({ runnerVisible: false });
    }

    const metricsRef = admin.database().ref(`runnerMetrics/${runnerId}`);
    await metricsRef.transaction((current) => {
      const val = current || {};
      return {
        ...val,
        deliveriesCount: Number(val.deliveriesCount || 0) + 1,
        totalEarnings: Number(val.totalEarnings || 0) + amount,
        lastOnRouteAt: now,
      };
    });

    if (order.userId) {
      await admin.database().ref(`ratingRequests/${order.userId}/${orderId}`).set({
        orderId,
        runnerId,
        customerUid: order.userId,
        restaurantName: order.restaurantName || "",
        createdAt: now,
        status: "pending",
      });
      await sendFcmToUser(order.userId, {
        notification: {
          title: "Order delivered",
          body: `Your ${order.restaurantName || "order"} has been delivered.`,
        },
        data: {
          type: "order_delivered",
          orderId,
        },
      });
    }

    return res.json({ ok: true, amountJMD: amount });
  } catch (err) {
    return res.status(500).json({ error: "server_error", message: err?.message });
  }
});

app.post("/api/notify/order-created", async (req, res) => {
  try {
    const uid = await getAuthUid(req);
    if (!uid) return res.status(401).json({ error: "unauthorized" });
    const { orderId } = req.body || {};
    if (!orderId) return res.status(400).json({ error: "missing_orderId" });
    const order = await getOrder(orderId);
    if (!order) return res.status(404).json({ error: "order_not_found" });
    if (order.userId !== uid) return res.status(403).json({ error: "forbidden" });

    const runnerUids = await getOnlineRunnerUids();
    await sendFcmToUsers(runnerUids, {
      notification: {
        title: "Incoming order",
        body: `${order.restaurantName || "New order"} · ${order.pricing?.total || 0} JMD`,
      },
      data: {
        type: "order_created",
        orderId,
      },
    });

    return res.json({ ok: true, notified: runnerUids.length });
  } catch (err) {
    return res.status(500).json({ error: "server_error", message: err?.message });
  }
});

app.post("/api/notify/order-accepted", async (req, res) => {
  try {
    const uid = await getAuthUid(req);
    if (!uid) return res.status(401).json({ error: "unauthorized" });
    const { orderId } = req.body || {};
    if (!orderId) return res.status(400).json({ error: "missing_orderId" });
    const order = await getOrder(orderId);
    if (!order) return res.status(404).json({ error: "order_not_found" });
    if (order.runnerId !== uid) return res.status(403).json({ error: "forbidden" });

    if (order.userId) {
      await sendFcmToUser(order.userId, {
        notification: {
          title: "Order accepted",
          body: `Your runner is on the way for ${order.restaurantName || "your order"}.`,
        },
        data: {
          type: "order_accepted",
          orderId,
        },
      });
    }
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "server_error", message: err?.message });
  }
});

app.post("/api/notify/order-cancelled", async (req, res) => {
  try {
    const uid = await getAuthUid(req);
    if (!uid) return res.status(401).json({ error: "unauthorized" });
    const { orderId } = req.body || {};
    if (!orderId) return res.status(400).json({ error: "missing_orderId" });
    const order = await getOrder(orderId);
    if (!order) return res.status(404).json({ error: "order_not_found" });
    if (order.userId !== uid && order.runnerId !== uid) {
      return res.status(403).json({ error: "forbidden" });
    }

    const targets = [];
    if (order.userId && order.userId !== uid) targets.push(order.userId);
    if (order.runnerId && order.runnerId !== uid) targets.push(order.runnerId);

    await sendFcmToUsers(targets, {
      notification: {
        title: "Order cancelled",
        body: `Order ${String(orderId).slice(-6)} was cancelled.`,
      },
      data: {
        type: "order_cancelled",
        orderId,
      },
    });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "server_error", message: err?.message });
  }
});

app.post("/api/notify/order-delivered", async (req, res) => {
  try {
    const uid = await getAuthUid(req);
    if (!uid) return res.status(401).json({ error: "unauthorized" });
    const { orderId } = req.body || {};
    if (!orderId) return res.status(400).json({ error: "missing_orderId" });
    const order = await getOrder(orderId);
    if (!order) return res.status(404).json({ error: "order_not_found" });
    if (order.runnerId !== uid && order.userId !== uid) {
      return res.status(403).json({ error: "forbidden" });
    }
    if (order.userId) {
      await sendFcmToUser(order.userId, {
        notification: {
          title: "Order delivered",
          body: `Your ${order.restaurantName || "order"} has been delivered.`,
        },
        data: {
          type: "order_delivered",
          orderId,
        },
      });
    }
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "server_error", message: err?.message });
  }
});

app.post("/api/notify/promotion", async (req, res) => {
  try {
    const uid = await getAuthUid(req);
    if (!uid) return res.status(401).json({ error: "unauthorized" });

    const adminSnap = await admin.database().ref(`users/${uid}`).get();
    const role = adminSnap.exists() ? adminSnap.val()?.role : null;
    if (role !== "admin") {
      return res.status(403).json({ error: "forbidden" });
    }

    const { promoId } = req.body || {};
    if (!promoId) return res.status(400).json({ error: "missing_promoId" });
    const promoSnap = await admin.database().ref(`promotions/${promoId}`).get();
    if (!promoSnap.exists()) return res.status(404).json({ error: "promo_not_found" });
    const promo = promoSnap.val() || {};

    const title = promo.badge ? `${promo.badge} • ${promo.title || "New promotion"}` : promo.title || "New promotion";
    const body = promo.subtitle || "New offer available now.";
    const payload = {
      notification: {
        title,
        body,
      },
      data: {
        type: "promotion",
        promoId,
      },
    };
    if (promo.imageUrl) {
      payload.notification.imageUrl = promo.imageUrl;
    }

    const tokens = await getAllFcmTokens();
    await sendFcmToTokens(tokens, payload);
    return res.json({ ok: true, sent: tokens.length });
  } catch (err) {
    return res.status(500).json({ error: "server_error", message: err?.message });
  }
});

app.post("/api/notify/message", async (req, res) => {
  try {
    const uid = await getAuthUid(req);
    if (!uid) return res.status(401).json({ error: "unauthorized" });
    const { runnerId, customerUid, role, text } = req.body || {};
    if (!customerUid || !role) return res.status(400).json({ error: "missing_fields" });

    const preview = String(text || "").trim() || "New message";
    if (role === "customer") {
      if (uid !== customerUid) return res.status(403).json({ error: "forbidden" });
      if (runnerId) {
        const runnerUidSnap = await admin.database().ref(`runnerIndex/byRunnerId/${runnerId}`).get();
        const runnerUid = runnerUidSnap.exists() ? runnerUidSnap.val()?.uid : null;
        if (runnerUid) {
          await sendFcmToUser(runnerUid, {
            notification: {
              title: "New message",
              body: preview,
            },
            data: {
              type: "chat_message",
              runnerId,
              customerUid,
            },
          });
        }
        return res.json({ ok: true });
      }

      const admins = await getAdmins();
      await sendFcmToUsers(admins, {
        notification: {
          title: "Support message",
          body: preview,
        },
        data: {
          type: "support_message",
          customerUid,
        },
      });
      return res.json({ ok: true });
    }

    if (role === "runner") {
      const runnerIdSnap = await admin.database().ref(`runnerIndex/byUid/${uid}`).get();
      const runnerIdFromUid = runnerIdSnap.exists() ? runnerIdSnap.val() : null;
      if (!runnerIdFromUid || runnerIdFromUid !== runnerId) {
        return res.status(403).json({ error: "forbidden" });
      }
      await sendFcmToUser(customerUid, {
        notification: {
          title: "New message",
          body: preview,
        },
        data: {
          type: "chat_message",
          runnerId,
          customerUid,
        },
      });
      return res.json({ ok: true });
    }

    if (role === "support") {
      const adminSnap = await admin.database().ref(`users/${uid}`).get();
      const userRole = adminSnap.exists() ? adminSnap.val()?.role : null;
      if (userRole !== "admin") return res.status(403).json({ error: "forbidden" });
      await sendFcmToUser(customerUid, {
        notification: {
          title: "GoCrave Support",
          body: preview,
        },
        data: {
          type: "support_message",
          customerUid,
        },
      });
      return res.json({ ok: true });
    }

    return res.status(400).json({ error: "invalid_role" });
  } catch (err) {
    return res.status(500).json({ error: "server_error", message: err?.message });
  }
});

app.post("/api/admin/push-test", async (req, res) => {
  try {
    const uid = await getAuthUid(req);
    if (!uid) return res.status(401).json({ error: "unauthorized" });

    const adminSnap = await admin.database().ref(`users/${uid}`).get();
    const role = adminSnap.exists() ? adminSnap.val()?.role : null;
    if (role !== "admin") {
      return res.status(403).json({ error: "forbidden" });
    }

    const { targetUid } = req.body || {};
    if (!targetUid) return res.status(400).json({ error: "missing_target" });

    await sendFcmToUser(targetUid, {
      notification: {
        title: "GoCrave test",
        body: "This is a test notification.",
      },
      data: {
        type: "test",
      },
    });

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "server_error", message: err?.message });
  }
});

app.post("/api/admin/delete-runner", async (req, res) => {
  try {
    const uid = await getAuthUid(req);
    if (!uid) return res.status(401).json({ error: "unauthorized" });

    const adminSnap = await admin.database().ref(`users/${uid}`).get();
    const role = adminSnap.exists() ? adminSnap.val()?.role : null;
    if (role !== "admin") {
      return res.status(403).json({ error: "forbidden" });
    }

    const { runnerId } = req.body || {};
    if (!runnerId) return res.status(400).json({ error: "missing_runnerId" });

    const coreSnap = await admin.database().ref(`runners/${runnerId}`).get();
    const core = coreSnap.exists() ? coreSnap.val() : {};

    const byRunnerIdSnap = await admin
      .database()
      .ref(`runnerIndex/byRunnerId/${runnerId}`)
      .get();
    const byRunnerId = byRunnerIdSnap.exists() ? byRunnerIdSnap.val() : {};

    const authUid = core?.authUid || byRunnerId?.uid || null;
    const phone = core?.phone || null;

    const updates = {
      [`runners/${runnerId}`]: null,
      [`runners/goCrave/${runnerId}`]: null,
      [`runners/independent/${runnerId}`]: null,
      [`runnerMetrics/${runnerId}`]: null,
      [`runnerCheckins/${runnerId}`]: null,
      [`runnerRatings/${runnerId}`]: null,
      [`runnerComplaints/${runnerId}`]: null,
      [`runnerWarnings/${runnerId}`]: null,
      [`runnerLocationAccess/${runnerId}`]: null,
      [`runnerLocations/${runnerId}`]: null,
      [`subscriptions/${runnerId}`]: null,
      [`chatsRunnerIndex/${runnerId}`]: null,
      [`chats/runners/${runnerId}`]: null,
      [`runnerIndex/byRunnerId/${runnerId}`]: null,
    };

    if (authUid) {
      updates[`runnerIndex/byUid/${authUid}`] = null;
      updates[`users/${authUid}`] = null;
      updates[`presence/${authUid}`] = null;
      updates[`fcmTokens/${authUid}`] = null;
      updates[`runnerLocationAccess/${authUid}`] = null;
      updates[`runnerLocations/${authUid}`] = null;
    }
    if (phone) {
      updates[`runnerIndex/byPhone/${phone}`] = null;
    }

    await admin.database().ref().update(updates);

    if (authUid) {
      try {
        await admin.auth().deleteUser(authUid);
      } catch (err) {
        // If user already deleted, continue cleanup.
      }
    }

    return res.json({ ok: true, runnerId, authUid });
  } catch (err) {
    return res.status(500).json({ error: "server_error", message: err?.message });
  }
});

/**
 * Twilio Voice Token Generation
 * Generates access tokens for Twilio Voice calling
 */
app.post("/api/twilio/token", async (req, res) => {
  try {
    // Accept identity from body (for flexibility in Render or local dev)
    let identity = req.body?.identity;
    if (!identity) {
      // fallback to Firebase auth if not provided
      identity = await getAuthUid(req);
      if (!identity) {
        return res.status(401).json({ error: "unauthorized" });
      }
    }

    // Get Twilio credentials from environment
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const apiKey = process.env.TWILIO_API_KEY;
    const apiSecret = process.env.TWILIO_API_SECRET;
    const appSid = process.env.TWILIO_APP_SID; // TwiML App SID

    if (!accountSid || !apiKey || !apiSecret || !appSid) {
      console.error("Missing Twilio credentials in environment");
      return res.status(500).json({
        error: "server_error",
        message: "Twilio not configured",
      });
    }

    // Generate access token
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const token = new AccessToken(accountSid, apiKey, apiSecret, { identity });

    // Add voice grant to allow making/receiving calls
    token.addGrant(
      new VoiceGrant({
        outgoingApplicationSid: appSid,
        incomingAllow: true,
      })
    );

    console.log("🎤 Generated Twilio token for user:", identity);

    return res.json({
      token: token.toJwt(),
      identity,
    });
  } catch (err) {
    console.error("Failed to generate Twilio token:", err);
    return res.status(500).json({
      error: "server_error",
      message: err?.message,
    });
  }
});

const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  console.log(`Runner server listening on :${port}`);
});
