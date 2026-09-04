// The demo already has a server-side geocoder. Reuse it under the exact XO
// route name so the extracted Checkout MFE does not need host-specific code.
export { GET } from "@/app/api/geocode/route";
