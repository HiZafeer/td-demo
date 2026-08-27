import { NextResponse } from "next/server";
import { publicCartItemsUrl } from "@/lib/server-storefront";

export async function POST(request: Request) {
  const cartId = request.headers.get("x-cart-id");
  const response = await fetch(publicCartItemsUrl(), {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", ...(cartId ? { "X-Cart-Id": cartId } : {}) },
    body: await request.text(),
  });
  return new NextResponse(await response.text(), { status: response.status, headers: { "Content-Type": response.headers.get("content-type") ?? "application/json", ...(response.headers.get("x-cart-id") ? { "X-Cart-Id": response.headers.get("x-cart-id")! } : {}) } });
}
