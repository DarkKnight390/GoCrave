import { get, onValue, push, query, ref, orderByChild, limitToLast, set, update } from "firebase/database";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { storage } from "./firebase";
import { rtdb } from "./firebase";

const getChatBasePath = ({ runnerId, customerUid }) => {
  if (runnerId) {
    return `chats/runners/${runnerId}/${customerUid}`;
  }
  return `chats/support/${customerUid}`;
};

const updateThreadMeta = async ({ runnerId, customerUid, patch }) => {
  if (!customerUid) return;
  const base = getChatBasePath({ runnerId, customerUid });
  await update(ref(rtdb, `${base}/meta`), patch);
};

export const uploadChatAttachment = async ({ file, runnerId, customerUid }) => {
  if (!file || !customerUid) throw new Error("Missing attachment");
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) throw new Error("Image must be under 5MB");
  const safeName = file.name.replace(/[^\w.-]+/g, "_");
  const base = runnerId ? `runner_${runnerId}` : "support";
  const path = `chatAttachments/${customerUid}/${base}/${Date.now()}_${safeName}`;
  const fileRef = storageRef(storage, path);
  await uploadBytes(fileRef, file);
  const url = await getDownloadURL(fileRef);
  return {
    type: "image",
    url,
    name: file.name,
    size: file.size,
  };
};

export const listenChatMessages = ({ runnerId, customerUid }, cb) => {
  if (!customerUid) {
    cb([]);
    return () => {};
  }
  const base = getChatBasePath({ runnerId, customerUid });
  const messagesRef = query(ref(rtdb, `${base}/messages`), orderByChild("createdAt"), limitToLast(200));
  return onValue(messagesRef, (snap) => {
    const val = snap.val() || {};
    const list = Object.entries(val).map(([id, msg]) => ({
      id,
      ...msg,
    }));
    list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    cb(list);
  });
};

export const listenChatThreads = (customerUid, cb) => {
  if (!customerUid) {
    cb([]);
    return () => {};
  }
  const threadsRef = ref(rtdb, `chatsIndex/${customerUid}`);
  return onValue(threadsRef, (snap) => {
    const val = snap.val() || {};
    const list = Object.entries(val).map(([id, thread]) => ({
      id,
      ...thread,
    }));
    list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    cb(list);
  });
};

export const listenRunnerThreads = (runnerId, cb) => {
  if (!runnerId) {
    cb([]);
    return () => {};
  }
  const threadsRef = ref(rtdb, `chats/runners/${runnerId}`);
  return onValue(threadsRef, (snap) => {
    const val = snap.val() || {};
    const list = Object.entries(val).map(([customerUid, thread]) => {
      const meta = thread?.meta || {};
      return {
        id: customerUid,
        customerUid,
        customerName: meta.customerName || "Customer",
        lastMessage: meta.lastMessage || "",
        updatedAt: meta.updatedAt || 0,
        runnerUnread: meta.runnerUnread || 0,
      };
    });
    list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  cb(list);
  });
};

export const listenRunnerIndexThreads = (runnerId, cb) => {
  if (!runnerId) {
    cb([]);
    return () => {};
  }
  const threadsRef = ref(rtdb, `chatsRunnerIndex/${runnerId}`);
  return onValue(threadsRef, (snap) => {
    const val = snap.val() || {};
    const list = Object.entries(val).map(([customerUid, thread]) => ({
      id: customerUid,
      customerUid,
      customerName: thread?.customerName || "Customer",
      lastMessage: thread?.lastMessage || "",
      updatedAt: thread?.updatedAt || 0,
      runnerUnread: thread?.runnerUnread || 0,
    }));
    list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    cb(list);
  });
};

export const listenSupportThreads = (cb) => {
  const supportRef = ref(rtdb, "chats/support");
  return onValue(supportRef, (snap) => {
    const val = snap.val() || {};
    const list = Object.entries(val).map(([customerUid, thread]) => {
      const meta = thread?.meta || {};
      const messages = thread?.messages || {};
      let derivedLast = "";
      let derivedTime = 0;
      if (!meta?.updatedAt && messages && typeof messages === "object") {
        Object.values(messages).forEach((msg) => {
          const ts = msg?.createdAt || 0;
          if (ts > derivedTime) {
            derivedTime = ts;
            derivedLast = msg?.text || "";
          }
        });
      }
      return {
        id: customerUid,
        customerUid,
        customerName: meta.customerName || "Customer",
        lastMessage: meta.lastMessage || derivedLast || "",
        updatedAt: meta.updatedAt || derivedTime || 0,
        supportUnread: meta.supportUnread || 0,
      };
    });
    list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    cb(list);
  });
};

export const ensureCustomerThread = async ({ customerUid, runnerId, runnerName }) => {
  if (!customerUid || !runnerId || !runnerName) return;
  const threadId = `runner_${runnerId}`;
  await update(ref(rtdb, `chatsIndex/${customerUid}/${threadId}`), {
    runnerId,
    runnerName,
  });
};

