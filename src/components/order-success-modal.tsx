"use client";

type OrderSuccessModalProps = {
  orderNumber?: string;
  onOrderAgain(): void;
};

export function OrderSuccessModal({
  orderNumber,
  onOrderAgain,
}: OrderSuccessModalProps) {
  return (
    <div className="order-success-backdrop">
      <div
        className="order-success-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-success-title"
      >
        <div className="order-success-icon" aria-hidden="true">
          ✓
        </div>
        <p className="eyebrow">Order confirmed</p>
        <h2 id="order-success-title">Order placed successfully</h2>
        <p className="order-success-copy">
          {orderNumber ? `Order ${orderNumber} has been accepted.` : "Your order has been accepted."}
        </p>
        <div className="order-success-actions">
          <button className="button button-primary" type="button" onClick={onOrderAgain}>
            Order again
          </button>
          <a className="button button-secondary" href="/profile">
            View account
          </a>
        </div>
      </div>
    </div>
  );
}
