import { create } from "zustand";

export type BucketModifier = { id: string; name: string; priceDelta: number };

export type BucketItem = {
  key: string;
  itemId: string;
  name: string;
  nameUr?: string | null;
  basePrice: number;
  image?: string | null;
  quantity: number;
  modifiers: BucketModifier[];
  note?: string;
};

type BucketState = {
  items: BucketItem[];
  orderType: "delivery" | "pickup";
  selectedCity: string;
  selectedBranch: string;
  isCartOpen: boolean;
  activeItemModal: any | null;
  isLocationModalOpen: boolean;
  isLoginModalOpen: boolean;
  isCheckoutModalOpen: boolean;
  orderSuccess: any | null;

  // Actions
  addItem: (item: Omit<BucketItem, "key">) => void;
  updateQty: (key: string, qty: number) => void;
  removeItem: (key: string) => void;
  clearBucket: () => void;
  setOrderType: (type: "delivery" | "pickup") => void;
  setLocation: (city: string, branch: string) => void;
  toggleCart: (open?: boolean) => void;
  openItemModal: (item: any) => void;
  closeItemModal: () => void;
  toggleLocationModal: (open?: boolean) => void;
  toggleLoginModal: (open?: boolean) => void;
  toggleCheckoutModal: (open?: boolean) => void;
  setOrderSuccess: (order: any | null) => void;
};

export const useCustomerBucket = create<BucketState>((set) => ({
  items: [],
  orderType: "delivery",
  selectedCity: "Lahore",
  selectedBranch: "DHA Phase 5",
  isCartOpen: false,
  activeItemModal: null,
  isLocationModalOpen: false,
  isLoginModalOpen: false,
  isCheckoutModalOpen: false,
  orderSuccess: null,

  addItem: (item) =>
    set((state) => {
      // Check if identical item with identical modifiers exists
      const modSig = (mods: BucketModifier[]) =>
        mods
          .map((m) => m.id)
          .sort()
          .join(",");
      const existing = state.items.find(
        (i) => i.itemId === item.itemId && modSig(i.modifiers) === modSig(item.modifiers)
      );

      if (existing) {
        return {
          items: state.items.map((i) =>
            i.key === existing.key ? { ...i, quantity: i.quantity + item.quantity } : i
          ),
          isCartOpen: true,
        };
      }

      return {
        items: [...state.items, { ...item, key: crypto.randomUUID() }],
        isCartOpen: true,
      };
    }),

  updateQty: (key, qty) =>
    set((state) => ({
      items:
        qty <= 0
          ? state.items.filter((i) => i.key !== key)
          : state.items.map((i) => (i.key === key ? { ...i, quantity: qty } : i)),
    })),

  removeItem: (key) =>
    set((state) => ({
      items: state.items.filter((i) => i.key !== key),
    })),

  clearBucket: () => set({ items: [] }),

  setOrderType: (orderType) => set({ orderType }),

  setLocation: (selectedCity, selectedBranch) => set({ selectedCity, selectedBranch }),

  toggleCart: (open) =>
    set((state) => ({ isCartOpen: open !== undefined ? open : !state.isCartOpen })),

  openItemModal: (activeItemModal) => set({ activeItemModal }),
  closeItemModal: () => set({ activeItemModal: null }),

  toggleLocationModal: (open) =>
    set((state) => ({
      isLocationModalOpen: open !== undefined ? open : !state.isLocationModalOpen,
    })),

  toggleLoginModal: (open) =>
    set((state) => ({
      isLoginModalOpen: open !== undefined ? open : !state.isLoginModalOpen,
    })),

  toggleCheckoutModal: (open) =>
    set((state) => ({
      isCheckoutModalOpen: open !== undefined ? open : !state.isCheckoutModalOpen,
    })),

  setOrderSuccess: (orderSuccess) => set({ orderSuccess }),
}));
