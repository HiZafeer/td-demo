import type { DemoBootstrapResponse, DemoProduct } from "@/lib/types";

const API_BASE = "https://apiv2.ordrz.com/api/v1";
const PUBLIC_BASE = `${API_BASE}/public`;
// Nova derives this from foodpapa1.live.ordrz.store. Keep a matching local
// fallback for this independent demo, while still allowing .env.local overrides.
const DEFAULT_STOREFRONT = "foodpapa1";

type AnyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AnyRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(...values: unknown[]): string {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim() ?? "";
}

function numberValue(...values: unknown[]): number {
  for (const value of values) {
    const parsed = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function unwrapItems(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return [];
  for (const key of ["items", "products", "locations", "data", "results"]) {
    const candidate = value[key];
    if (Array.isArray(candidate)) return candidate;
    if (isRecord(candidate)) {
      const nested = unwrapItems(candidate);
      if (nested.length) return nested;
    }
  }
  return [];
}

function parseProduct(value: unknown, currency: string): DemoProduct | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id, value.itemId, value.productId, value.uuid);
  const name = stringValue(value.name, value.title, value.itemName);
  if (!id || !name) return null;
  const pricing = isRecord(value.pricing) ? value.pricing : {};
  const modifiers = asArray(value.modifiers).length || asArray(value.optionSets).length || asArray(value.modifierGroups).length;
  return {
    id,
    name,
    description: stringValue(value.description, value.shortDescription),
    imageUrl: stringValue(value.imageUrl, value.image, value.thumbnailUrl, value.photoUrl) || undefined,
    price: numberValue(value.price, value.basePrice, value.salePrice, pricing.price, pricing.basePrice),
    currency,
    hasModifiers: Boolean(modifiers),
  };
}

async function fetchJson(url: string) {
  const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!response.ok) throw new Error(`Storefront request failed (${response.status}).`);
  return response.json() as Promise<unknown>;
}

export function publicCartUrl() { return `${PUBLIC_BASE}/cart`; }
export function publicCartItemsUrl() { return `${PUBLIC_BASE}/cart/items`; }
export function publicCartItemUrl(id: string) { return `${PUBLIC_BASE}/cart/items/${encodeURIComponent(id)}`; }

export async function loadDemoBootstrap(): Promise<DemoBootstrapResponse> {
  const username = process.env.STOREFRONT_USERNAME || DEFAULT_STOREFRONT;
  const storefrontRaw = await fetchJson(`${PUBLIC_BASE}/storefront/username/${encodeURIComponent(username)}`);
  const storefrontEnvelope = isRecord(storefrontRaw) ? storefrontRaw : {};
  const storefront = isRecord(storefrontEnvelope.data) ? storefrontEnvelope.data : storefrontEnvelope;
  const business = isRecord(storefront.business) ? storefront.business : {};
  const businessId = stringValue(business.id, storefront.businessId, storefront.business_id);
  if (!businessId) throw new Error("The storefront response did not include a business ID.");

  const locationsRaw = await fetchJson(`${PUBLIC_BASE}/locations/business/${encodeURIComponent(businessId)}?include=deliveryZones&page=1&pageSize=20`);
  const locationsEnvelope = isRecord(locationsRaw) ? locationsRaw : {};
  const locations = unwrapItems(locationsEnvelope.data ?? locationsEnvelope);
  const primaryLocation = locations.find((location) => isRecord(location) && location.active !== false) ?? locations[0];
  const locationId = isRecord(primaryLocation) ? stringValue(primaryLocation.id) : "";
  const productParams = new URLSearchParams({ page: "1", pageSize: "48", include: "modifiers" });
  if (locationId) productParams.set("locationId", locationId);
  const productsRaw = await fetchJson(`${API_BASE}/business/${encodeURIComponent(businessId)}/products?${productParams}`);
  const currency = stringValue(
    isRecord(primaryLocation) ? primaryLocation.currency : undefined,
    storefront.currency,
    business.currency,
    "CAD",
  );
  const products = unwrapItems(productsRaw).map((item) => parseProduct(item, currency)).filter((item): item is DemoProduct => Boolean(item));

  return {
    enabled: true,
    businessId,
    businessName: stringValue(business.name, storefront.businessName, storefront.name, username),
    currency,
    logoUrl: stringValue(storefront.logoUrl, business.logoUrl) || undefined,
    locations,
    products,
  };
}
