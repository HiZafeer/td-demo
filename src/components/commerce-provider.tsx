"use client";

import {
  createCart,
  type Cart,
  type CartApiAdapter,
  type CartClient,
  type CartLine,
  type CartState,
  type FulfilmentContext,
  type StorefrontBootstrap,
  type StorefrontLocation,
} from "@zafeer/cart";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { DemoBootstrapResponse } from "@/lib/types";

type RemoteCartData = {
  cartId?: string;
  locationId?: string;
  items?: Array<Record<string, unknown>>;
  summary?: Record<string, unknown>;
};

type CommerceContextValue = {
  bootstrap: DemoBootstrapResponse;
  state: CartState | null;
  client: CartClient | null;
  commerceEnabled: boolean;
  setCommerceEnabled(enabled: boolean): void;
  setFulfilment(context: FulfilmentContext): Promise<FulfilmentContext>;
  addProduct(productId: string): Promise<Cart>;
  updateQuantity(line: CartLine, quantity: number): Promise<void>;
  removeLine(lineId: string): Promise<void>;
  clearCart(): Promise<void>;
};

const CommerceContext = createContext<CommerceContextValue | null>(null);

function numberValue(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function supportedOrderTypes(location: Record<string, unknown>): Array<"PICKUP" | "DELIVERY" | "DINE_IN"> {
  const values = Array.isArray(location.supportedOrderTypes) ? location.supportedOrderTypes : Array.isArray(location.orderTypes) ? location.orderTypes : ["PICKUP", "DELIVERY"];
  return values.filter((value): value is "PICKUP" | "DELIVERY" | "DINE_IN" => value === "PICKUP" || value === "DELIVERY" || value === "DINE_IN");
}

function toLocation(value: unknown): StorefrontLocation | null {
  if (!value || typeof value !== "object") return null;
  const location = value as Record<string, unknown>;
  const id = stringValue(location.id);
  if (!id) return null;
  return {
    id,
    name: stringValue(location.name) || "Store location",
    active: location.active !== false,
    acceptingOrders: location.acceptingOrders !== false,
    supportedOrderTypes: supportedOrderTypes(location),
    latitude: numberValue(location.latitude) || undefined,
    longitude: numberValue(location.longitude) || undefined,
    timezone: stringValue(location.timezone) || undefined,
    businessHours: location.businessHours,
    deliveryZones: Array.isArray(location.deliveryZones) ? location.deliveryZones : undefined,
  };
}

function toCart(remote: RemoteCartData, businessId: string, currency: string): Cart {
  const items = (remote.items ?? []).map((item): CartLine => {
    const pricing = (item.pricing && typeof item.pricing === "object" ? item.pricing : {}) as Record<string, unknown>;
    const quantity = numberValue(item.quantity) || 1;
    const unitPrice = numberValue(pricing.basePrice ?? pricing.price ?? pricing.unitPrice);
    const lineTotal = numberValue(pricing.lineTotal ?? pricing.total) || unitPrice * quantity;
    return {
      id: stringValue(item.cartItemId ?? item.id),
      productId: stringValue(item.itemId ?? item.productId),
      name: stringValue(item.name) || "Menu item",
      quantity,
      imageUrl: stringValue(item.imageUrl) || undefined,
      unitPrice: { amount: unitPrice, currency },
      lineTotal: { amount: lineTotal, currency },
      modifiers: (Array.isArray(item.selectedModifierIds) ? item.selectedModifierIds : []).map((optionId) => ({ groupId: "remote", optionId: String(optionId) })),
      instructions: stringValue(item.instructions) || undefined,
    };
  });
  const summary = remote.summary ?? {};
  const total = numberValue(summary.cartTotal) || items.reduce((amount, item) => amount + item.lineTotal.amount, 0);
  return {
    id: stringValue(remote.cartId),
    businessId,
    locationId: stringValue(remote.locationId) || undefined,
    items,
    subtotal: { amount: total, currency },
    total: { amount: total, currency },
    updatedAt: new Date().toISOString(),
  };
}

async function responseData(response: Response): Promise<RemoteCartData> {
  const body = await response.json() as { success?: boolean; message?: string; data?: RemoteCartData };
  if (!response.ok || body.success === false || !body.data) throw new Error(body.message || "Cart request failed.");
  return { ...body.data, cartId: body.data.cartId || response.headers.get("x-cart-id") || undefined };
}

function createAdapter(initial: DemoBootstrapResponse, enabled: boolean): CartApiAdapter {
  const locations = initial.locations.map(toLocation).filter((location): location is StorefrontLocation => Boolean(location));
  return {
    async bootstrap() {
      const response = await fetch(`/api/bootstrap?enabled=${enabled}`);
      if (!response.ok) throw new Error("Unable to load storefront settings.");
      const data = await response.json() as DemoBootstrapResponse;
      return { enabled: data.enabled, businessId: data.businessId, currency: data.currency, locations, supportedOrderTypes: ["PICKUP", "DELIVERY"] } satisfies StorefrontBootstrap;
    },
    async getCart({ cartId }) {
      const response = await fetch("/api/cart", { headers: { "X-Cart-Id": cartId } });
      if (response.status === 404) return null;
      return toCart(await responseData(response), initial.businessId, initial.currency);
    },
    async addItem({ cartId, item, fulfilment }) {
      const response = await fetch("/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(cartId ? { "X-Cart-Id": cartId } : {}) },
        body: JSON.stringify({ locationId: fulfilment.locationId, itemId: item.productId, quantity: item.quantity, selectedModifierIds: item.modifiers?.map((modifier) => modifier.optionId) ?? [], instructions: item.instructions ?? "" }),
      });
      return toCart(await responseData(response), initial.businessId, initial.currency);
    },
    async updateItem({ cartId, lineId, quantity, line }) {
      const response = await fetch(`/api/cart/items/${encodeURIComponent(lineId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Cart-Id": cartId },
        body: JSON.stringify({ quantity, selectedModifierIds: line?.modifiers.map((modifier) => modifier.optionId) ?? [], instructions: line?.instructions ?? "" }),
      });
      return toCart(await responseData(response), initial.businessId, initial.currency);
    },
    async removeItem({ cartId, lineId }) {
      const response = await fetch(`/api/cart/items/${encodeURIComponent(lineId)}`, { method: "DELETE", headers: { "X-Cart-Id": cartId } });
      return toCart(await responseData(response), initial.businessId, initial.currency);
    },
    async clearCart({ cartId }) {
      const response = await fetch("/api/cart", { method: "DELETE", headers: { "X-Cart-Id": cartId } });
      if (!response.ok) throw new Error("Unable to clear cart.");
    },
    async validateFulfilment({ context }) {
      const location = locations.find((candidate) => candidate.id === context.locationId);
      if (!location || !location.active || !location.acceptingOrders) throw new Error("This location is not accepting orders.");
      if (!location.supportedOrderTypes.includes(context.orderType)) throw new Error("This order type is unavailable at the selected location.");
      if (context.orderType === "DELIVERY" && !context.deliveryAddress) throw new Error("A delivery address is required.");
      return context;
    },
  };
}

export function CommerceProvider({ bootstrap, children }: { bootstrap: DemoBootstrapResponse; children: ReactNode }) {
  const [commerceEnabled, setCommerceEnabled] = useState(true);
  const [state, setState] = useState<CartState | null>(null);
  const clientRef = useRef<CartClient | null>(null);

  useEffect(() => {
    const client = createCart({ businessId: bootstrap.businessId, storefront: "demo-food-papa", adapter: createAdapter(bootstrap, commerceEnabled) });
    clientRef.current = client;
    const unsubscribe = client.subscribe(setState);
    void client.initialize().catch((error: unknown) => console.error("Cart bootstrap failed", error));
    return () => { unsubscribe(); client.destroy(); if (clientRef.current === client) clientRef.current = null; };
  }, [bootstrap, commerceEnabled]);

  const requireClient = useCallback(() => {
    if (!clientRef.current) throw new Error("Cart is still loading.");
    return clientRef.current;
  }, []);

  const value = useMemo<CommerceContextValue>(() => ({
    bootstrap,
    state,
    client: clientRef.current,
    commerceEnabled,
    setCommerceEnabled,
    setFulfilment: (context) => requireClient().setFulfilment(context),
    addProduct: (productId) => requireClient().addItem({ productId, quantity: 1 }),
    updateQuantity: async (line, quantity) => { await requireClient().updateQuantity(line.id, quantity); await requireClient().flush(); },
    removeLine: (lineId) => requireClient().removeItem(lineId).then(() => undefined),
    clearCart: () => requireClient().clear(),
  }), [bootstrap, commerceEnabled, requireClient, state]);

  return <CommerceContext.Provider value={value}>{children}</CommerceContext.Provider>;
}

export function useCommerce() {
  const context = useContext(CommerceContext);
  if (!context) throw new Error("useCommerce must be used inside CommerceProvider.");
  return context;
}
