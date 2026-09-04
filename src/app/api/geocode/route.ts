import { NextRequest, NextResponse } from "next/server";
import { loadDemoBootstrap } from "@/lib/server-storefront";

type NominatimResult = {
  display_name?: string;
  lat?: string;
  lon?: string;
  address?: Record<string, string | undefined>;
};

type GoogleGeocodeResult = {
  formatted_address?: string;
  geometry?: { location?: { lat?: number; lng?: number } };
  address_components?: Array<{ long_name?: string; types?: string[] }>;
};

type GoogleGeocodeResponse = {
  status?: string;
  error_message?: string;
  results?: GoogleGeocodeResult[];
};

const countryCode = (country: string) => ({ pakistan: "pk", canada: "ca", "united states": "us", usa: "us" }[country.trim().toLowerCase()]);
const number = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function googleComponent(result: GoogleGeocodeResult, type: string) {
  return result.address_components?.find((component) =>
    component.types?.includes(type),
  )?.long_name;
}

/** Server-side provider proxy: use the storefront's Google key when enabled, otherwise OSM. */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 3) return NextResponse.json({ success: true, data: [], results: [] });

  try {
    const bootstrap = await loadDemoBootstrap();
    const location = bootstrap.locations.find((entry) => entry && typeof entry === "object") as Record<string, unknown> | undefined;
    const params = new URLSearchParams({ format: "jsonv2", addressdetails: "1", limit: "5", q: query });
    const country = typeof location?.country === "string" ? countryCode(location.country) : undefined;

    if (bootstrap.maps?.provider === "google" && bootstrap.maps.googleMapsApiKey) {
      const googleParams = new URLSearchParams({
        address: query,
        key: bootstrap.maps.googleMapsApiKey,
        language: "en",
      });
      if (country) googleParams.set("components", `country:${country}`);

      const googleResponse = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?${googleParams.toString()}`,
        { cache: "no-store", signal: request.signal, headers: { Accept: "application/json" } },
      );
      const googlePayload = await googleResponse.json() as GoogleGeocodeResponse;
      if (!googleResponse.ok || (googlePayload.status && !["OK", "ZERO_RESULTS"].includes(googlePayload.status))) {
        return NextResponse.json(
          { success: false, message: googlePayload.error_message || "Address search is temporarily unavailable.", data: [], results: [] },
          { status: googleResponse.ok ? 502 : googleResponse.status },
        );
      }
      const results = (googlePayload.results ?? []).flatMap((entry) => {
        const latitude = number(entry.geometry?.location?.lat);
        const longitude = number(entry.geometry?.location?.lng);
        const label = entry.formatted_address?.trim();
        if (!label || latitude === null || longitude === null) return [];
        const city = googleComponent(entry, "locality") || googleComponent(entry, "postal_town") || googleComponent(entry, "administrative_area_level_2");
        const state = googleComponent(entry, "administrative_area_level_1");
        const resultCountry = googleComponent(entry, "country");
        const postalCode = googleComponent(entry, "postal_code");
        return [{ label, latitude, longitude, ...(city ? { city } : {}), ...(state ? { state } : {}), ...(resultCountry ? { country: resultCountry } : {}), ...(postalCode ? { postalCode } : {}) }];
      });
      return NextResponse.json({ success: true, provider: "google", data: results, results });
    }

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
    return NextResponse.json({ success: true, provider: "openstreetmap", data: results, results });
  } catch {
    return NextResponse.json({ message: "Address search is temporarily unavailable.", results: [] }, { status: 502 });
  }
}
