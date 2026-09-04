import { NextRequest, NextResponse } from "next/server";
import { publicCartCalculateUrl } from "@/lib/server-storefront";

export async function POST(request: NextRequest) {
  try {
    const cartId = request.headers.get("x-cart-id")?.trim() ?? "";
    const response = await fetch(publicCartCalculateUrl(), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(cartId ? { "X-Cart-Id": cartId } : {}),
      },
      body: JSON.stringify(await request.json()),
      cache: "no-store",
    });
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ success: false, message: "Cart calculation is unavailable right now." }, { status: 502 });
  }
}
