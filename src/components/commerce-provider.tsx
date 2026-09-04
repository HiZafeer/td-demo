"use client";

import {
  createOrderSdk,
  TossdownCartError,
  type Cart,
  type CartEvent,
  type CartLineInput,
  type CartState,
  type FulfilmentContext,
  type GeocodingClient,
  type OrderSDK,
  type StorefrontLocation,
} from "@ordrz/orders-sdk";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { DemoBootstrapResponse } from "@/lib/types";

export type DemoOrderType = "PICKUP" | "DELIVERY" | "DINE_IN";
export type DemoFulfilment = Partial<{
  orderType: DemoOrderType;
  locationId: string;
  scheduledAt: "ASAP" | string;
  deliveryZoneId: string | null;
  deliveryAddress: { label?: string; addressLine1?: string; addressLine2?: string; latitude?: number; longitude?: number; city?: string; state?: string; country?: string; postalCode?: string } | null;
  scheduleSlots: Array<{ value: string; label?: string; available?: boolean }>;
}>;
export type DemoCartLine = { id: string; productId: string; name: string; quantity: number; unitPrice: number; lineTotal: number; imageUrl?: string; modifiers: string[] };
export type DemoCart = { id: string; items: DemoCartLine[]; total: number };
export type ActivityLog = { id: number; time: string; source: "sdk"; action: string; status: "info" | "success" | "error"; detail: string };
export type DemoCustomerDetails = { name: string; phone: string; email: string };

type CommerceContextValue = {
  bootstrap: DemoBootstrapResponse;
  locations: StorefrontLocation[];
  state: { bootstrap: DemoBootstrapResponse; cart: DemoCart; fulfilment: DemoFulfilment | null; sdkStatus: "idle" | "loading" | "ready" | "error" };
  logs: ActivityLog[];
  clearLogs(): void;
  recordSdk(action: string, status: ActivityLog["status"], detail: string): void;
  order: OrderSDK | null;
  setFulfilment(context: DemoFulfilment): Promise<DemoFulfilment>;
  clearFulfilment(): void;
  addProduct(productId: string, modifiersSelected?: boolean): Promise<DemoCart>;
  validateOrder(customerDetails: DemoCustomerDetails): Promise<unknown>;
  placeOrder(customerDetails: DemoCustomerDetails): Promise<unknown>;
  updateQuantity(line: DemoCartLine, quantity: number): Promise<void>;
  removeLine(lineId: string): Promise<void>;
  clearCart(): Promise<void>;
};

const CommerceContext = createContext<CommerceContextValue | null>(null);

function numberValue(value: unknown): number { const number = typeof value === "number" ? value : Number(value); return Number.isFinite(number) ? number : 0; }
function stringValue(value: unknown): string { return typeof value === "string" ? value : ""; }
function deliverySettingsValue(value: unknown): StorefrontLocation["deliverySettings"] {
  const normalized = stringValue(value).toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "area") return "area";
  if (["geo_range", "geo", "georange", "radius"].includes(normalized)) return "geoRange";
  return null;
}
function errorDetail(error: unknown): string {
  if (error instanceof TossdownCartError) {
    // Activity is an operational summary, not a payload inspector. Keep SDK
    // reason codes and human-readable responses while avoiding API/cart data.
    return `${error.code}: ${error.message}`;
  }
  return error instanceof Error ? error.message : "The operation was rejected.";
}
function responseReference(value: unknown): string {
  if (!value || typeof value !== "object") return "Order response received";
  const record = value as Record<string, unknown>;
  const data = record.data && typeof record.data === "object" ? record.data as Record<string, unknown> : {};
  const orderNumber = stringValue(record.orderNumber ?? data.orderNumber ?? record.number ?? data.number);
  const orderId = stringValue(record.orderId ?? data.orderId ?? record.id ?? data.id);
  if (orderNumber) return `Order response received · #${orderNumber}`;
  if (orderId) return `Order response received · order=${orderId}`;
  return "Order response received";
}
function elapsed(startedAt: number): string { return `${Math.round((typeof performance === "undefined" ? Date.now() : performance.now()) - startedAt)}ms`; }
function toLocation(value: unknown, fallbackBusinessId = ""): StorefrontLocation | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id = stringValue(raw.id);
  if (!id) return null;
  const types = Array.isArray(raw.supportedOrderTypes) ? raw.supportedOrderTypes : ["PICKUP", "DELIVERY"];
  const deliveryZones = (Array.isArray(raw.deliveryZones) ? raw.deliveryZones : []) as NonNullable<StorefrontLocation["deliveryZones"]>;
  // This Demo exposes configured zones as area/sub-region delivery when the
  // public payload omits the mode, so Checkout MFE must receive the explicit
  // canonical value instead of entering geo-address search.
  const deliverySettings = deliverySettingsValue(raw.deliverySettings) ?? (deliveryZones.length > 0 ? "area" : null);
  return { id, businessId: stringValue(raw.businessId) || fallbackBusinessId, name: stringValue(raw.name) || "Store location", slug: stringValue(raw.slug) || id, active: raw.active !== false, isActive: raw.isActive !== false, isOpen: raw.isOpen === null ? null : raw.isOpen !== false, acceptingOrders: raw.acceptingOrders !== false, supportedOrderTypes: types.filter((type): type is DemoOrderType => type === "PICKUP" || type === "DELIVERY" || type === "DINE_IN"), addressLine1: stringValue(raw.addressLine1) || stringValue(raw.address), addressLine2: stringValue(raw.addressLine2), city: stringValue(raw.city), state: stringValue(raw.state), country: stringValue(raw.country), postalCode: stringValue(raw.postalCode), currency: stringValue(raw.currency), deliverySettings, latitude: numberValue(raw.latitude) || undefined, longitude: numberValue(raw.longitude) || undefined, businessHours: raw.businessHours, deliveryZones };
}
function toDemoCart(cart: Cart | null): DemoCart {
  if (!cart) return { id: "", items: [], total: 0 };
  return { id: cart.id, items: cart.items.map((item) => ({ id: item.id, productId: item.productId, name: item.name, quantity: item.quantity, unitPrice: item.unitPrice.amount, lineTotal: item.lineTotal.amount, imageUrl: item.imageUrl, modifiers: item.modifiers.map((modifier) => modifier.optionId) })), total: cart.total.amount };
}

