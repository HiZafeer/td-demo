import { NextRequest, NextResponse } from "next/server";
import { ORDRZ_PATHS } from "@/lib/server-storefront";

export async function GET(request: NextRequest) {
  const businessId = request.nextUrl.searchParams.get("businessId")?.trim() ?? "";
  const locationId = request.nextUrl.searchParams.get("locationId")?.trim() ?? "";
  if (!businessId) return NextResponse.json({ success: false, message: "Missing required query parameter: businessId" }, { status: 400 });
  try {
    const response = await fetch(ORDRZ_PATHS.public.paymentMethods(businessId, locationId), { headers: { Accept: "application/json" }, cache: "no-store" });
    return new NextResponse(await response.text(), { status: response.status, headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json", "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ success: false, message: "Payment methods are unavailable right now." }, { status: 502 });
  }
}
