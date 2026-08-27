import type { NextConfig } from "next";
import path from "node:path";

// The demo consumes the packages' built public artifacts via local `file:`
// links, exactly as an external application would after publication.
const nextConfig: NextConfig = {
  // Both local `file:` dependencies live beside this demo under /Volumes/Zafeer.
  // Set Turbopack's root there so it can intentionally follow those links.
  turbopack: { root: path.resolve(process.cwd(), "../..") },
};

export default nextConfig;
