import { NextRequest, NextResponse } from "next/server";

export async function proxyCustomerAuthPost(request: NextRequest, upstreamUrl: string) {
  try {
    const response = await fetch(upstreamUrl, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(await request.json()),
      cache: "no-store",
    });
    return new NextResponse(await response.text(), { status: response.status, headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json", "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ success: false, message: "Authentication is unavailable right now." }, { status: 502 });
  }
}