export const listenThreadMeta = ({ runnerId, customerUid }, cb) => {
  if (!customerUid) {
    cb(null);
    return () => {};
  }
  const base = getChatBasePath({ runnerId, customerUid });
  return onValue(ref(rtdb, `${base}/meta`), (snap) => cb(snap.val() || null));
};

export const sendChatMessage = async ({
  runnerId,
  runnerName,
  customerUid,
  customerName,
  role,
  text,
  action,
  attachment,
}) => {
  if (!customerUid) throw new Error("Missing customer uid");
  const trimmed = String(text || "").trim();
  if (!trimmed && !attachment) return;
  const base = getChatBasePath({ runnerId, customerUid });
  const newRef = push(ref(rtdb, `${base}/messages`));
  const now = Date.now();
  const threadId = runnerId ? `runner_${runnerId}` : "support";
  await set(newRef, {
    role,
    senderUid: role === "runner" ? runnerId : customerUid,
    text: trimmed,
    createdAt: now,
    action: action || null,
    attachment: attachment || null,
  });
  const metaRef = ref(rtdb, `${base}/meta`);
  const metaSnap = await get(metaRef);
  const meta = metaSnap.val() || {};
  const customerUnread = Number(meta.customerUnread || 0);
  const runnerUnread = Number(meta.runnerUnread || 0);
  const preview = trimmed || (attachment ? "Photo" : "");
  await update(metaRef, {
    updatedAt: now,
    lastMessage: preview,
    customerName: customerName || meta.customerName || null,
    customerUnread: role === "runner" ? customerUnread + 1 : 0,
    runnerUnread: role === "customer" ? runnerUnread + 1 : 0,
    supportUnread: role === "customer" && !runnerId ? (meta.supportUnread || 0) + 1 : meta.supportUnread || 0,
    customerDeliveredAt: role === "runner" ? now : meta.customerDeliveredAt || 0,
    runnerDeliveredAt: role === "customer" ? now : meta.runnerDeliveredAt || 0,
  });
  await update(ref(rtdb, `chatsIndex/${customerUid}/${threadId}`), {
    type: runnerId ? "runner" : "support",
    runnerId: runnerId || null,
    runnerName: runnerName || null,
    lastMessage: preview,
    updatedAt: now,
  });

  if (runnerId) {
    await update(ref(rtdb, `chatsRunnerIndex/${runnerId}/${customerUid}`), {
      customerUid,
      customerName: customerName || null,
      lastMessage: preview,
      updatedAt: now,
    });
  }
  try {
    const { notifyChatMessage } = await import("./notifications.service");
    notifyChatMessage({
      runnerId: runnerId || null,
      customerUid,
      role,
      text: preview,
    }).catch(() => {});
  } catch {
    // ignore push failures
  }
  return newRef.key;
};

export const clearCustomerUnread = async ({ runnerId, customerUid, lastReadAt }) => {
  if (!customerUid) return;
  await updateThreadMeta({
    runnerId,
    customerUid,
    patch: {
      customerUnread: 0,
      customerReadAt: lastReadAt || Date.now(),
    },
  });
};

export const clearRunnerUnread = async ({ runnerId, customerUid, lastReadAt }) => {
  if (!runnerId || !customerUid) return;
  await updateThreadMeta({
    runnerId,
    customerUid,
    patch: {
      runnerUnread: 0,
      runnerReadAt: lastReadAt || Date.now(),
    },
  });
};

export const deleteCustomerThread = async ({ customerUid, threadId }) => {
  if (!customerUid || !threadId) return;
  if (threadId === "support") {
    await set(ref(rtdb, `chats/support/${customerUid}`), null);
    await set(ref(rtdb, `chatsIndex/${customerUid}/support`), null);
    return;
  }
  const runnerId = threadId.replace(/^runner_/, "");
  await set(ref(rtdb, `chats/runners/${runnerId}/${customerUid}`), null);
  await set(ref(rtdb, `chatsIndex/${customerUid}/${threadId}`), null);
};

export const clearSupportUnread = async ({ customerUid }) => {
  if (!customerUid) return;
  await updateThreadMeta({
    runnerId: null,
    customerUid,
    patch: {
      supportUnread: 0,
      supportReadAt: Date.now(),
    },
  });
};

export const markCustomerDelivered = async ({ runnerId, customerUid, lastDeliveredAt }) => {
  if (!customerUid || !lastDeliveredAt) return;
  await updateThreadMeta({
    runnerId,
    customerUid,
    patch: { customerDeliveredAt: lastDeliveredAt },
  });
};

export const markRunnerDelivered = async ({ runnerId, customerUid, lastDeliveredAt }) => {
  if (!runnerId || !customerUid || !lastDeliveredAt) return;
  await updateThreadMeta({
    runnerId,
    customerUid,
    patch: { runnerDeliveredAt: lastDeliveredAt },
  });
};
