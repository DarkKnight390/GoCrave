import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useUiStore = create(
  persist(
    (set) => ({
      filtersOpen: {
        home: false,
        restaurants: false,
      },
      setFiltersOpen: (key, value) =>
        set((state) => ({
          filtersOpen: {
            ...state.filtersOpen,
            [key]: value,
          },
        })),
    }),
    {
      name: "gocrave-ui",
      partialize: (state) => ({ filtersOpen: state.filtersOpen }),
    }
  )
);