const demoGeocoder: GeocodingClient = {
  async search(query, options) {
    const response = await fetch(`/api/storefront/geocode?q=${encodeURIComponent(query.trim())}`, { cache: "no-store", signal: options?.signal });
    const payload = await response.json().catch(() => null) as { data?: unknown[]; message?: string } | null;
    if (!response.ok) throw new Error(payload?.message || "Address search is unavailable right now.");
    return Array.isArray(payload?.data) ? payload.data.filter((value): value is import("@ordrz/orders-sdk").GeocodingResult => Boolean(value && typeof value === "object" && typeof (value as Record<string, unknown>).label === "string" && Number.isFinite(Number((value as Record<string, unknown>).latitude)) && Number.isFinite(Number((value as Record<string, unknown>).longitude)))) : [];
  },
  async reverse(latitude, longitude, options) {
    const params = new URLSearchParams({ lat: String(latitude), lon: String(longitude) });
    const response = await fetch(`/api/storefront/reverse-geocode?${params.toString()}`, { cache: "no-store", signal: options?.signal });
    const payload = await response.json().catch(() => null) as { data?: unknown; message?: string } | null;
    if (!response.ok) throw new Error(payload?.message || "We couldn’t resolve that pin location.");
    const value = payload?.data;
    return value && typeof value === "object" && typeof (value as Record<string, unknown>).label === "string" ? value as import("@ordrz/orders-sdk").GeocodingResult : null;
  },
};

function sdkEventDetail(event: CartEvent): string {
  switch (event.type) {
    case "cart:ready":
      return `Cart runtime ready · cart=${event.state.cart?.id || "empty"}`;
    case "cart:changed":
      return `Cart response received · ${event.cart?.items.length ?? 0} line(s) · total=${event.cart?.total.amount ?? 0}`;
    case "cart:item-added":
      return `Added ${event.line.name} ×${event.line.quantity} · total=${event.cart.total.amount}`;
    case "cart:item-removed":
      return `Removed line ${event.lineId}`;
    case "cart:cleared":
      return `Cart cleared · reason=${event.reason}`;
    case "fulfilment:changed":
      return `Fulfilment accepted · ${event.context.orderType} · location=${event.context.locationId}`;
    case "cart:expired":
      return "Persisted cart expired; SDK cleared the local cart reference";
    case "cart:error":
      return errorDetail(event.error);
  }
}

