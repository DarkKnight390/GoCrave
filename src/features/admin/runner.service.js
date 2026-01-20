import { httpsCallable } from "firebase/functions";
import { functions } from "../../services/firebase";

export async function createRunner(payload) {
  const fn = httpsCallable(functions, "createRunner");
  const res = await fn(payload);
  return res.data;
}
