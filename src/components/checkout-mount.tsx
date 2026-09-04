"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCommerce } from "@/components/commerce-provider";
import { OrderSuccessModal } from "@/components/order-success-modal";

/** Mounts the canonical Nova checkout through Order SDK. The host owns only
  * the target element and context; the SDK loads the configured Checkout MFE
  * bundle and bridges its cart runtime into the MFE. */
export function CheckoutMount() {
  const { state, bootstrap, order, recordSdk } = useCommerce();
  const targetRef = useRef<HTMLElement>(null);
  const [mountState, setMountState] = useState<"waiting" | "mounting" | "ready" | "error">("waiting");
  const [mountError, setMountError] = useState<string | null>(null);
  const [completedOrder, setCompletedOrder] = useState<{ orderId?: string; orderNumber?: string } | null>(null);
  const [retry, setRetry] = useState(0);
  const fulfilment = state.fulfilment;
  // The SDK emits a fresh context object after every accepted update. Keep
  // mount dependencies value-based so the MFE's initial context sync cannot
  // trigger an unmount/remount loop.
  const fulfilmentSignature = JSON.stringify(fulfilment ?? null);
  const cartSnapshot = useMemo(() => ({ items: state.cart.items.map((item) => {
    const product = bootstrap.products.find((candidate) => candidate.id === item.productId || candidate.name === item.name);
    return { id: item.id, productId: item.productId, name: item.name || product?.name || "Menu item", quantity: item.quantity, unitPrice: item.unitPrice, lineTotal: item.lineTotal, imageUrl: item.imageUrl ?? product?.imageUrl, modifierLabels: item.modifiers };
  }), subtotal: state.cart.total, total: state.cart.total, currency: bootstrap.currency }), [bootstrap.currency, bootstrap.products, state.cart.items, state.cart.total]);
  const checkoutLocations = useMemo(() => bootstrap.locations.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const location = value as Record<string, unknown>;
    const number = (candidate: unknown) => {
      const parsed = typeof candidate === "number" ? candidate : Number(candidate);
      return Number.isFinite(parsed) ? parsed : undefined;
    };
    return [{
      ...location,
      latitude: number(location.latitude),
      longitude: number(location.longitude),
    }];
  }), [bootstrap.locations]);
  const checkoutSelection = useMemo(() => {
    if (!fulfilment?.locationId || !fulfilment.orderType) return undefined;
    const rawLocation = bootstrap.locations.find((value) => {
      if (!value || typeof value !== "object") return false;
      return String((value as Record<string, unknown>).id ?? "") === fulfilment.locationId;
    }) as Record<string, unknown> | undefined;
    const rawZones = Array.isArray(rawLocation?.deliveryZones) ? rawLocation.deliveryZones : [];
    const rawZone = rawZones.find((value) => {
      if (!value || typeof value !== "object") return false;
      return String((value as Record<string, unknown>).id ?? "") === fulfilment.deliveryZoneId;
    }) as Record<string, unknown> | undefined;
    const text = (value: unknown) => typeof value === "string" ? value : "";
    const number = (value: unknown) => {
      const parsed = typeof value === "number" ? value : Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const locationAddress = [rawLocation?.addressLine1, rawLocation?.addressLine2, rawLocation?.city]
      .map(text)
      .filter(Boolean)
      .join(", ");
    const deliveryAddress = fulfilment.deliveryAddress;
    return {
      businessId: bootstrap.businessId,
      city: text(rawLocation?.city),
      currency: bootstrap.currency,
      locationId: fulfilment.locationId,
      locationSlug: text(rawLocation?.slug) || fulfilment.locationId,
      locationName: text(rawLocation?.name) || "Store location",
      locationAddress,
      orderType: fulfilment.orderType,
      addressLabel: text(deliveryAddress?.label) || text(deliveryAddress?.addressLine1),
      latitude: deliveryAddress?.latitude ?? (number(rawLocation?.latitude) || null),
      longitude: deliveryAddress?.longitude ?? (number(rawLocation?.longitude) || null),
      selectedZoneId: fulfilment.deliveryZoneId ?? "",
      selectedZoneName: text(rawZone?.name),
      selectedZoneCharges: number(rawZone?.charges),
      selectedZoneMinOrderAmount: number(rawZone?.minOrderAmount),
      selectedZoneEstimatedDeliveryTime: text(rawZone?.estimatedDeliveryTime),
      addressLine2: text(deliveryAddress?.addressLine2),
      deliveryCity: text(deliveryAddress?.city),
      deliveryState: text(deliveryAddress?.state),
      deliveryCountry: text(deliveryAddress?.country),
      deliveryPostalCode: text(deliveryAddress?.postalCode),
      deliveryInstructions: "",
      deliverySelectionConfirmed: true,
    };
  }, [bootstrap.businessId, bootstrap.currency, bootstrap.locations, fulfilmentSignature]);

  useEffect(() => {
    if (!order || !state.cart.id || !fulfilment?.locationId || !fulfilment.orderType || !fulfilment.scheduledAt) return;
    const target = targetRef.current;
    if (!target) return;
    let active = true;
    setMountState("mounting"); setMountError(null); target.replaceChildren();
    recordSdk("mountCheckout", "info", "Requesting Checkout MFE mount from the Order SDK");
    const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
    const config = {
      source: "tossdown-demo-host",
      businessName: bootstrap.businessName,
      logoUrl: bootstrap.logoUrl,
      cartSnapshot,
      selection: checkoutSelection,
      theme: { pageBackground: "#f7f4ff", pageText: "#172033", secondaryText: "#69748a", cardBackground: "#ffffff", borderColor: "#e5e1ef", buttonBackground: "#6546e8", buttonText: "#ffffff", borderRadius: "18px", cardRadius: "18px", fieldRadius: "11px", buttonRadius: "999px" },
      maps: bootstrap.maps ?? { provider: "openstreetmap" as const },
      ...(stripePublishableKey ? { payment: { stripePublishableKey } } : {}),
      locations: checkoutLocations,
      hostShell: true,
      navigation: { continueShoppingUrl: "/#products", homeUrl: "/" },
    };
    let instance: { unmount(): void } | undefined;
    void order.mountCheckout(target, config, {
      onReady: () => { if (active) { setMountState("ready"); recordSdk("mountCheckout", "success", "Checkout MFE is ready"); } },
      onError: (error) => { if (active) { setMountState("error"); setMountError(error.message); recordSdk("mountCheckout", "error", error.message); } },
      onOrderComplete: (detail) => {
        if (active) {
          setCompletedOrder({ orderId: detail.orderId, orderNumber: detail.orderNumber });
          recordSdk("orderComplete", "success", `Order accepted by the SDK · order=${detail.orderNumber || detail.orderId}`);
        }
      },
      onExit: (detail) => { if (active) { setMountState("waiting"); recordSdk("mountCheckout", "info", `Checkout MFE exited · reason=${detail.reason}`); } },
    }).then((next) => { instance = next; if (active) setMountState("ready"); }).catch((cause: unknown) => { if (active) { const message = cause instanceof Error ? cause.message : "Checkout MFE could not be mounted."; setMountState("error"); setMountError(message); recordSdk("mountCheckout", "error", message); } });
    return () => { active = false; instance?.unmount(); target.replaceChildren(); };
  }, [bootstrap.businessId, bootstrap.businessName, bootstrap.currency, bootstrap.logoUrl, cartSnapshot, checkoutLocations, checkoutSelection, fulfilmentSignature, order, recordSdk, retry, state.cart.id]);

  if (!state.cart.items.length) return <section className="checkout-shell"><div className="checkout-intro"><p className="eyebrow">Step 03 · checkout handoff</p><h1>Your checkout starts with a cart.</h1><p>Add an item from the menu to mount the canonical Checkout MFE through the Order SDK.</p></div><div className="checkout-empty"><span className="checkout-icon">⌑</span><h2>Your bag is empty</h2><p>Nothing is sent to the MFE until the SDK has a cart and valid fulfilment.</p><Link className="button button-primary" href="/#products">Back to menu</Link></div></section>;
  if (!fulfilment?.locationId || !fulfilment.orderType || !fulfilment.scheduledAt) return <section className="checkout-shell"><div className="checkout-intro"><p className="eyebrow">Step 03 · checkout handoff</p><h1>Choose fulfilment first.</h1><p>The Order SDK blocks checkout until location, fulfilment type, and timing are present.</p></div><div className="checkout-empty"><span className="checkout-icon">⌖</span><h2>Checkout is waiting for context</h2><p>Return to the menu and apply a pickup or delivery context.</p><Link className="button button-primary" href="/#products">Choose fulfilment</Link></div></section>;

  return <>
    <section className="checkout-shell"><div className="checkout-intro checkout-intro-row"><div><p className="eyebrow">Step 03 · checkout handoff</p><h1>Canonical Checkout MFE</h1><p>Mounted by the Order SDK with Shadow DOM isolation. Cart state, fulfilment, validation, payment, and order placement stay inside the shared SDK runtime.</p></div><span className={`mfe-status ${mountState}`}><i />{mountState === "mounting" ? "Loading MFE" : mountState === "ready" ? "MFE ready" : mountState === "error" ? "Mount error" : "Waiting"}</span></div>{mountError ? <div className="mfe-error"><strong>Checkout mount failed</strong><span>{mountError}</span><button className="button button-secondary" onClick={() => setRetry((value) => value + 1)}>Retry mount</button></div> : null}<section ref={targetRef} id="checkout-mfe-root" className="checkout-target" aria-label="Checkout MFE" aria-busy={mountState === "mounting"} /></section>
    {completedOrder ? <OrderSuccessModal orderNumber={completedOrder.orderNumber} onOrderAgain={() => { order?.clearLocalAfterOrder(); setCompletedOrder(null); window.location.assign("/#products"); }} /> : null}
  </>;
}
