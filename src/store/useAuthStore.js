import { create } from "zustand";
import { auth } from "../services/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { getUserProfile } from "../services/rtdb.service";
import { updateUserProfile } from "../services/profile.service";
import { startPresence } from "../services/presence.service";
import { getRunnerIdByUid } from "../services/runners.service";
import { requestPushPermission } from "../services/push.service";
import { requestAppPermissionsOnce } from "../services/permissions.service";



export const useAuthStore = create((set, get) => ({
  user: null,
  profile: null,
  loading: true,

  initAuth: () => {
    let stopPresence = null;
    return onAuthStateChanged(
      auth,
      async (user) => {
        if (!user) {
          if (stopPresence) stopPresence();
          set({ user: null, profile: null, loading: false });
          return;
        }

        try {
          const profile = await getUserProfile(user.uid);
          set({ user, profile, loading: false });
          if (stopPresence) stopPresence();
          const runnerId = profile?.role === "runner"
            ? await getRunnerIdByUid(user.uid, user.email)
            : null;
          stopPresence = startPresence({ uid: user.uid, runnerId });
          requestPushPermission(user.uid).catch(() => {});
          requestAppPermissionsOnce(user.uid).catch(() => {});
        } catch {
          set({ user, profile: null, loading: false });
        }
      },
      () => {
        if (stopPresence) stopPresence();
        set({ user: null, profile: null, loading: false });
      }
    );
  },
  updateProfile: async (patch) => {
    const uid = get().user?.uid;
    if (!uid) throw new Error("Not logged in");

    // optimistic UI
    set((s) => ({ profile: { ...s.profile, ...patch } }));

    // persist
    await updateUserProfile(uid, patch);
  },

}));
