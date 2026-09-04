"use client";

import { useEffect } from "react";

export default function DemoError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="demo-error-page">
      <section className="demo-error-card" role="alert">
        <p className="eyebrow">Demo unavailable</p>
        <h1>We couldn’t load the storefront.</h1>
        <p>
          The ordering API or storefront configuration is temporarily
          unavailable. Check the connection, then try again.
        </p>
        <button className="button button-primary" type="button" onClick={reset}>
          Try again
        </button>
      </section>
    </main>
  );
}
