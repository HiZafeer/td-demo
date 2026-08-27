import { NextRequest, NextResponse } from "next/server";
import { loadDemoBootstrap } from "@/lib/server-storefront";

type NominatimResult = {
  display_name?: string;
  lat?: string;
  lon?: string;
  address?: Record<string, string | undefined>;
};

const countryCode = (country: string) => ({ pakistan: "pk", canada: "ca", "united states": "us", usa: "us" }[country.trim().toLowerCase()]);
const number = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** Server-side OSM proxy: no browser CORS dependency and no committed map key. */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 3) return NextResponse.json({ results: [] });

  try {
    const bootstrap = await loadDemoBootstrap();
    const location = bootstrap.locations.find((entry) => entry && typeof entry === "object") as Record<string, unknown> | undefined;
    const params = new URLSearchParams({ format: "jsonv2", addressdetails: "1", limit: "5", q: query });
    const country = typeof location?.country === "string" ? countryCode(location.country) : undefined;
    if (country) params.set("countrycodes", country);
    const payload = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      cache: "no-store",
      headers: { Accept: "application/json", "User-Agent": "TossdownDemo/1.0 (storefront address search)" },
      signal: request.signal,
    }).then((response) => response.json()) as NominatimResult[];
    const candidates = payload.map((entry) => ({
      label: entry.display_name || query,
      latitude: number(entry.lat),
      longitude: number(entry.lon),
      city: entry.address?.city || entry.address?.town || entry.address?.village,
      state: entry.address?.state,
      country: entry.address?.country,
      postalCode: entry.address?.postcode,
    }));
    const results = candidates.flatMap((entry) => entry.latitude === null || entry.longitude === null ? [] : [{ label: entry.label, latitude: entry.latitude, longitude: entry.longitude, ...(entry.city ? { city: entry.city } : {}), ...(entry.state ? { state: entry.state } : {}), ...(entry.country ? { country: entry.country } : {}), ...(entry.postalCode ? { postalCode: entry.postalCode } : {}) }]);
    return NextResponse.json({ provider: "openstreetmap", results });
  } catch {
    return NextResponse.json({ message: "Address search is temporarily unavailable.", results: [] }, { status: 502 });
  }
}
