"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useCommerce } from "@/components/commerce-provider";

export function SiteShell({ children }: { children: ReactNode }) {
  const { bootstrap, state, logs, clearLogs } = useCommerce();
  const [cartOpen, setCartOpen] = useState(false);
  // Keep diagnostics available without taking ownership of the host's page.
  // Users opt into the drawer; the checkout and menu remain unobstructed.
  const [activityOpen, setActivityOpen] = useState(false);
  const itemCount = state?.cart?.items.reduce((count, item) => count + item.quantity, 0) ?? 0;
  const sdkLogs = logs;

  return <>
    <header className="site-header">
      <Link className="brand" href="/">{bootstrap.logoUrl ? <img src={bootstrap.logoUrl} alt="" /> : <span className="brand-mark">FP</span>}<span>{bootstrap.businessName || "Food Papa"}</span></Link>
      <nav aria-label="Primary"><Link href="/">Menu</Link><Link href="/checkout">Checkout</Link><Link href="/profile">Profile</Link><a href="#about">About</a></nav>
      <div className="header-actions">
        <button className="cart-trigger" onClick={() => setCartOpen(true)} aria-label="Open cart">Bag <b>{itemCount}</b></button>
      </div>
    </header>
    <main>{children}</main>
    <footer id="about" className="site-footer"><div><strong>{bootstrap.businessName || "Food Papa"}</strong><p>Composable ordering runtime for any host app.</p></div><p>Checkout MFE · SDK mount ready</p></footer>
    {cartOpen && <CartDrawer onClose={() => setCartOpen(false)} />}
    <aside className={`activity-panel ${activityOpen ? "is-open" : "is-collapsed"}`} aria-label="SDK activity log">{activityOpen ? <><div className="activity-heading"><div><p className="eyebrow">SDK activity</p><h2>Runtime trace</h2></div><div className="activity-actions"><span>{sdkLogs.length}</span><button className="text-button" onClick={clearLogs}>Clear</button><button className="activity-toggle" aria-label="Collapse SDK activity" onClick={() => setActivityOpen(false)}>−</button></div></div><div className="activity-status"><span className="status-pulse" />SDK responses only<b>{sdkLogs.length} events</b></div><div className="activity-list">{sdkLogs.length ? [...sdkLogs].reverse().slice(0, 16).map((entry) => <article className={`activity-entry ${entry.status}`} key={entry.id}><div><span className="activity-dot sdk" /><strong>{entry.action}</strong><time>{entry.time}</time></div><p>{entry.detail}</p>{entry.status === "error" ? <span className="activity-next">SDK rejected request</span> : null}</article>) : <div className="activity-empty"><strong>No SDK activity yet</strong><p>SDK actions and responses will appear here.</p></div>}</div></> : <button className="activity-collapsed" aria-label="Expand SDK activity" onClick={() => setActivityOpen(true)}><span className="activity-dot sdk" /><strong>SDK</strong><b>{sdkLogs.length}</b><span>⌃</span></button>}</aside>
  </>;
}

function CartDrawer({ onClose }: { onClose(): void }) {
  const { state, updateQuantity, removeLine, clearCart } = useCommerce();
  const [busy, setBusy] = useState(false);
  const cart = state?.cart;
  const currency = state.bootstrap.currency;
  const money = new Intl.NumberFormat("en-CA", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const handle = async (work: () => Promise<unknown>) => { setBusy(true); try { await work(); } finally { setBusy(false); } };

  return <div className="drawer-layer" role="presentation" onMouseDown={onClose}>
    <aside className="cart-drawer" aria-label="Cart" onMouseDown={(event) => event.stopPropagation()}>
      <div className="drawer-heading"><div><p className="eyebrow">Your order</p><h2>Cart</h2></div><button className="icon-button" onClick={onClose}>×</button></div>
      {!cart?.items.length ? <p className="empty">Your cart is empty.</p> : <>
        <div className="cart-lines">{cart.items.map((item) => <article className="cart-line" key={item.id}>
          <div><strong>{item.name}</strong><span>{money.format(item.lineTotal)}</span></div>
          <div className="cart-line-controls"><div className="quantity"><button disabled={busy} onClick={() => void handle(() => updateQuantity(item, item.quantity - 1))}>−</button><span>{item.quantity}</span><button disabled={busy} onClick={() => void handle(() => updateQuantity(item, item.quantity + 1))}>+</button></div><button className="text-button danger" disabled={busy} onClick={() => void handle(() => removeLine(item.id))}>Remove</button></div>
        </article>)}</div>
        <div className="cart-total"><span>Total</span><strong>{money.format(cart.total)}</strong></div>
        <Link className="button button-primary" href="/checkout" onClick={onClose}>Secure checkout</Link>
        <button className="text-button" disabled={busy} onClick={() => void handle(clearCart)}>Clear cart</button>
      </>}
    </aside>
  </div>;
}
