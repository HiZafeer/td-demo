import { NextRequest, NextResponse } from "next/server";
import { loadDemoBootstrap } from "@/lib/server-storefront";

type NominatimPayload = {
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: Record<string, string | undefined>;
};

type GoogleGeocodeResponse = {
  status?: string;
  error_message?: string;
  results?: Array<{
    formatted_address?: string;
    address_components?: Array<{ long_name?: string; short_name?: string; types?: string[] }>;
  }>;
};

function countryCode(value: unknown) {
  if (typeof value !== "string") return "";
  const normalized = value.trim().toLowerCase();
  return ({ pakistan: "pk", canada: "ca", "united states": "us", usa: "us" } as Record<string, string>)[normalized] ?? normalized;
}

function googleComponent(
  result: NonNullable<GoogleGeocodeResponse["results"]>[number],
  type: string,
) {
  return result.address_components?.find((component) =>
    component.types?.includes(type),
  );
}

export async function GET(request: NextRequest) {
  const latitude = Number.parseFloat(request.nextUrl.searchParams.get("lat") ?? "");
  const longitude = Number.parseFloat(request.nextUrl.searchParams.get("lon") ?? "");
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json({ success: false, message: "Missing or invalid coordinates." }, { status: 400 });
  }

  try {
    const bootstrap = await loadDemoBootstrap();
    const firstLocation = bootstrap.locations.find((value) => Boolean(value && typeof value === "object")) as Record<string, unknown> | undefined;
    const storefrontCountry = countryCode(firstLocation?.country);

    if (bootstrap.maps?.provider === "google" && bootstrap.maps.googleMapsApiKey) {
      const googleParams = new URLSearchParams({
        latlng: `${latitude},${longitude}`,
        key: bootstrap.maps.googleMapsApiKey,
        language: "en",
      });
      const googleResponse = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?${googleParams.toString()}`,
        { cache: "no-store", signal: request.signal, headers: { Accept: "application/json" } },
      );
      const googlePayload = await googleResponse.json() as GoogleGeocodeResponse;
      if (!googleResponse.ok || (googlePayload.status && !["OK", "ZERO_RESULTS"].includes(googlePayload.status))) {
        return NextResponse.json(
          { success: false, message: googlePayload.error_message || "Reverse geocoding is unavailable right now." },
          { status: googleResponse.ok ? 502 : googleResponse.status },
        );
      }
      const result = googlePayload.results?.[0];
      const country = googleComponent(result ?? {}, "country");
      const resultCountry = countryCode(country?.short_name || country?.long_name);
      if (storefrontCountry && resultCountry && storefrontCountry !== resultCountry) {
        return NextResponse.json({ success: false, message: "That location is outside the storefront country." }, { status: 404 });
      }
      const label = result?.formatted_address?.trim() ?? "";
      if (!label) return NextResponse.json({ success: false, message: "We couldn’t resolve that location." }, { status: 404 });
      return NextResponse.json({ success: true, provider: "google", data: { label, latitude, longitude } });
    }

    const params = new URLSearchParams({ format: "jsonv2", zoom: "18", addressdetails: "1", lat: String(latitude), lon: String(longitude) });
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
      cache: "no-store",
      signal: request.signal,
      headers: { Accept: "application/json", "Accept-Language": "en", "User-Agent": "TossdownDemo/1.0 (storefront reverse geocode)" },
    });
    if (!response.ok) return NextResponse.json({ success: false, message: "Reverse geocoding is unavailable right now." }, { status: 502 });
    const payload = await response.json() as NominatimPayload;
    const resultCountry = countryCode(payload.address?.country_code || payload.address?.country);
    if (storefrontCountry && resultCountry && storefrontCountry !== resultCountry) {
      return NextResponse.json({ success: false, message: "That location is outside the storefront country." }, { status: 404 });
    }
    const label = payload.display_name?.trim() ?? "";
    const resolvedLatitude = Number.parseFloat(payload.lat ?? "");
    const resolvedLongitude = Number.parseFloat(payload.lon ?? "");
    if (!label || !Number.isFinite(resolvedLatitude) || !Number.isFinite(resolvedLongitude)) {
      return NextResponse.json({ success: false, message: "We couldn’t resolve that location." }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: { label, latitude: resolvedLatitude, longitude: resolvedLongitude } });
  } catch {
    return NextResponse.json({ success: false, message: "We couldn’t resolve that location right now." }, { status: 502 });
  }
}
