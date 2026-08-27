"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useCommerce } from "@/components/commerce-provider";

export function SiteShell({ children }: { children: ReactNode }) {
  const { bootstrap, commerceEnabled, setCommerceEnabled, state } = useCommerce();
  const [cartOpen, setCartOpen] = useState(false);
  const itemCount = state?.cart?.items.reduce((count, item) => count + item.quantity, 0) ?? 0;

  return <>
    <header className="site-header">
      <Link className="brand" href="/">{bootstrap.logoUrl ? <img src={bootstrap.logoUrl} alt="" /> : <span className="brand-mark">FP</span>}<span>{bootstrap.businessName || "Food Papa"}</span></Link>
      <nav aria-label="Primary"><Link href="/">Menu</Link><a href="#about">About</a></nav>
      <div className="header-actions">
        <label className="commerce-toggle"><span>E-commerce</span><input checked={commerceEnabled} onChange={(event) => setCommerceEnabled(event.target.checked)} type="checkbox" /><i aria-hidden="true" /></label>
        <button className="cart-trigger" disabled={!commerceEnabled} onClick={() => setCartOpen(true)} aria-label="Open cart">Bag <b>{itemCount}</b></button>
      </div>
    </header>
    <main>{children}</main>
    <footer id="about" className="site-footer"><div><strong>{bootstrap.businessName || "Food Papa"}</strong><p>Third-party commerce integration demo.</p></div><p>Cart logic: <code>@zafeer/cart</code> · Checkout: <code>@zafeer/checkout-sdk</code></p></footer>
    {cartOpen && <CartDrawer onClose={() => setCartOpen(false)} />}
  </>;
}

function CartDrawer({ onClose }: { onClose(): void }) {
  const { state, updateQuantity, removeLine, clearCart } = useCommerce();
  const [busy, setBusy] = useState(false);
  const cart = state?.cart;
  const currency = state?.bootstrap?.currency ?? "CAD";
  const money = new Intl.NumberFormat("en-CA", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const handle = async (work: () => Promise<unknown>) => { setBusy(true); try { await work(); } finally { setBusy(false); } };

  return <div className="drawer-layer" role="presentation" onMouseDown={onClose}>
    <aside className="cart-drawer" aria-label="Cart" onMouseDown={(event) => event.stopPropagation()}>
      <div className="drawer-heading"><div><p className="eyebrow">Your order</p><h2>Cart</h2></div><button className="icon-button" onClick={onClose}>×</button></div>
      {state?.error ? <p className="notice error" role="alert">{state.error.message}</p> : null}
      {!cart?.items.length ? <p className="empty">Your cart is empty.</p> : <>
        <div className="cart-lines">{cart.items.map((item) => <article className="cart-line" key={item.id}>
          <div><strong>{item.name}</strong><span>{money.format(item.lineTotal.amount)}</span></div>
          <div className="cart-line-controls"><div className="quantity"><button disabled={busy} onClick={() => void handle(() => updateQuantity(item, item.quantity - 1))}>−</button><span>{item.quantity}</span><button disabled={busy} onClick={() => void handle(() => updateQuantity(item, item.quantity + 1))}>+</button></div><button className="text-button danger" disabled={busy} onClick={() => void handle(() => removeLine(item.id))}>Remove</button></div>
        </article>)}</div>
        <div className="cart-total"><span>Total</span><strong>{money.format(cart.total.amount)}</strong></div>
        <Link className="button button-primary" href="/checkout" onClick={onClose}>Secure checkout</Link>
        <button className="text-button" disabled={busy} onClick={() => void handle(clearCart)}>Clear cart</button>
      </>}
    </aside>
  </div>;
}
