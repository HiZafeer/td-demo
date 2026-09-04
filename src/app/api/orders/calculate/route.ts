import { NextRequest, NextResponse } from "next/server";
import { ORDRZ_PATHS } from "@/lib/server-storefront";

export async function POST(request: NextRequest) {
  try {
    const response = await fetch(ORDRZ_PATHS.public.cartCalculate(), {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(await request.json()),
      cache: "no-store",
    });
    return new NextResponse(await response.text(), { status: response.status, headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json", "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ success: false, message: "Order calculation is unavailable right now." }, { status: 502 });
  }
}
