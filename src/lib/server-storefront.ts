import type { DemoBootstrapResponse, DemoProduct } from "@/lib/types";
import { createHttpStorefrontTransport, createOrdrzApiPaths } from "@ordrz/orders-sdk";

// The SDK owns the canonical Ordrz base. The Demo only uses this server-side
// alias for its SSR bootstrap and same-origin compatibility BFF routes.
// The SDK is the single owner of the Ordrz API origin and endpoint map. The
// Demo's server routes only proxy through this imported map for same-origin
// compatibility; they do not define or override the API base themselves.
export const ORDRZ_PATHS = createOrdrzApiPaths();
const storefrontTransport = createHttpStorefrontTransport();
// Nova derives this from foodpapa1.live.ordrz.store. Keep a matching local
// fallback for this independent demo, while still allowing .env.local overrides.
// const DEFAULT_STOREFRONT = "xo-chinese-chips";
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

export function publicCartUrl() { return ORDRZ_PATHS.public.cart(); }
export function publicCartItemsUrl() { return ORDRZ_PATHS.public.cartItems(); }
export function publicCartItemUrl(id: string) { return ORDRZ_PATHS.public.cartItem(id); }
export function publicCartCalculateUrl() { return ORDRZ_PATHS.public.cartCalculate(); }

export async function loadDemoBootstrap(): Promise<DemoBootstrapResponse> {
  const username = process.env.STOREFRONT_USERNAME || DEFAULT_STOREFRONT;
  const storefrontRaw = await storefrontTransport.getByUsername(username);
  const storefrontEnvelope = isRecord(storefrontRaw) ? storefrontRaw : {};
  const storefront = isRecord(storefrontEnvelope.data) ? storefrontEnvelope.data : storefrontEnvelope;
  const business = isRecord(storefront.business) ? storefront.business : {};
  const integrations = isRecord(storefront.integrations) ? storefront.integrations : {};
  const googleMaps = isRecord(integrations.googleMaps) ? integrations.googleMaps : {};
  const googleMapsApiKey = googleMaps.enabled === true
    ? stringValue(googleMaps.browserApiKey)
    : stringValue(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
  const businessId = stringValue(business.id, storefront.businessId, storefront.business_id);
  if (!businessId) throw new Error("The storefront response did not include a business ID.");

  const locationsRaw = await storefrontTransport.getLocations(businessId);
  const locationsEnvelope = isRecord(locationsRaw) ? locationsRaw : {};
  const locations = unwrapItems(locationsEnvelope.data ?? locationsEnvelope);
  const primaryLocation = locations.find((location) => isRecord(location) && location.active !== false) ?? locations[0];
  const locationId = isRecord(primaryLocation) ? stringValue(primaryLocation.id) : "";
  const productParams = new URLSearchParams({ page: "1", pageSize: "48", include: "modifiers" });
  if (locationId) productParams.set("locationId", locationId);
  const productsRaw = await storefrontTransport.getProducts(businessId, Object.fromEntries(productParams.entries()));
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
    maps: googleMapsApiKey
      ? { provider: "google", googleMapsApiKey }
      : { provider: "openstreetmap" },
    locations,
    products,
  };
}
