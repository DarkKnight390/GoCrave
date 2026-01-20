import { auth } from "./firebase";

const baseUrl = import.meta.env.VITE_RUNNER_API_URL || "http://localhost:8080";

export const deliverOrderServer = async (orderId) => {
  if (!orderId) throw new Error("Missing orderId");
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");

  const token = await user.getIdToken();
  const res = await fetch(`${baseUrl}/api/runner/deliver`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ orderId }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || "Failed to mark delivered");
  }

  return res.json();
};
