import { auth } from "./firebase";
import { setUserProfile } from "./rtdb.service";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from "firebase/auth";

const formatAuthError = (error) => {
  switch (error?.code) {
    case "auth/email-already-in-use":
      return "Email already in use.";
    case "auth/invalid-email":
      return "Invalid email address.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/wrong-password":
      return "Incorrect password.";
    case "auth/user-not-found":
      return "No account found for this email.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again later.";
    default:
      return error?.message || "Authentication failed.";
  }
};

export const signup = async ({ name, role, email, password }) => {
  try {
    const res = await createUserWithEmailAndPassword(auth, email, password);
    if (name) await updateProfile(res.user, { displayName: name });
    await setUserProfile({ uid: res.user.uid, name, role, email: res.user.email });
    return res.user;
  } catch (error) {
    throw new Error(formatAuthError(error));
  }
};

export const login = async ({ email, password }) => {
  try {
    const res = await signInWithEmailAndPassword(auth, email, password);
    return res.user;
  } catch (error) {
    throw new Error(formatAuthError(error));
  }
};

export const logout = () => signOut(auth);
