import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore";
import { useCartStore } from "../../store/useCartStore";
import {
  createLiveLocationSession,
  createOrder,
  updateOrderLiveLocation,
} from "../../services/rtdb.service";
import { listenDeliveryFee } from "../../services/settings.service";
import { MapContainer, TileLayer, CircleMarker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const money = (n) =>
  new Intl.NumberFormat("en-JM", { style: "currency", currency: "JMD" }).format(n || 0);

const deliveryFeeDefault = 300;

const liveDurations = [
  { label: "15m", value: 15 * 60 * 1000 },
  { label: "30m", value: 30 * 60 * 1000 },
  { label: "1h", value: 60 * 60 * 1000 },
  { label: "Until delivery", value: 0 },
];

export default function CustomerCheckout() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const cart = useCartStore();
  const incItem = useCartStore((s) => s.inc);
  const decItem = useCartStore((s) => s.dec);
  const removeItem = useCartStore((s) => s.removeItem);

  const [form, setForm] = useState({
    name: profile?.name || "",
    phone: profile?.phone || "",
    address: profile?.workplaceLocation || "",
    notes: "",
    paymentMethod: profile?.defaultPaymentMethod || "cash",
    tip: "",
  });

  const [liveOn, setLiveOn] = useState(false);
  const [durationMs, setDurationMs] = useState(liveDurations[1].value);
  const [customMinutes, setCustomMinutes] = useState("");
  const [locationHint, setLocationHint] = useState("");
  const [locationCoords, setLocationCoords] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [deliveryFee, setDeliveryFee] = useState(deliveryFeeDefault);

  useEffect(() => {
    const unsub = listenDeliveryFee((fee) => {
      if (fee === null || fee === undefined) {
        setDeliveryFee(deliveryFeeDefault);
        return;
      }
      setDeliveryFee(fee);
    });
    return () => unsub?.();
  }, []);

  const subtotal = cart.subtotal();
  const tipValue = Number(form.tip || 0);
  const total = subtotal + deliveryFee + tipValue;

  const durationLabel = useMemo(() => {
    const match = liveDurations.find((d) => d.value === durationMs);
    if (match) return match.label;
    return `${Math.max(1, Math.floor(durationMs / 60000))}m`;
  }, [durationMs]);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const setCustomDuration = (value) => {
    const minutes = Number(value);
    setCustomMinutes(value);
    if (!Number.isNaN(minutes) && minutes > 0) {
      setDurationMs(minutes * 60 * 1000);
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationHint("Location not supported on this device.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setLocationCoords(coords);
        setLocationHint("Using your current location.");
      },
      () => setLocationHint("Unable to read your current location.")
    );
  };

  const placeOrder = async () => {
    setError("");

    if (!user?.uid) {
      setError("Please log in to place an order.");
      return;
    }

    if (cart.items.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    if (!form.phone.trim()) {
      setError("Phone number is required.");
      return;
    }

    if (!form.address.trim()) {
      setError("Delivery address is required.");
      return;
    }

    if (!form.paymentMethod.trim()) {
      setError("Select a payment method.");
      return;
    }

    setSubmitting(true);

    try {
      const delivery = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        addressText: form.address.trim(),
        notes: form.notes.trim(),
      };

      const pricing = {
        subtotal,
        deliveryFee,
        tip: tipValue,
        total,
      };

      const payment = { method: form.paymentMethod.trim().toLowerCase() };

      const liveLocation = liveOn
        ? {
            enabled: true,
            sessionId: null,
            expiresAt: durationMs ? Date.now() + durationMs : null,
            customerLatLng: locationCoords || null,
            runnerVisible: false,
          }
        : { enabled: false };

      const order = await createOrder({
        restaurantId: cart.restaurant?.id || null,
        restaurantName: cart.restaurant?.name || "",
        items: cart.items,
        pricing,
        delivery,
        payment,
        liveLocation,
      });

      if (liveOn) {
        const session = await createLiveLocationSession({
          orderId: order.orderId,
          customerUid: user.uid,
          expiresAt: durationMs ? Date.now() + durationMs : null,
        });

        await updateOrderLiveLocation(order.orderId, {
          enabled: true,
          sessionId: session.sessionId,
          expiresAt: session.expiresAt,
          customerLatLng: locationCoords || null,
          runnerVisible: false,
        });
      }

      cart.clearCart();
      navigate("/customer/checkout/finding", { state: { orderId: order.orderId } });
    } catch (err) {
      setError(err?.message || "Failed to place order.");
    } finally {
      setSubmitting(false);
    }
  };

  const primaryItem = cart.items[0];

  return (
    <div className="gc-checkoutShell">
      <div className="gc-checkoutHeaderBar">
        <button className="gc-checkoutBack" type="button" onClick={() => navigate(-1)}>
          ←
        </button>
        <div>
          <div className="gc-checkoutTitle">Checkout</div>
          <div className="gc-checkoutSub">Confirm details and place order</div>
        </div>
      </div>

      <div className="gc-checkoutCard">
        <div className="gc-checkoutItem">
          <div>
            <div className="gc-checkoutItemName">
              {primaryItem?.name || "Order summary"}
            </div>
            <div className="gc-checkoutItemSub">
              {cart.restaurant?.name || "Restaurant"} • {cart.items.length || 0} items
            </div>
          </div>
          <div className="gc-checkoutItemPrice">{money(total)}</div>
        </div>

        <div className="gc-checkoutRow">
          <span className="gc-checkoutLabel">Delivery address</span>
          <span className="gc-checkoutValue">{form.address || "Add address"}</span>
        </div>

        <div className="gc-checkoutRow">
          <span className="gc-checkoutLabel">Payment</span>
          <span className="gc-checkoutValue">{form.paymentMethod || "cash"}</span>
        </div>

        <div className="gc-checkoutTotals">
          <div className="gc-checkoutTotalsRow">
            <span>Subtotal</span>
            <span>{money(subtotal)}</span>
          </div>
          <div className="gc-checkoutTotalsRow">
            <span>Delivery fee</span>
            <span>{money(deliveryFee)}</span>
          </div>
          <div className="gc-checkoutTotalsRow">
            <span>Tip</span>
            <span>{money(tipValue)}</span>
          </div>
          <div className="gc-checkoutTotalsRow total">
            <span>Total</span>
            <span>{money(total)}</span>
          </div>
        </div>

        <button
          className="gc-checkoutBtn"
          type="button"
          disabled={submitting || cart.items.length === 0}
          onClick={placeOrder}
        >
          {submitting ? "Placing order..." : "Place Order"}
        </button>

        {error ? <div className="gc-checkoutError">{error}</div> : null}
      </div>

      <div className="gc-checkoutSection">
        <div className="gc-checkoutSectionTitle">Delivery details</div>
        <div className="gc-checkoutGrid">
          <input
            className="gc-checkoutInput"
            placeholder="Name (optional)"
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
          />
          <input
            className="gc-checkoutInput"
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => setField("phone", e.target.value)}
          />
          <input
            className="gc-checkoutInput"
            placeholder="Delivery address"
            value={form.address}
            onChange={(e) => setField("address", e.target.value)}
          />
          <input
            className="gc-checkoutInput"
            placeholder="Notes for runner"
            value={form.notes}
            onChange={(e) => setField("notes", e.target.value)}
          />
        </div>
      </div>

      <div className="gc-checkoutSection">
        <div className="gc-checkoutSectionHeader">
          <div className="gc-checkoutSectionTitle">Live location</div>
          <label className="gc-toggle">
            <input
              type="checkbox"
              checked={liveOn}
              onChange={(e) => setLiveOn(e.target.checked)}
            />
            <span>Enable</span>
          </label>
        </div>

        {liveOn ? (
          <div className="gc-liveWrap">
            <div className="gc-liveChips">
              {liveDurations.map((duration) => (
                <button
                  key={duration.label}
                  className={`gc-chip ${durationMs === duration.value ? "isActive" : ""}`}
                  type="button"
                  onClick={() => setDurationMs(duration.value)}
                >
                  {duration.label}
                </button>
              ))}
              <div className="gc-liveCustom">
                <input
                  className="gc-checkoutInput gc-liveInput"
                  placeholder="Custom (min)"
                  value={customMinutes}
                  onChange={(e) => setCustomDuration(e.target.value)}
                />
              </div>
            </div>
            <div className="gc-liveRow">
              <button className="gc-miniBtn brand" type="button" onClick={useCurrentLocation}>
                Use my current location
              </button>
              <div className="gc-checkoutHint">{durationLabel} share</div>
            </div>
            <div className="gc-liveMap">
              <div className="gc-liveMapTitle">Location preview</div>
              <div className="gc-liveMapBody">
                {locationHint || "Tap on the map to drop a pin."}
              </div>
              <div className="gc-livePicker">
                <MapContainer
                  center={[18.0123, -76.79]}
                  zoom={15}
                  scrollWheelZoom={false}
                  className="gc-livePickerMap"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <LocationPicker
                    onPick={(coords) => {
                      setLocationCoords(coords);
                      setLocationHint("Pinned location selected.");
                    }}
                  />
                  {locationCoords ? (
                    <CircleMarker
                      center={[locationCoords.lat, locationCoords.lng]}
                      radius={10}
                      pathOptions={{ color: "#2563eb" }}
                    />
                  ) : null}
                </MapContainer>
              </div>
            </div>
          </div>
        ) : (
          <p className="gc-checkoutHint">Share your live location to speed up delivery.</p>
        )}
      </div>

      <div className="gc-checkoutSection">
        <div className="gc-checkoutSectionTitle">Payment</div>
        <div className="gc-checkoutGrid">
          <select
            className="gc-checkoutInput"
            value={form.paymentMethod}
            onChange={(e) => setField("paymentMethod", e.target.value)}
          >
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="lynk">Lynk</option>
          </select>
          <input
            className="gc-checkoutInput"
            placeholder="Tip (optional)"
            value={form.tip}
            onChange={(e) => setField("tip", e.target.value)}
          />
        </div>
      </div>

      <div className="gc-checkoutSection">
        <div className="gc-checkoutSectionTitle">Order summary</div>
        {cart.items.length === 0 ? (
          <p className="gc-checkoutHint">Your cart is empty.</p>
        ) : (
          <div className="gc-summary">
            <div className="gc-checkoutHint">Restaurant: {cart.restaurant?.name || "-"}</div>
            <div className="gc-checkoutHint">Runner: {cart.runner?.name || "-"}</div>
            <div className="gc-summaryList">
              {cart.items.map((item) => (
                <div key={item.cartId || item.id} className="gc-summaryRow">
                  <div className="gc-summaryItem">
                    {item.thumb ? (
                      <img className="gc-summaryThumb" src={item.thumb} alt={item.name} />
                    ) : null}
                    <div>
                      <div className="gc-summaryName">{item.name}</div>
                      <div className="gc-summaryMeta">
                        Qty {item.qty} - {money(item.price)} each
                      </div>
                      {item.options?.length ? (
                        <div className="gc-summaryMeta">
                          {item.options
                            .map((group) => group.choices.map((c) => c.label).join(" / "))
                            .filter(Boolean)
                            .join(" / ")}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="gc-summaryActions">
                    <div className="gc-summaryPrice">{money(item.price * item.qty)}</div>
                    <div className="gc-qtyControls">
                      <button
                        className="gc-qtyBtn"
                        type="button"
                        onClick={() => decItem(item.cartId || item.id)}
                        aria-label="Decrease quantity"
                      >
                        -
                      </button>
                      <button
                        className="gc-qtyBtn"
                        type="button"
                        onClick={() => incItem(item.cartId || item.id)}
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                      <button
                        className="gc-qtyRemove"
                        type="button"
                        onClick={() => removeItem(item.cartId || item.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LocationPicker({ onPick }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}
