import { create } from "zustand";
import { auth } from "../services/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { getUserProfile } from "../services/rtdb.service";
import { updateUserProfile } from "../services/profile.service";
import { startPresence } from "../services/presence.service";
import { getRunnerIdByUid } from "../services/runners.service";
import { requestPushPermission } from "../services/push.service";
import { requestAppPermissionsOnce } from "../services/permissions.service";

const PROFILE_CACHE_KEY = "gocrave_profile_cache";

const loadCachedProfile = () => {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveCachedProfile = (profile) => {
  try {
    if (!profile) {
      localStorage.removeItem(PROFILE_CACHE_KEY);
      return;
    }
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
  } catch {
    // ignore storage errors
  }
};


export const useAuthStore = create((set, get) => ({
  user: null,
  profile: null,
  loading: true,

  refreshProfile: async (uidOverride) => {
    const uid = uidOverride || get().user?.uid;
    if (!uid) return;
    try {
      const profile = await getUserProfile(uid);
      if (profile) {
        set({ profile });
        saveCachedProfile(profile);
      }
    } catch {
      // keep existing cached profile
    }
  },

  initAuth: () => {
    let stopPresence = null;
    return onAuthStateChanged(
      auth,
      async (user) => {
        if (!user) {
          if (stopPresence) stopPresence();
          set({ user: null, profile: null, loading: false });
          saveCachedProfile(null);
          return;
        }

        try {
          const cached = loadCachedProfile();
          if (cached && cached?.uid === user.uid) {
            set({ user, profile: cached, loading: true });
          } else {
            set({ user, profile: null, loading: true });
          }
          const profile = await getUserProfile(user.uid);
          set({ user, profile, loading: false });
          saveCachedProfile(profile);
          if (stopPresence) stopPresence();
          const runnerId = profile?.role === "runner"
            ? await getRunnerIdByUid(user.uid, user.email)
            : null;
          stopPresence = startPresence({ uid: user.uid, runnerId });
          requestPushPermission(user.uid).catch(() => {});
          requestAppPermissionsOnce(user.uid).catch(() => {});
        } catch {
          const cached = loadCachedProfile();
          if (cached && cached?.uid === user.uid) {
            set({ user, profile: cached, loading: false });
          } else {
            set({ user, profile: null, loading: false });
          }
          setTimeout(() => {
            get().refreshProfile(user.uid);
          }, 2000);
        }
      },
      () => {
        if (stopPresence) stopPresence();
        set({ user: null, profile: null, loading: false });
        saveCachedProfile(null);
      }
    );
  },
  updateProfile: async (patch) => {
    const uid = get().user?.uid;
    if (!uid) throw new Error("Not logged in");

    // optimistic UI
    set((s) => {
      const next = { ...s.profile, ...patch };
      saveCachedProfile(next);
      return { profile: next };
    });

    // persist
    await updateUserProfile(uid, patch);
  },

}));
