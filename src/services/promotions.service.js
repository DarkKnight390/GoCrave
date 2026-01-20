import { rtdb } from "./firebase";
import { onValue, push, ref, remove, set, update } from "firebase/database";

const promotionsRef = ref(rtdb, "promotions");

const normalize = (promo, id) => ({
  promoId: promo?.promoId || id,
  title: promo?.title || "",
  subtitle: promo?.subtitle || "",
  badge: promo?.badge || "",
  ctaText: promo?.ctaText || "",
  ctaLink: promo?.ctaLink || "",
  imageUrl: promo?.imageUrl || "",
  startsAt: promo?.startsAt || 0,
  endsAt: promo?.endsAt || 0,
  isActive: promo?.isActive !== false,
  createdAt: promo?.createdAt || 0,
});

export const listenPromotions = (callback) =>
  onValue(promotionsRef, (snap) => {
    const val = snap.val() || {};
    const list = Object.entries(val)
      .map(([id, promo]) => normalize(promo, id))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    callback(list);
  });

export const createPromotion = async (payload) => {
  const refNew = push(promotionsRef);
  const now = Date.now();
  const promo = normalize(
    {
      ...payload,
      promoId: refNew.key,
      createdAt: now,
    },
    refNew.key
  );
  await set(refNew, promo);
  return promo;
};

export const updatePromotion = async (promoId, patch) => {
  if (!promoId) throw new Error("Missing promo id");
  await update(ref(rtdb, `promotions/${promoId}`), patch);
};

export const deletePromotion = async (promoId) => {
  if (!promoId) throw new Error("Missing promo id");
  await remove(ref(rtdb, `promotions/${promoId}`));
};
