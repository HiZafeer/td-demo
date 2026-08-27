import { NextResponse } from "next/server";
import { loadDemoBootstrap } from "@/lib/server-storefront";

export async function GET(request: Request) {
  try {
    const bootstrap = await loadDemoBootstrap();
    const url = new URL(request.url);
    return NextResponse.json({ ...bootstrap, enabled: url.searchParams.get("enabled") !== "false" });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to load storefront." }, { status: 502 });
  }
}