export function CommerceProvider({ bootstrap, children }: { bootstrap: DemoBootstrapResponse; children: ReactNode }) {
  const [cart, setCart] = useState<DemoCart>({ id: "", items: [], total: 0 });
  const [fulfilment, setFulfilmentState] = useState<DemoFulfilment | null>(null);
  const [sdkStatus, setSdkStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const sdkRef = useRef<OrderSDK | null>(null);
  const availableLocations = useMemo(() => bootstrap.locations.map((value) => toLocation(value, bootstrap.businessId)).filter((location): location is StorefrontLocation => Boolean(location)), [bootstrap.businessId, bootstrap.locations]);
  const logId = useRef(0);
  const log = useCallback((action: string, status: ActivityLog["status"], detail: string) => {
    setLogs((current) => [...current.slice(-99), { id: logId.current++, time: new Date().toLocaleTimeString(), source: "sdk", action, status, detail }]);
  }, []);
  const logRef = useRef(log);
  logRef.current = log;

  useEffect(() => {
    setSdkStatus("loading");
    log("initialize", "info", "Creating Order SDK cart runtime");
    const sdk = createOrderSdk({ businessId: bootstrap.businessId, storefront: "demo-food-papa", products: bootstrap.products.map((product) => ({ id: product.id, name: product.name, imageUrl: product.imageUrl })), isolation: "shadow", currency: bootstrap.currency, locations: availableLocations, geocoder: demoGeocoder, cartEnabled: true, onTelemetry: (event) => { if (event.name === "sdk_operation") logRef.current(event.operation, event.status === "error" ? "error" : "success", event.reasonCode ? `SDK response · ${event.reasonCode}` : "SDK response accepted"); }, onCartEvent: (event) => logRef.current(event.type, event.type === "cart:error" ? "error" : "success", sdkEventDetail(event)) });
    sdkRef.current = sdk;
    const unsubscribe = sdk.subscribe((next: CartState) => { setCart(toDemoCart(next.cart)); setFulfilmentState(next.fulfilment as DemoFulfilment | null); });
    void sdk.initialize().then((initialState) => { if (!initialState) throw new Error("SDK cart runtime was not created"); setSdkStatus("ready"); logRef.current("initialize", "success", "Order SDK is ready"); }).catch((error: unknown) => { setSdkStatus("error"); logRef.current("initialize", "error", error instanceof Error ? error.message : "SDK initialization failed"); });
    return () => { unsubscribe(); sdk.destroy(); sdkRef.current = null; };
  }, [availableLocations, bootstrap, log]);

  const requireOrder = useCallback(() => { const order = sdkRef.current; if (!order) throw new Error("Order SDK is still initializing."); return order; }, []);
  const setFulfilment = useCallback(async (context: DemoFulfilment) => {
    const startedAt = typeof performance === "undefined" ? Date.now() : performance.now();
    try {
      const sdkContext: FulfilmentContext = {
        orderType: context.orderType ?? "PICKUP",
        locationId: context.locationId ?? "",
        scheduledAt: context.scheduledAt ?? "",
        deliveryZoneId: context.deliveryZoneId,
        deliveryAddress: context.deliveryAddress
          ? {
              label: context.deliveryAddress.label ?? "",
              addressLine1: context.deliveryAddress.addressLine1,
              addressLine2: context.deliveryAddress.addressLine2,
              latitude: context.deliveryAddress.latitude ?? Number.NaN,
              longitude: context.deliveryAddress.longitude ?? Number.NaN,
              city: context.deliveryAddress.city,
              state: context.deliveryAddress.state,
              country: context.deliveryAddress.country,
              postalCode: context.deliveryAddress.postalCode,
            }
          : context.deliveryAddress,
        scheduleSlots: context.scheduleSlots,
      };
      const result = await requireOrder().setFulfilment(sdkContext);
      setFulfilmentState(result as DemoFulfilment);
      log("setFulfilment", "success", `Fulfilment accepted in ${elapsed(startedAt)} · ${result.orderType} · location=${result.locationId}`);
      return result as DemoFulfilment;
    } catch (error) { log("setFulfilment", "error", `${errorDetail(error)} · elapsed=${elapsed(startedAt)}`); throw error; }
  }, [log, requireOrder]);
  const clearFulfilment = useCallback(() => {
    try {
      sdkRef.current?.clearFulfilment();
      setFulfilmentState(null);
      log("clearFulfilment", "success", "Fulfilment context cleared by the SDK");
    } catch (error) {
      log("clearFulfilment", "error", errorDetail(error));
      throw error;
    }
  }, [log]);
  const addProduct = useCallback(async (productId: string, modifiersSelected = false) => {
    const startedAt = typeof performance === "undefined" ? Date.now() : performance.now();
    const product = bootstrap.products.find((candidate) => candidate.id === productId);
    if (!product) throw new Error("Product was not found.");
    const input: CartLineInput = { productId, quantity: 1, imageUrl: product.imageUrl, ...(product.hasModifiers ? { modifierGroups: [{ id: "required", required: true, minSelections: 1, options: [{ id: "demo-choice", available: true }] }], modifiers: modifiersSelected ? [{ groupId: "required", optionId: "demo-choice" }] : [] } : {}) };
    try { const next = await requireOrder().addItem(input); const nextCart = toDemoCart(next); setCart(nextCart); log("addItem", "success", `${product.name} added in ${elapsed(startedAt)} · ${nextCart.items.length} line(s) · total=${nextCart.total}`); return nextCart; } catch (error) { log("addItem", "error", `${errorDetail(error)} · elapsed=${elapsed(startedAt)}`); throw error; }
  }, [bootstrap.products, log, requireOrder]);
  const placeOrder = useCallback(async (customerDetails: DemoCustomerDetails) => {
    try {
      const sdk = sdkRef.current;
      if (!sdk) throw new Error("Order SDK is still initializing.");
      const result = await sdk.placeOrder({ cartId: cart.id, orderType: fulfilment?.orderType, deliveryZoneId: fulfilment?.deliveryZoneId ?? undefined, customerDetails, paymentType: "CASH_ON_DELIVERY" });
      log("placeOrder", "success", `${responseReference(result)} · accepted by SDK`);
      sdk.clearLocalAfterOrder();
      return result;
    } catch (error) { log("placeOrder", "error", errorDetail(error)); throw error; }
  }, [cart.id, fulfilment, log]);
  const validateOrder = useCallback(async (customerDetails: DemoCustomerDetails) => {
    const startedAt = typeof performance === "undefined" ? Date.now() : performance.now();
    try {
      const sdk = sdkRef.current;
      if (!sdk) throw new Error("Order SDK is still initializing.");
      const result = await sdk.validateOrder({ cartId: cart.id, orderType: fulfilment?.orderType, deliveryZoneId: fulfilment?.deliveryZoneId ?? undefined, customerDetails, paymentType: "CASH_ON_DELIVERY" });
      log("validateOrder", "success", `Payload normalized in ${elapsed(startedAt)} · ready for order API`);
      return result;
    } catch (error) { log("validateOrder", "error", `${errorDetail(error)} · elapsed=${elapsed(startedAt)}`); throw error; }
  }, [cart.id, fulfilment, log]);
  const updateQuantity = useCallback(async (line: DemoCartLine, quantity: number) => { const startedAt = typeof performance === "undefined" ? Date.now() : performance.now(); try { const sdk = requireOrder(); await sdk.updateQuantity(line.id, quantity); await sdk.flush(); const next = sdk.getState()?.cart; log("updateQuantity", "success", `Quantity updated in ${elapsed(startedAt)} · total=${next?.total?.amount ?? 0}`); } catch (error) { log("updateQuantity", "error", `${errorDetail(error)} · elapsed=${elapsed(startedAt)}`); throw error; } }, [log, requireOrder]);
  const removeLine = useCallback(async (lineId: string) => { const startedAt = typeof performance === "undefined" ? Date.now() : performance.now(); try { await requireOrder().removeItem(lineId); log("removeItem", "success", `Item removed in ${elapsed(startedAt)} · cart state updated`); } catch (error) { log("removeItem", "error", `${errorDetail(error)} · elapsed=${elapsed(startedAt)}`); throw error; } }, [log, requireOrder]);
  const clearCart = useCallback(async () => { const startedAt = typeof performance === "undefined" ? Date.now() : performance.now(); try { await requireOrder().clearCart(); log("clear", "success", `Cart cleared in ${elapsed(startedAt)} · cart state reset`); } catch (error) { log("clear", "error", `${errorDetail(error)} · elapsed=${elapsed(startedAt)}`); throw error; } }, [log, requireOrder]);
  const clearLogs = useCallback(() => setLogs([]), []);
  const state = useMemo(() => ({ bootstrap, cart, fulfilment, sdkStatus }), [bootstrap, cart, fulfilment, sdkStatus]);
  const value = useMemo<CommerceContextValue>(() => ({ bootstrap, locations: availableLocations, state, logs, clearLogs, recordSdk: log, order: sdkRef.current, setFulfilment, clearFulfilment, addProduct, validateOrder, placeOrder, updateQuantity, removeLine, clearCart }), [addProduct, availableLocations, bootstrap, clearCart, clearFulfilment, clearLogs, log, logs, placeOrder, removeLine, setFulfilment, state, updateQuantity, validateOrder]);
  return <CommerceContext.Provider value={value}>{children}</CommerceContext.Provider>;
}

export function useCommerce() { const context = useContext(CommerceContext); if (!context) throw new Error("useCommerce must be used inside CommerceProvider."); return context; }
