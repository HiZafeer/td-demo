import { NextRequest, NextResponse } from "next/server";
import { ORDRZ_PATHS } from "@/lib/server-storefront";

function authorization(request: NextRequest) {
  const value = request.headers.get("Authorization")?.trim() ?? "";
  return /^bearer\s+/i.test(value) ? value : "";
}

function unauthorized() {
  return NextResponse.json({ success: false, message: "A bearer token is required." }, { status: 401 });
}

async function forward(response: Response) {
  return new NextResponse(await response.text(), {
    status: response.status,
    headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json", "Cache-Control": "no-store" },
  });
}

export async function GET(request: NextRequest) {
  const token = authorization(request);
  if (!token) return unauthorized();
  try {
    const response = await fetch(ORDRZ_PATHS.public.customerAddresses(), { cache: "no-store", headers: { Accept: "application/json", Authorization: token } });
    return forward(response);
  } catch {
    return NextResponse.json({ success: false, message: "Saved addresses are unavailable right now." }, { status: 502 });
  }
}

export async function PATCH(request: NextRequest) {
  const token = authorization(request);
  if (!token) return unauthorized();
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ success: false, message: "A valid address payload is required." }, { status: 400 }); }
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { addresses?: unknown }).addresses)) {
    return NextResponse.json({ success: false, message: "Every address must include address_line1." }, { status: 400 });
  }
  const addresses = (payload as { addresses: unknown[] }).addresses;
  if (addresses.some((address) => {
    if (!address || typeof address !== "object") return true;
    const line1 = (address as Record<string, unknown>).address_line1;
    return typeof line1 !== "string" || !line1.trim();
  })) {
    return NextResponse.json({ success: false, message: "Every address must include address_line1." }, { status: 400 });
  }
  try {
    const response = await fetch(ORDRZ_PATHS.public.customerAddresses(), { method: "PATCH", cache: "no-store", headers: { Accept: "application/json", Authorization: token, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    return forward(response);
  } catch {
    return NextResponse.json({ success: false, message: "We couldn’t save your addresses right now." }, { status: 502 });
  }
}
