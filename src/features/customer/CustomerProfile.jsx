import { useEffect, useState } from "react";
import SettingsModal from "../../components/SettingsModal";
import { useAuthStore } from "../../store/useAuthStore";



const paymentOptions = ["Cash", "Lynk", "Bank Transfer"];

export default function CustomerProfile() {
  const profile = useAuthStore((s) => s.profile);
  const updateProfile = useAuthStore((s) => s.updateProfile);

  const [form, setForm] = useState({
    name: "",
    workplaceLocation: "",
    phone: "",
    defaultPaymentMethod: "Cash",
  });

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setForm({
      name: profile?.name || "",
      workplaceLocation: profile?.workplaceLocation || "",
      phone: profile?.phone || "",
      defaultPaymentMethod: profile?.defaultPaymentMethod || "Cash",
    });
  }, [profile]);

  const initials = (form.name || profile?.name || "GoCrave User")
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const onSave = async (e) => {
    e.preventDefault();
    setMsg("");
    setSaving(true);
    try {
      // small validation
      if (!form.name.trim()) throw new Error("Name is required");
      if (!form.workplaceLocation.trim()) throw new Error("Workplace location is required");

      await updateProfile({
        name: form.name.trim(),
        workplaceLocation: form.workplaceLocation.trim(),
        phone: form.phone.trim(),
        defaultPaymentMethod: form.defaultPaymentMethod,
      });

      setMsg("Saved ✅");
      setTimeout(() => setMsg(""), 1600);
    } catch (err) {
      setMsg(err?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="gc-page" style={{ padding: 0 }}>
      <div className="gc-profileHeader">
        <div className="gc-profileTop">
          <div>
            <div className="gc-pill">🍔 GoCrave Profile</div>
            <h2 className="gc-profileTitle">{form.name || "Your profile"}</h2>
            <p className="gc-profileSub">Update your details for faster checkout.</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="gc-avatarBig">{initials}</div>
            <button
              aria-label="Open settings"
              onClick={() => setSettingsOpen(true)}
              style={{
                border: "none",
                background: "none",
                fontSize: 20,
                cursor: "pointer",
              }}
              title="Settings"
            >
              ⚙️
            </button>
          </div>
        </div>
      </div>

      <div className="gc-profileBody">
        <form className="gc-infoCard" onSubmit={onSave}>
          <h3 className="gc-sectionTitle" style={{ marginBottom: 10 }}>
            Profile details
          </h3>

          <div className="gc-field">
            <label className="gc-label">Name</label>
            <input
              className="gc-input"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="e.g. Damion Brown"
              required
            />
          </div>

          <div className="gc-field">
            <label className="gc-label">Workplace location</label>
            <input
              className="gc-input"
              value={form.workplaceLocation}
              onChange={(e) => setField("workplaceLocation", e.target.value)}
              placeholder="e.g. Innswood BPO - Lobby / 2nd Floor"
              required
            />
          </div>

          <div className="gc-field">
            <label className="gc-label">Phone</label>
            <input
              className="gc-input"
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
              placeholder="e.g. 876-555-1234"
              inputMode="tel"
            />
          </div>

          <div className="gc-field">
            <label className="gc-label">Default payment method</label>
            <select
              className="gc-input"
              value={form.defaultPaymentMethod}
              onChange={(e) => setField("defaultPaymentMethod", e.target.value)}
            >
              {paymentOptions.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <button className="gc-btn" disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </button>

          {msg && (
            <p className={msg.includes("Saved") ? "gc-formSub" : "gc-error"} style={{ marginTop: 10 }}>
              {msg}
            </p>
          )}
        </form>

        <div className="gc-infoCard">
          <h3 className="gc-sectionTitle" style={{ marginBottom: 10 }}>
            Account
          </h3>

          <div className="gc-infoRow">
            <div className="gc-infoKey">Email</div>
            <div className="gc-infoVal">{profile?.email || "—"}</div>
          </div>

          <div className="gc-infoRow">
            <div className="gc-infoKey">Role</div>
            <div className="gc-infoVal" style={{ textTransform: "capitalize" }}>
              {profile?.role || "customer"}
            </div>
          </div>
        </div>
      </div>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
