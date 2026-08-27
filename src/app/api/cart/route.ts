import { NextResponse } from "next/server";
import { publicCartUrl } from "@/lib/server-storefront";

async function proxy(request: Request, method: "GET" | "DELETE") {
  const cartId = request.headers.get("x-cart-id");
  const response = await fetch(publicCartUrl(), {
    method,
    headers: { Accept: "application/json", ...(cartId ? { "X-Cart-Id": cartId } : {}) },
    cache: "no-store",
  });
  return new NextResponse(await response.text(), { status: response.status, headers: { "Content-Type": response.headers.get("content-type") ?? "application/json", ...(response.headers.get("x-cart-id") ? { "X-Cart-Id": response.headers.get("x-cart-id")! } : {}) } });
}

export async function GET(request: Request) { return proxy(request, "GET"); }
export async function DELETE(request: Request) { return proxy(request, "DELETE"); }
