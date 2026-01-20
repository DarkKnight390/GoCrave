import { auth } from "./firebase";

const baseUrl = import.meta.env.VITE_RUNNER_API_URL || "http://localhost:8080";

const postAuthed = async (path, body) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");
  const token = await user.getIdToken();
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || "Notification failed");
  }
  return res.json();
};

export const notifyOrderCreated = async (orderId) =>
  postAuthed("/api/notify/order-created", { orderId });

export const notifyOrderAccepted = async (orderId) =>
  postAuthed("/api/notify/order-accepted", { orderId });

export const notifyOrderCancelled = async (orderId) =>
  postAuthed("/api/notify/order-cancelled", { orderId });

export const notifyOrderDelivered = async (orderId) =>
  postAuthed("/api/notify/order-delivered", { orderId });

export const notifyChatMessage = async ({ runnerId, customerUid, role, text }) =>
  postAuthed("/api/notify/message", { runnerId, customerUid, role, text });

export const notifyPushTest = async (targetUid) =>
  postAuthed("/api/admin/push-test", { targetUid });
