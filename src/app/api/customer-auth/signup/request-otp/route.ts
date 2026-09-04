import { NextRequest } from "next/server";
import { proxyCustomerAuthPost } from "@/app/api/customer-auth/_shared";
import { ORDRZ_PATHS } from "@/lib/server-storefront";

export async function POST(request: NextRequest) {
  return proxyCustomerAuthPost(request, ORDRZ_PATHS.public.customerSignup());
}
