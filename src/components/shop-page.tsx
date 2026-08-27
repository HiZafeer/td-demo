"use client";

import { useEffect, useState } from "react";
import { findEligibleDeliveryLocations, type CartLine, type FulfilmentContext, type OrderType } from "@zafeer/cart";
import { useCommerce } from "@/components/commerce-provider";
import type { DemoProduct } from "@/lib/types";

type GeocodeResult = { label: string; latitude: number; longitude: number; city?: string; state?: string; country?: string; postalCode?: string };
type DeliverySelection = GeocodeResult & { locationId: string; zoneId: string; locationName: string };

export function ShopPage() {
  const { bootstrap, state, addProduct, commerceEnabled, updateQuantity, removeLine } = useCommerce();
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);
  const [viewProductId, setViewProductId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const money = new Intl.NumberFormat("en-CA", { style: "currency", currency: bootstrap.currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const add = async (productId: string) => {
    setError(null);
    if (!state?.fulfilment) { setPendingProductId(productId); return; }
    try { await addProduct(productId); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to add item."); }
  };
  const changeQuantity = async (line: CartLine, nextQuantity: number) => {
    setError(null);
    try { if (nextQuantity < 1) await removeLine(line.id); else await updateQuantity(line, nextQuantity); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update the cart."); }
  };
  const heroProducts = bootstrap.products.slice(0, 3);
  const viewProduct = bootstrap.products.find((product) => product.id === viewProductId) ?? null;

  return <>
    <section className="hero"><div className="hero-copy"><p className="eyebrow">{bootstrap.businessName} · online grocery</p><h1>Everyday groceries,<br /><em>ready when you are.</em></h1><p>Fresh pantry staples, produce, and household favourites—picked for a simple weekly shop.</p><div className="hero-actions"><a className="button button-primary" href="#products">Shop the menu <span>↗</span></a><span className="hero-note">{commerceEnabled ? "Ordering is open" : "Ordering is paused"}</span></div><div className="hero-trust"><span>✓ Secure checkout</span><span>✓ Pickup or delivery</span></div></div><div className="hero-art" aria-hidden="true"><div className="hero-orbit hero-orbit-one" /><div className="hero-orbit hero-orbit-two" />{heroProducts.map((product, index) => <figure className={`hero-product hero-product-${index + 1}`} key={product.id}>{product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span>{product.name.slice(0, 1)}</span>}</figure>)}<div className="hero-stamp"><strong>Food Papa</strong><span>Made for today</span></div></div></section>
    <section id="products" className="products-section"><div className="section-heading"><div><p className="eyebrow">{bootstrap.businessName} menu</p><h2>Shop the essentials</h2><p>Everything you need for the week, without the aisle-hopping.</p></div><div className={`availability ${commerceEnabled ? "open" : "closed"}`}><i />{commerceEnabled ? "Ordering enabled" : "Ordering disabled"}</div></div>
      {error && <p className="notice error">{error}</p>}
      <div className="product-grid">{bootstrap.products.length ? bootstrap.products.map((product) => { const line = state?.cart?.items.find((item) => item.productId === product.id); return <article className="product-card" key={product.id}>
        <div className="product-image">{product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : <span>Food Papa</span>}{product.hasModifiers ? <small>Customise</small> : null}</div>
        <div className="product-copy"><h3>{product.name}</h3><p>{product.description || "A reliable pick for your next shop."}</p></div>
        <div className="product-bottom"><strong>{money.format(product.price)}</strong>{!commerceEnabled ? <button className="add-button view-button" onClick={() => setViewProductId(product.id)}>View</button> : line ? <div className="product-quantity" aria-label={`${product.name} quantity`}><button aria-label={`Decrease ${product.name}`} onClick={() => void changeQuantity(line, line.quantity - 1)}>−</button><span>{line.quantity}</span><button aria-label={`Increase ${product.name}`} onClick={() => void changeQuantity(line, line.quantity + 1)}>+</button></div> : <button className="add-button" onClick={() => void add(product.id)}><b>+</b>{product.hasModifiers ? "Options" : "Add"}</button>}</div>
      </article>; }) : <p className="empty">No products were returned by the storefront.</p>}</div>
    </section>
    {pendingProductId && <FulfilmentDialog onClose={() => setPendingProductId(null)} onComplete={async () => { const productId = pendingProductId; setPendingProductId(null); if (productId) await add(productId); }} />}
    {viewProduct && <ProductDetailDialog product={viewProduct} money={money} onClose={() => setViewProductId(null)} />}
  </>;
}

function ProductDetailDialog({ product, money, onClose }: { product: DemoProduct; money: Intl.NumberFormat; onClose(): void }) {
  return <div className="modal-layer" role="presentation"><section className="modal product-detail-modal" role="dialog" aria-modal="true" aria-labelledby="product-detail-title"><button className="icon-button modal-close" onClick={onClose} aria-label="Close">×</button>{product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : null}<p className="eyebrow">Product details</p><h2 id="product-detail-title">{product.name}</h2><p>{product.description || "A reliable pick for your next shop."}</p><strong>{money.format(product.price)}</strong><button className="button button-primary full" onClick={onClose}>Close</button></section></div>;
}

function FulfilmentDialog({ onClose, onComplete }: { onClose(): void; onComplete(): Promise<void> }) {
  const { state, setFulfilment } = useCommerce();
  const [type, setType] = useState<OrderType>("PICKUP");
  const [locationId, setLocationId] = useState("");
  const [address, setAddress] = useState("");
  const [addressResults, setAddressResults] = useState<GeocodeResult[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [delivery, setDelivery] = useState<DeliverySelection | null>(null);
  const [scheduledAt, setScheduledAt] = useState<"ASAP" | string>("ASAP");
  const [step, setStep] = useState<"type" | "location" | "schedule">("type");
  const [error, setError] = useState<string | null>(null);
  const locations = state?.bootstrap?.locations ?? [];
  const selected = locations.find((location) => location.id === locationId);
  const available = locations.filter((location) => location.active && location.acceptingOrders && location.supportedOrderTypes.includes(type));
  const nextHalfHour = new Date(Date.now() + 30 * 60_000);
  nextHalfHour.setMinutes(Math.ceil(nextHalfHour.getMinutes() / 30) * 30, 0, 0);

  useEffect(() => {
    if (type !== "DELIVERY" || address.trim().length < 3 || delivery?.label === address) { setAddressResults([]); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setAddressLoading(true);
      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(address)}`, { signal: controller.signal });
        const payload = await response.json() as { results?: GeocodeResult[] };
        if (!controller.signal.aborted) setAddressResults(Array.isArray(payload.results) ? payload.results : []);
      } catch (cause) {
        if (!controller.signal.aborted) setAddressResults([]);
      } finally {
        if (!controller.signal.aborted) setAddressLoading(false);
      }
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [address, delivery?.label, type]);

  const chooseAddress = (result: GeocodeResult) => {
    const match = findEligibleDeliveryLocations({ latitude: result.latitude, longitude: result.longitude }, available)[0];
    setAddressResults([]);
    setAddress(result.label);
    if (!match) {
      setDelivery(null); setLocationId("");
      setError("That address is outside the delivery areas of our available locations.");
      return;
    }
    setError(null);
    setDelivery({ ...result, locationId: match.location.id, zoneId: match.zone.id, locationName: match.location.name });
    setLocationId(match.location.id);
  };

  const save = async () => {
    if (!selected) { setError("Select a location first."); return; }
    if (type === "DELIVERY" && !delivery) { setError("Choose an address in a listed delivery area."); return; }
    const context: FulfilmentContext = { orderType: type, locationId: selected.id, scheduledAt, ...(type === "DELIVERY" && delivery ? { deliveryZoneId: delivery.zoneId, deliveryAddress: { label: delivery.label, addressLine1: delivery.label, latitude: delivery.latitude, longitude: delivery.longitude, city: delivery.city, state: delivery.state, country: delivery.country, postalCode: delivery.postalCode } } : {}) };
    try { await setFulfilment(context); await onComplete(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save fulfilment."); }
  };

  return <div className="modal-layer" role="presentation"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="fulfilment-title"><button className="icon-button modal-close" onClick={onClose}>×</button>
    {step === "type" && <><p className="eyebrow">Before adding an item</p><h2 id="fulfilment-title">How would you like your order?</h2><div className="choice-grid"><button onClick={() => { setType("PICKUP"); setLocationId(""); setDelivery(null); setStep("location"); }}><strong>Pickup</strong><span>Collect from a nearby store</span></button><button onClick={() => { setType("DELIVERY"); setLocationId(""); setDelivery(null); setStep("location"); }}><strong>Delivery</strong><span>Find stores that serve your address</span></button></div></>}
    {step === "location" && <><button className="back-link" onClick={() => setStep("type")}>← Back</button><p className="eyebrow">{type === "PICKUP" ? "Pickup location" : "Delivery address"}</p><h2 id="fulfilment-title">{type === "PICKUP" ? "Choose your store" : "Where should we deliver?"}</h2>{type === "DELIVERY" ? <><label className="field"><span>Delivery address</span><input value={address} onChange={(event) => { setAddress(event.target.value); setDelivery(null); setLocationId(""); setError(null); }} placeholder="Start typing your street address" autoComplete="street-address" /></label><div className="address-suggestions">{addressLoading ? <p className="address-status">Searching addresses…</p> : null}{addressResults.map((result) => <button type="button" key={`${result.latitude}:${result.longitude}:${result.label}`} className={delivery?.label === result.label ? "selected" : ""} onClick={() => chooseAddress(result)}><strong>{result.label}</strong><small>Use this address</small></button>)}{delivery ? <p className="address-status success">Nearest eligible location: <strong>{delivery.locationName}</strong></p> : null}</div></> : <div className="location-list">{available.map((location) => <label className={`location-choice ${location.id === locationId ? "selected" : ""}`} key={location.id}><input type="radio" checked={location.id === locationId} onChange={() => setLocationId(location.id)} /><span><strong>{location.name}</strong><small>{location.id}</small></span></label>)}</div>}{!available.length && <p className="notice error">No locations are available for this order type.</p>}{error && <p className="notice error">{error}</p>}<button className="button button-primary full" disabled={!locationId || (type === "DELIVERY" && !delivery)} onClick={() => setStep("schedule")}>Save location</button></>}
    {step === "schedule" && <><button className="back-link" onClick={() => setStep("location")}>← Back</button><p className="eyebrow">{type === "PICKUP" ? "Pickup time" : "Delivery time"}</p><h2 id="fulfilment-title">When should we prepare it?</h2><label className={`time-choice ${scheduledAt === "ASAP" ? "selected" : ""}`}><input type="radio" checked={scheduledAt === "ASAP"} onChange={() => setScheduledAt("ASAP")} /><span><strong>As soon as possible</strong><small>Ready from the next 30-minute interval.</small></span></label><label className={`time-choice ${scheduledAt !== "ASAP" ? "selected" : ""}`}><input type="radio" checked={scheduledAt !== "ASAP"} onChange={() => setScheduledAt(nextHalfHour.toISOString())} /><span><strong>Schedule for later</strong><small>Choose a date and time.</small></span></label>{scheduledAt !== "ASAP" && <label className="field"><span>Date and time</span><input type="datetime-local" value={scheduledAt.slice(0, 16)} min={new Date().toISOString().slice(0, 16)} onChange={(event) => setScheduledAt(new Date(event.target.value).toISOString())} /></label>} {error && <p className="notice error">{error}</p>}<button className="button button-primary full" onClick={() => void save()}>Confirm {type === "PICKUP" ? "pickup" : "delivery"} time</button></>}
  </section></div>;
}
