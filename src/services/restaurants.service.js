import { rtdb } from "./firebase";
import {
  ref,
  push,
  set,
  onValue,
  serverTimestamp,
  update,
  remove,
  get,
} from "firebase/database";

const restaurantsRef = ref(rtdb, "restaurants");
const categoriesRef = (restaurantId) => ref(rtdb, `menus/${restaurantId}/categories`);
const itemsRef = (restaurantId, categoryId) =>
  ref(rtdb, `menus/${restaurantId}/categories/${categoryId}/items`);

export const createRestaurant = async ({ name, eta, fee, thumb }) => {
  const newRef = push(restaurantsRef);
  const restaurant = {
    id: newRef.key,
    name: name || "",
    eta: eta || "",
    fee: Number(fee) || 0,
    thumb: thumb || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await set(newRef, restaurant);
  return restaurant;
};

export const updateRestaurant = async (restaurantId, patch) => {
  if (!restaurantId) throw new Error("Missing restaurant id");
  await update(ref(rtdb, `restaurants/${restaurantId}`), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
};

export const deleteRestaurant = async (restaurantId) => {
  if (!restaurantId) throw new Error("Missing restaurant id");
  await remove(ref(rtdb, `restaurants/${restaurantId}`));
  await remove(ref(rtdb, `menus/${restaurantId}`));
};

export const listenRestaurants = (callback) =>
  onValue(restaurantsRef, (snap) => {
    const val = snap.val() || {};
    callback(Object.values(val));
  });

export const getRestaurant = async (restaurantId) => {
  if (!restaurantId) return null;
  const snap = await get(ref(rtdb, `restaurants/${restaurantId}`));
  return snap.exists() ? snap.val() : null;
};

export const createCategory = async ({ restaurantId, name }) => {
  if (!restaurantId) throw new Error("Missing restaurant id");
  const newRef = push(categoriesRef(restaurantId));
  const category = {
    id: newRef.key,
    name: name || "",
    order: Date.now(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await set(newRef, category);
  return category;
};

export const updateCategory = async (restaurantId, categoryId, patch) => {
  if (!restaurantId || !categoryId) throw new Error("Missing restaurant/category id");
  await update(ref(rtdb, `menus/${restaurantId}/categories/${categoryId}`), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
};

export const deleteCategory = async (restaurantId, categoryId) => {
  if (!restaurantId || !categoryId) throw new Error("Missing restaurant/category id");
  await remove(ref(rtdb, `menus/${restaurantId}/categories/${categoryId}`));
};

export const createMenuItem = async ({
  restaurantId,
  categoryId,
  name,
  price,
  thumb,
  options,
}) => {
  if (!restaurantId || !categoryId) throw new Error("Missing restaurant/category id");
  const newRef = push(itemsRef(restaurantId, categoryId));
  const item = {
    id: newRef.key,
    name: name || "",
    price: Number(price) || 0,
    thumb: thumb || "",
    options: Array.isArray(options) ? options : [],
    isAvailable: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await set(newRef, item);
  return item;
};

export const updateMenuItem = async (restaurantId, categoryId, itemId, patch) => {
  if (!restaurantId || !categoryId || !itemId) {
    throw new Error("Missing restaurant/category/item id");
  }
  await update(ref(rtdb, `menus/${restaurantId}/categories/${categoryId}/items/${itemId}`), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
};

export const deleteMenuItem = async (restaurantId, categoryId, itemId) => {
  if (!restaurantId || !categoryId || !itemId) {
    throw new Error("Missing restaurant/category/item id");
  }
  await remove(ref(rtdb, `menus/${restaurantId}/categories/${categoryId}/items/${itemId}`));
};

export const listenCategoriesWithItems = (restaurantId, callback) =>
  onValue(categoriesRef(restaurantId), (snap) => {
    const val = snap.val() || {};
    const categories = Object.values(val)
      .map((category) => {
      const items = Object.values(category.items || {}).map((item) => ({
        ...item,
        category: category.name || "Menu",
      }));
      return {
        id: category.id,
        name: category.name || "Menu",
        order: category.order || 0,
        items,
      };
      })
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    callback(categories);
  });

export const listenMenus = (callback) =>
  onValue(ref(rtdb, "menus"), (snap) => {
    callback(snap.val() || {});
  });
