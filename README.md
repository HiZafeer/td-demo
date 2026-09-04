# Tossdown ordering validation demo

This is a small third-party host app powered by the latest
`@ordrz/orders-sdk`. The SDK is the ordering source of truth: cart changes,
fulfilment, validation, checkout mounting, profile authentication, and order
placement all use the SDK runtime.

The compact SDK activity control is collapsed by default so it never blocks the
host page. When opened, it records only SDK actions and responses. The host UI
starts without an assumed fulfilment selection; the user chooses a location,
order type, and timing before the SDK accepts the context.

## Run locally

```bash
cd "/Volumes/Zafeer/Test/demo"
npm install
npm run dev -- --port 3000
```

Open `http://localhost:3000`. The demo uses the same standard Order SDK HTTP
transport as XO. The SDK owns the canonical Ordrz API base and endpoint map;
the Demo does not override the SDK API origin. Its Next.js compatibility routes
remain available for standalone XO-compatible MFE fallbacks and local proxying.
Start the
Nova Checkout MFE on port 3001 and the Profile MFE on port 3002 to test the
complete embedded flow. The default URLs are also listed in `.env.example` and
can be overridden with `NEXT_PUBLIC_CHECKOUT_MFE_URL` and
`NEXT_PUBLIC_PROFILE_MFE_URL`.

Production does not need MFE URL environment variables. The SDK loads its
canonical deployed Checkout and Profile bundles automatically. The variables
remain available as optional overrides for staging or custom deployments.

## Try the flow

1. Open **Edit context** to switch between Pickup and Delivery.
   Delivery exposes area/sub-region selection when the location has zones, or
   exact-pin address and coordinates for geo-range delivery.
2. Switch between ASAP and host-provided schedule slots, then click **Apply
   context to SDK**.
3. Click **Add** on a product. The Order SDK validates the current context and
   required modifiers; its response opens the corresponding prompt when input
   is missing.
4. Open the bag and go to **Secure checkout**. Enter a name and phone; the
   Checkout MFE calls the SDK validation gate immediately before placement.
5. Click **Reset selection** and repeat an action to inspect the SDK response in
   the activity control. The activity panel records only SDK actions and
   responses, not host/UI bookkeeping.

The menu has one canonical ordering flow. The Order SDK is called for every
cart and checkout operation and remains the source of truth for validation,
fulfilment, and order orchestration.

The canonical Checkout MFE is mounted through the Order SDK in this demo. When
running locally, the SDK automatically loads
`http://localhost:3001/embed/index.global.js` (start the Nova Checkout app on
port 3001). On a deployed host, the SDK automatically uses the canonical
production bundle; the host does not recreate the mount or bridge logic.

## SDK package

The demo uses the pinned `@ordrz/orders-sdk` package artifact in
`vendor/ordrz-orders-sdk-0.1.0-beta.3.tgz`, so local testing exercises the
same package boundary that production hosts will use. Once the SDK is
published to the private registry, replace that `file:` dependency with the
restricted registry version; the Demo integration code does not need to
change.
