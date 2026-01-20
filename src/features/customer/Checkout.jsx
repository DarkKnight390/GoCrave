import { useEffect, useState } from "react";
import { useAuthStore } from "../../store/useAuthStore";

const paymentOptions = ["Cash", "Lynk", "Bank Transfer"];

export default function Checkout() {
  const profile = useAuthStore((s) => s.profile);

  const [delivery, setDelivery] = useState({
    name: "",
    phone: "",
    workplaceLocation: "",
    paymentMethod: "Cash",
  });

  useEffect(() => {
    setDelivery({
      name: profile?.name || "",
      phone: profile?.phone || "",
      workplaceLocation: profile?.workplaceLocation || "",
      paymentMethod: profile?.defaultPaymentMethod || "Cash",
    });
  }, [profile]);

  const setField = (key, value) => setDelivery((d) => ({ ...d, [key]: value }));

  const onPlaceOrder = (e) => {
    e.preventDefault();
    // Next step: create an order in RTDB using these details
    alert(
      `Order placed!\n\nName: ${delivery.name}\nPhone: ${delivery.phone}\nDeliver to: ${delivery.workplaceLocation}\nPay: ${delivery.paymentMethod}`
    );
  };

  return (
    <div className="gc-page">
      <div className="gc-topbar">
        <div>
          <div className="gc-pill">✅ Checkout</div>
          <h1 className="gc-h1">Confirm delivery</h1>
          <p className="gc-hint">We pre-filled this from your Profile.</p>
        </div>
      </div>

      <form className="gc-cardMini" onSubmit={onPlaceOrder}>
        <div className="gc-field">
          <label className="gc-label">Name</label>
          <input className="gc-input" value={delivery.name} onChange={(e) => setField("name", e.target.value)} required />
        </div>

        <div className="gc-field">
          <label className="gc-label">Phone</label>
          <input className="gc-input" value={delivery.phone} onChange={(e) => setField("phone", e.target.value)} inputMode="tel" />
        </div>

        <div className="gc-field">
          <label className="gc-label">Workplace location</label>
          <input
            className="gc-input"
            value={delivery.workplaceLocation}
            onChange={(e) => setField("workplaceLocation", e.target.value)}
            required
          />
        </div>

        <div className="gc-field">
          <label className="gc-label">Payment method</label>
          <select className="gc-input" value={delivery.paymentMethod} onChange={(e) => setField("paymentMethod", e.target.value)}>
            {paymentOptions.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <button className="gc-btn">Place order</button>
      </form>
    </div>
  );
}
