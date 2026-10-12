import { manualProvider } from "./manual";
import { mockGateway } from "./mock-gateway";
import type { PaymentProvider, PayMethod } from "./types";

export * from "./types";
export { manualProvider };

/** Registered providers. Add a real gateway here after writing its adapter (see mock-gateway.ts). */
export const PROVIDERS: PaymentProvider[] = [
  manualProvider,
  mockGateway("mock-wallet", "Mock wallet gateway (testing)", ["jazzcash", "easypaisa"]),
  mockGateway("mock-card", "Mock card terminal (testing)", ["card"]),
  mockGateway("mock-raast", "Mock Raast QR (testing)", ["raast"]),
];

export const getProvider = (id: string | null | undefined): PaymentProvider => PROVIDERS.find((p) => p.id === id) ?? manualProvider;
export const providersFor = (method: PayMethod) => PROVIDERS.filter((p) => p.methods.includes(method));
