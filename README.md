# Tossdown third-party commerce demo

This is a deliberately independent, one-page Next.js host application. It
proves that a third-party website can supply its own UI while using the public
`@zafeer/cart` package for commerce behavior and
`@zafeer/checkout-sdk` for Checkout MFE mounting.

## Run locally

1. Start Checkout MFE on port 3001:

   ```bash
   cd "/Volumes/Zafeer/Next Projects/nova-checkout"
   npm run dev -- -p 3001
   ```

2. Copy `.env.example` to `.env.local`, install, and start this app:

   ```bash
   cd /Volumes/Zafeer/Test/demo
   npm install
   npm run dev
   ```

Open `http://localhost:3000`.

## Deploy

1. Deploy `nova-checkout` first. Set its `CHECKOUT_ALLOWED_ORIGINS` to the
   deployed demo URL and note its deployment URL.
2. In this project's deployment environment, set:

   ```bash
   NEXT_PUBLIC_CHECKOUT_MFE_URL=https://YOUR-CHECKOUT-MFE-DOMAIN/embed/index.global.js
   NEXT_PUBLIC_CHECKOUT_API_BASE_URL=https://YOUR-CHECKOUT-MFE-DOMAIN/api/checkout
   STOREFRONT_USERNAME=foodpapa1
   ```

3. Redeploy this demo app after changing either `NEXT_PUBLIC_` value—Next.js
   embeds browser-visible environment values at build time. The published beta
   packages are installed from npm; no local `file:` dependencies are required.

## Acceptance flow

1. Switch **E-commerce** off: cart controls are disabled and the package
   initializes in its disabled state.
2. Switch it on, select pickup/delivery, location, and time.
3. Add an item. The cart package posts the first item without a cart ID;
   Ordrz creates the authoritative cart and returns its ID.
4. Change quantity/remove/clear from the host-owned drawer.
5. Visit checkout. The SDK mounts the MFE between this app's header and footer.
6. Complete an order. The MFE clears the remote cart; the SDK completion hook
   clears the cart package's local state.

The demo intentionally has no private Ordrz credentials in the browser. Its
Next.js route handlers proxy public storefront and cart requests.

By default it loads the confirmed `foodpapa1` storefront (FoodPapa1), matching
Nova's `foodpapa1.live.ordrz.store` host resolution. Override
`STOREFRONT_USERNAME` in `.env.local` only when testing another storefront.
# td-cart
