import { NextResponse } from "next/server";
import { publicCartItemUrl } from "@/lib/server-storefront";

async function proxy(request: Request, params: Promise<{ cartItemId: string }>, method: "PATCH" | "DELETE") {
  const { cartItemId } = await params;
  const cartId = request.headers.get("x-cart-id");
  const response = await fetch(publicCartItemUrl(cartItemId), {
    method,
    headers: { Accept: "application/json", ...(method === "PATCH" ? { "Content-Type": "application/json" } : {}), ...(cartId ? { "X-Cart-Id": cartId } : {}) },
    body: method === "PATCH" ? await request.text() : undefined,
  });
  return new NextResponse(await response.text(), { status: response.status, headers: { "Content-Type": response.headers.get("content-type") ?? "application/json", ...(response.headers.get("x-cart-id") ? { "X-Cart-Id": response.headers.get("x-cart-id")! } : {}) } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ cartItemId: string }> }) { return proxy(request, params, "PATCH"); }
export async function DELETE(request: Request, { params }: { params: Promise<{ cartItemId: string }> }) { return proxy(request, params, "DELETE"); }
