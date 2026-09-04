import { NextRequest, NextResponse } from "next/server";
import { ORDRZ_PATHS } from "@/lib/server-storefront";

function positive(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: NextRequest) {
  const authorization = request.headers.get("Authorization")?.trim() ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return NextResponse.json({ success: false, message: "A bearer token is required." }, { status: 401 });
  const page = positive(request.nextUrl.searchParams.get("page"), 1);
  const pageSize = Math.min(positive(request.nextUrl.searchParams.get("pageSize"), 20), 100);
  try {
    const response = await fetch(ORDRZ_PATHS.public.customerOrders(page, pageSize), { cache: "no-store", headers: { Accept: "application/json", Authorization: authorization } });
    return new NextResponse(await response.text(), { status: response.status, headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json", "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ success: false, message: "Customer orders are unavailable right now." }, { status: 502 });
  }
}
