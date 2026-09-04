"use client";

import { useEffect, useMemo, useState } from "react";
import { useCommerce, type DemoOrderType } from "@/components/commerce-provider";
import type { DemoProduct } from "@/lib/types";
import { getStorefrontScheduledSlots } from "@ordrz/orders-sdk";

function messageOf(error: unknown) { return error instanceof Error ? error.message : "The operation was rejected."; }
type ScheduleDay = "today" | "tomorrow";

export function ShopPage() {
  const { bootstrap, locations, state, addProduct, setFulfilment, clearFulfilment } = useCommerce();
  const [contextOpen, setContextOpen] = useState(false);
  const [orderType, setOrderType] = useState<DemoOrderType | "">("");
  const [locationId, setLocationId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<"area" | "pin">("area");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [scheduledAt, setScheduledAt] = useState("ASAP");
  const [scheduleDay, setScheduleDay] = useState<ScheduleDay>("today");
  const [error, setError] = useState<string | null>(null);
  const [modifierPrompt, setModifierPrompt] = useState<string | null>(null);
  const [modifierReady, setModifierReady] = useState<Record<string, boolean>>({});
  const [pendingProduct, setPendingProduct] = useState<string | null>(null);
  const [contextPending, setContextPending] = useState(false);
  const money = new Intl.NumberFormat("en-CA", { style: "currency", currency: bootstrap.currency });
  const selectedLocation = locations.find((location) => location.id === locationId) ?? locations[0];
  const zones = useMemo(() => selectedLocation?.deliveryZones ?? [], [selectedLocation]);
  const todaySlots = useMemo(() => {
    if (!selectedLocation || !orderType) return [];
    return getStorefrontScheduledSlots(selectedLocation, orderType, new Date());
  }, [orderType, selectedLocation]);
  const tomorrowSlots = useMemo(() => {
    if (!selectedLocation || !orderType) return [];
    const target = new Date();
    target.setDate(target.getDate() + 1);
    return getStorefrontScheduledSlots(selectedLocation, orderType, target);
  }, [orderType, selectedLocation]);
  const slots = scheduleDay === "tomorrow" ? tomorrowSlots : todaySlots;
  const hasAnySlots = todaySlots.length > 0 || tomorrowSlots.length > 0;

  useEffect(() => { if (!locationId && locations[0]?.id) setLocationId(locations[0].id); }, [locationId, locations]);
  useEffect(() => {
    if (contextOpen || !state.fulfilment) return;
    setOrderType((state.fulfilment.orderType as DemoOrderType | undefined) ?? "");
    setLocationId(state.fulfilment.locationId ?? "");
    setZoneId(state.fulfilment.deliveryZoneId ?? "");
    setScheduledAt(state.fulfilment.scheduledAt ?? "");
  }, [contextOpen, state.fulfilment]);
  useEffect(() => {
    if (orderType === "DELIVERY") {
      if (zones.length && !zoneId) setZoneId(zones[0].id);
      if (!zones.length) setDeliveryMethod("pin");
    } else setZoneId("");
  }, [address, deliveryMethod, latitude, longitude, orderType, zoneId, zones]);
  useEffect(() => {
    if (scheduledAt !== "ASAP" && !slots.some((slot) => slot.value === scheduledAt)) {
      setScheduledAt(slots[0]?.value ?? "ASAP");
    }
  }, [scheduledAt, slots]);
  const add = async (product: DemoProduct) => {
    if (pendingProduct || contextPending) return;
    setError(null);
    setPendingProduct(product.id);
    try { await addProduct(product.id, Boolean(modifierReady[product.id])); setModifierPrompt(null); }
    catch (cause) { const text = messageOf(cause); setError(text); if (/fulfilment|location|address|pickup|delivery|schedule|context/i.test(text)) setContextOpen(true); if (product.hasModifiers && /modifier|option|required/i.test(text)) setModifierPrompt(product.id); }
    finally { setPendingProduct(null); }
  };
  const chooseOrderType = (next: DemoOrderType) => { setOrderType(next); setError(null); if (next === "PICKUP") { setAddress(""); setLatitude(""); setLongitude(""); setZoneId(""); } };
  const saveContext = async () => {
    if (contextPending) return;
    setError(null); setContextPending(true);
    const deliveryAddress = orderType === "DELIVERY" && deliveryMethod === "pin" ? { label: address || "Pinned address", addressLine1: address || "Pinned address", latitude: Number(latitude), longitude: Number(longitude) } : undefined;
    try {
      await setFulfilment({ orderType: orderType || undefined, locationId: locationId || undefined, deliveryZoneId: orderType === "DELIVERY" && deliveryMethod === "area" ? zoneId || undefined : undefined, scheduledAt: scheduledAt || undefined, scheduleSlots: slots, deliveryAddress });
      setContextOpen(false);
    } catch (cause) { setError(messageOf(cause)); }
    finally { setContextPending(false); }
  };
  const resetContext = () => { clearFulfilment(); setOrderType(""); setLocationId(""); setZoneId(""); setAddress(""); setLatitude(""); setLongitude(""); setScheduledAt(""); setScheduleDay("today"); setContextOpen(true); };

  return <>
    <section className="hero"><div className="hero-copy"><p className="eyebrow">{bootstrap.businessName} · ordering lab</p><h1>Build the order.<br /><em>Keep the flow yours.</em></h1><p>Choose pickup or delivery, set the handoff details, and let the Order SDK carry the same context through cart and checkout.</p><div className="hero-actions"><a className="button button-primary" href="#products">Browse products <span>↗</span></a><span className="hero-note">SDK-owned ordering</span></div><div className="journey-steps" aria-label="Ordering journey"><span className="active"><b>01</b> Context</span><i>→</i><span><b>02</b> Cart</span><i>→</i><span><b>03</b> Checkout</span></div></div><div className="hero-art" aria-hidden="true"><div className="hero-orbit hero-orbit-one" /><div className="hero-orbit hero-orbit-two" /><div className="hero-stamp"><strong>SDK</strong><span>Ordering runtime</span></div></div></section>
    <section className="context-strip" aria-label="Order context summary"><div><span className="context-kicker">Current handoff</span><strong>{state.fulfilment?.orderType ?? "Not selected"}</strong><small>{state.fulfilment && selectedLocation?.name ? `${selectedLocation.name} · ${state.fulfilment.scheduledAt === "ASAP" ? "ASAP" : "Scheduled"}` : "Choose a location to continue"}</small></div><button className="button button-secondary" onClick={() => setContextOpen((open) => !open)}>{contextOpen ? "Close context" : "Edit context"}</button></section>
    <section className="products-section" id="products"><div className="section-heading"><div><p className="eyebrow">{bootstrap.businessName} menu</p><h2>Add an item</h2><p>All ordering actions use one Order SDK runtime; its validation response opens the required context or option prompt.</p></div><div className={`availability ${state.sdkStatus === "ready" ? "open" : ""}`}><i />SDK {state.sdkStatus}</div></div>{error ? <p className="notice error" role="alert"><strong>SDK response</strong><span>{error}</span></p> : null}<div className="product-grid">{bootstrap.products.map((product) => <ProductCard key={product.id} product={product} money={money} onAdd={() => void add(product)} pending={pendingProduct === product.id} disabled={Boolean(pendingProduct) || state.sdkStatus !== "ready"} modifierPrompt={modifierPrompt === product.id} modifierReady={Boolean(modifierReady[product.id])} onModifier={() => setModifierReady((current) => ({ ...current, [product.id]: !current[product.id] }))} />)}</div></section>
    {contextOpen ? <div className="context-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setContextOpen(false); }}><section className="demo-controls context-panel context-modal" aria-label="Fulfilment selection" role="dialog" aria-modal="true"><div className="controls-heading"><div><p className="eyebrow">Step 01 · context</p><h2>Where should we send it?</h2></div><div className="context-actions"><button className="text-button" onClick={resetContext}>Reset selection</button><button className="modal-close" aria-label="Close context" onClick={() => setContextOpen(false)}>×</button></div></div><p className="context-explainer">The Order SDK owns this context and validates it before cart or checkout can proceed.</p><div className="choice-grid fulfilment-choices"><button className={orderType === "PICKUP" ? "selected" : ""} onClick={() => chooseOrderType("PICKUP")}><span className="choice-icon">↗</span><strong>Pickup</strong><small>Collect from the selected location</small></button><button className={orderType === "DELIVERY" ? "selected" : ""} onClick={() => chooseOrderType("DELIVERY")}><span className="choice-icon">⌖</span><strong>Delivery</strong><small>{zones.length ? "Select an area" : "Pin an exact address"}</small></button></div><div className="field"><span>Location <i>required</i></span><div className="location-list">{locations.map((location, index) => <button type="button" key={location.id || index} className={`location-choice ${location.id === locationId ? "selected" : ""}`} onClick={() => setLocationId(location.id)}><span className="location-radio" aria-hidden="true" /><span><strong>{location.name || "Location"}</strong><small>{[location.addressLine1, location.addressLine2, location.city, location.state].filter((value) => typeof value === "string" && value.trim()).join(", ") || "Branch address unavailable"}</small></span></button>)}</div></div>{orderType === "DELIVERY" ? <div className="delivery-method"><span className="field-label">Delivery method</span><div className="segmented"><button className={deliveryMethod === "area" ? "selected" : ""} disabled={!zones.length} onClick={() => setDeliveryMethod("area")}>Area / sub-region</button><button className={deliveryMethod === "pin" ? "selected" : ""} onClick={() => setDeliveryMethod("pin")}>Exact pin</button></div>{deliveryMethod === "area" && zones.length ? <label className="field"><span>Area <i>required</i></span><select value={zoneId} onChange={(event) => setZoneId(event.target.value)}><option value="">Choose an area</option>{zones.map((zone, index) => <option key={zone.id || index} value={zone.id}>{zone.name || "Delivery area"}</option>)}</select></label> : null}{deliveryMethod === "pin" ? <><label className="field"><span>Address <i>required</i></span><input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Apartment, street, landmark" /></label><div className="field-row"><label className="field"><span>Latitude <i>required</i></span><input value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder="e.g. 31.5204" inputMode="decimal" /></label><label className="field"><span>Longitude <i>required</i></span><input value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder="e.g. 31.5204" inputMode="decimal" /></label></div></> : null}</div> : null}<div className="schedule-box"><div><span className="field-label">Order time</span><small>The Order SDK validates the selected schedule.</small></div><div className="segmented"><button className={scheduledAt === "ASAP" ? "selected" : ""} disabled={!orderType} onClick={() => setScheduledAt("ASAP")}>ASAP</button><button className={scheduledAt !== "ASAP" && scheduledAt ? "selected" : ""} disabled={!orderType || !hasAnySlots} onClick={() => { const nextDay: ScheduleDay = scheduleDay === "today" && !todaySlots.length && tomorrowSlots.length ? "tomorrow" : scheduleDay; const nextSlots = nextDay === "tomorrow" ? tomorrowSlots : todaySlots; setScheduleDay(nextDay); setScheduledAt(nextSlots[0]?.value ?? "ASAP"); }}>Schedule</button></div>{scheduledAt !== "ASAP" && slots.length ? <><div className="schedule-days"><button className={scheduleDay === "today" ? "selected" : ""} disabled={!todaySlots.length} onClick={() => { setScheduleDay("today"); setScheduledAt(todaySlots[0]?.value ?? "ASAP"); }}>Today</button><button className={scheduleDay === "tomorrow" ? "selected" : ""} disabled={!tomorrowSlots.length} onClick={() => { setScheduleDay("tomorrow"); setScheduledAt(tomorrowSlots[0]?.value ?? "ASAP"); }}>Tomorrow</button></div><div className="slot-grid">{slots.map((slot) => <button key={slot.value} className={scheduledAt === slot.value ? "selected" : ""} onClick={() => setScheduledAt(slot.value)}>{slot.label}</button>)}</div></> : orderType ? <p className="muted">No scheduled slots are available for this service.</p> : null}</div><button className="button button-primary full" disabled={contextPending} onClick={() => void saveContext()}>{contextPending ? "Checking context…" : "Apply context to SDK"}</button><p className="context-requirements"><strong>SDK will check:</strong> fulfilment type · active location · area or geo-range · ASAP/schedule slot · modifier requirements.</p></section></div> : null}
  </>;
}

function ProductCard({ product, money, onAdd, pending, disabled, modifierPrompt, modifierReady, onModifier }: { product: DemoProduct; money: Intl.NumberFormat; onAdd(): void; pending: boolean; disabled: boolean; modifierPrompt: boolean; modifierReady: boolean; onModifier(): void }) {
  return <article className="product-card"><div className="product-image">{product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : <span>{product.name.slice(0, 1)}</span>}{product.hasModifiers ? <small>Options required</small> : null}</div><div className="product-copy"><h3>{product.name}</h3><p>{product.description || "A reliable pick for your next order."}</p>{product.hasModifiers && (modifierPrompt || modifierReady) ? <label className="modifier-check"><input type="checkbox" checked={modifierReady} onChange={onModifier} /> Required option selected</label> : null}</div><div className="product-bottom"><strong>{money.format(product.price)}</strong><button className="add-button" disabled={disabled} onClick={onAdd}><b>+</b>{pending ? "Adding…" : "Add"}</button></div></article>;
}
