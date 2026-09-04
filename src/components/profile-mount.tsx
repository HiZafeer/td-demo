"use client";

import { useEffect, useRef, useState } from "react";
import { useCommerce } from "@/components/commerce-provider";

export function ProfileMount() {
  const { bootstrap, order, recordSdk } = useCommerce();
  const targetRef = useRef<HTMLElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const target = targetRef.current;
    if (!target || !order) return;
    let active = true;
    setStatus("loading");
    setError(null);
    recordSdk("mountProfile", "info", "Requesting Profile MFE mount from the Order SDK");
    const instance = order.mountProfile(target, {
      source: "tossdown-demo-host",
      businessName: bootstrap.businessName,
      logoUrl: bootstrap.logoUrl,
      hostShell: true,
      theme: {
        pageBackground: "#f7f4ff",
        primaryColor: "#6847e8",
        borderColor: "#e4def7",
      },
      navigation: { homeUrl: "/" },
    }, {
      onReady: () => { if (active) { setStatus("ready"); recordSdk("mountProfile", "success", "Profile MFE is ready"); } },
      onError: (cause) => { if (active) { setStatus("error"); setError(cause.message); recordSdk("mountProfile", "error", cause.message); } },
    });
    void instance.catch((cause: unknown) => { if (active) { const message = cause instanceof Error ? cause.message : "Profile MFE failed to mount."; setStatus("error"); setError(message); recordSdk("mountProfile", "error", message); } });
    return () => { active = false; void instance.then((mounted) => mounted.unmount()).catch(() => undefined); };
  }, [bootstrap, order, recordSdk]);

  const profileMfeConfigured = Boolean(process.env.NEXT_PUBLIC_PROFILE_MFE_URL);
  return <>
    {error ? <p className="inline-error">{error}</p> : null}
    <section ref={targetRef} className="profile-mfe-root" aria-label="Profile MFE" />
    {status === "error" ? <p className="muted">{profileMfeConfigured ? "The Profile MFE could not be loaded. Check its configured URL and reload." : "Start the profile MFE on port 3002, then reload this page."}</p> : null}
  </>;
}
