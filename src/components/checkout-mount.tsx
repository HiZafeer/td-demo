"use client";

import { createCheckoutSdk, type CheckoutInstance } from "@zafeer/checkout-sdk";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCommerce } from "@/components/commerce-provider";

export function CheckoutMount() {
  const { client, state, bootstrap } = useCommerce();
  const currentCart = state?.cart;
  const targetRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<CheckoutInstance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completedOrder, setCompletedOrder] = useState<string | null>(null);

  useEffect(() => {
    if (!client || !targetRef.current || !currentCart?.items.length || !state?.fulfilment) return;
    let active = true;
    void (async () => {
      try {
        await client.flush();
        const checkoutContext = client.getCheckoutContext();
        const hostUrl = window.location.origin;
        const sdk = createCheckoutSdk({ mfeUrl: process.env.NEXT_PUBLIC_CHECKOUT_MFE_URL || "http://localhost:3001/embed/index.global.js" });
        instanceRef.current = await sdk.mount(targetRef.current!, {
          version: 1,
          source: "third-party-demo",
          businessId: checkoutContext.businessId,
          cartReference: checkoutContext.cartId,
          fulfilment: {
            orderType: checkoutContext.fulfilment.orderType.toLowerCase() as "pickup" | "delivery" | "dine_in",
            locationId: checkoutContext.fulfilment.locationId,
            deliveryZoneId: checkoutContext.fulfilment.deliveryZoneId ?? undefined,
            deliveryAddress: checkoutContext.fulfilment.deliveryAddress
              ? {
                label: checkoutContext.fulfilment.deliveryAddress.label,
                formattedAddress: checkoutContext.fulfilment.deliveryAddress.addressLine1 ?? checkoutContext.fulfilment.deliveryAddress.label,
                latitude: checkoutContext.fulfilment.deliveryAddress.latitude,
                longitude: checkoutContext.fulfilment.deliveryAddress.longitude,
              }
              : undefined,
            scheduleMode: checkoutContext.fulfilment.scheduledAt === "ASAP" ? "asap" : "scheduled",
            scheduledAt: checkoutContext.fulfilment.scheduledAt === "ASAP" ? undefined : checkoutContext.fulfilment.scheduledAt,
          },
          apiBaseUrl: process.env.NEXT_PUBLIC_CHECKOUT_API_BASE_URL || "http://localhost:3001/api/checkout",
          locale: "en-CA",
          currency: checkoutContext.currency,
          businessName: bootstrap.businessName,
          logoUrl: bootstrap.logoUrl,
          // This allows the separate MFE to paint immediately. It is only a
          // snapshot: the MFE reloads `cartReference` before calculating or
          // placing the order.
          cartSnapshot: {
            items: currentCart.items.map((item) => ({
              id: item.id,
              productId: item.productId,
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice.amount,
              lineTotal: item.lineTotal.amount,
              imageUrl: item.imageUrl,
              modifierLabels: item.modifiers.map((modifier) => modifier.optionId),
            })),
            subtotal: currentCart.subtotal.amount,
            total: currentCart.total.amount,
            currency: currentCart.total.currency,
          },
          // The SDK receives an already-valid MFE configuration. It does not
          // rewrite host navigation or otherwise alter the checkout base.
          navigation: { continueShoppingUrl: `${hostUrl}/`, homeUrl: `${hostUrl}/` },
          theme: { primaryColor: "#166534", buttonBackground: "#166534", buttonText: "#ffffff", pageBackground: "#fafaf8", surfaceColor: "#ffffff", textColor: "#172033", mutedTextColor: "#667085", borderColor: "#dde2e8", cardRadius: "16px", fieldRadius: "10px", buttonRadius: "999px" },
        }, {
          // The MFE has already cleared the authoritative remote cart. Keep this
          // display snapshot alive until its confirmation screen is dismissed.
          onOrderComplete(detail) { if (active) setCompletedOrder(detail.orderNumber ?? detail.orderId); },
          onExit({ reason }) { if (reason === "back_to_shop") client.clearLocalAfterOrder(); },
        });
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : "Checkout could not load."); }
    })();
    return () => { active = false; instanceRef.current?.unmount(); instanceRef.current = null; };
  }, [bootstrap.businessName, bootstrap.logoUrl, client, currentCart, state?.fulfilment]);

  if (!state?.cart?.items.length) return <section className="empty-checkout"><h1>Your cart is empty</h1><p>Add menu items before continuing to checkout.</p><Link className="button button-primary" href="/">Back to menu</Link></section>;
  if (!state.fulfilment) return <section className="empty-checkout"><h1>Fulfilment is required</h1><p>Return to the menu and select pickup or delivery before checkout.</p><Link className="button button-primary" href="/">Back to menu</Link></section>;
  return <section className="checkout-shell"><div className="checkout-intro"><p className="eyebrow">Secure checkout</p><h1>Complete your order</h1><p>This content is mounted by <code>@zafeer/checkout-sdk</code>; the demo header and footer remain host-owned.</p></div>{completedOrder && <p className="notice success">Order confirmed: {completedOrder}. Local cart state has been cleared.</p>}{error ? <p className="notice error">{error}</p> : <div ref={targetRef} className="checkout-target" />}</section>;
}
