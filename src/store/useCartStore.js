import { create } from "zustand";

const money = (n) => Math.round(n * 100) / 100;

export const useCartStore = create((set, get) => ({
  restaurant: null, // { id, name }
  runner: null, // { id, name }
  items: [], // [{ id, cartId, name, price, qty, thumb, options }]

  addItem: (restaurant, item) => {
    const { restaurant: currentRestaurant, items } = get();

    if (currentRestaurant && currentRestaurant.id !== restaurant.id && items.length > 0) {
      return false;
    }

    const itemKey = item.cartId || item.id;
    const existing = items.find((x) => (x.cartId || x.id) === itemKey);
    if (existing) {
      set({
        restaurant,
        items: items.map((x) =>
          (x.cartId || x.id) === itemKey ? { ...x, qty: x.qty + 1 } : x
        ),
      });
    } else {
      set({ restaurant, items: [...items, { ...item, cartId: itemKey, qty: 1 }] });
    }
    return true;
  },

  inc: (id) =>
    set({
      items: get().items.map((x) =>
        (x.cartId || x.id) === id ? { ...x, qty: x.qty + 1 } : x
      ),
    }),

  dec: (id) =>
    set({
      items: get()
        .items.map((x) =>
          (x.cartId || x.id) === id ? { ...x, qty: x.qty - 1 } : x
        )
        .filter((x) => x.qty > 0),
      restaurant: get().items.length === 1 ? null : get().restaurant,
    }),

  removeItem: (id) =>
    set({
      items: get().items.filter((x) => (x.cartId || x.id) !== id),
      restaurant: get().items.length === 1 ? null : get().restaurant,
    }),

  setRunner: (runner) => set({ runner }),

  clearCart: () => set({ restaurant: null, items: [], runner: null }),

  subtotal: () => money(get().items.reduce((sum, x) => sum + x.price * x.qty, 0)),
}));
