import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import adminSettingsService from "../../services/adminSettings.service";
import "../styles/admin.css";

const Section = ({ title, children }) => (
  <section className="admin-settings-section">
    <h3 className="admin-settings-section__title">{title}</h3>
    <div className="admin-settings-section__body">{children}</div>
  </section>
);

export default function AdminSettings() {
  const [settings, setSettings] = useState(null);
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let unsub;
    setLoading(true);
    unsub = adminSettingsService.subscribeSettings((snapshot) => {
      setSettings(snapshot || {});
      setDraft(snapshot || {});
      setLoading(false);
    });
    return () => {
      if (unsub) unsub();
    };
  }, []);

  const handleChange = (namespace, key, value) => {
    setDraft((s) => ({
      ...s,
      [namespace]: {
        ...(s[namespace] || {}),
        [key]: value,
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminSettingsService.saveSettings(draft);
      setSettings(draft);
    } catch (err) {
      console.error("Failed to save settings", err);
      alert("Failed to save settings. Check console for details.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Reset all settings to defaults? This will be recorded in audit log.")) return;
    setSaving(true);
    try {
      await adminSettingsService.resetDefaults();
    } catch (err) {
      console.error(err);
      alert("Failed to reset defaults.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="admin-loading">Loading settings...</div>;

  return (
    <div className="admin-settings-page admin-content">
      <header className="admin-page-header">
        <h2>Settings</h2>
        <div className="admin-page-actions">
          <button className="admin-btn admin-btn--secondary" onClick={() => navigate(-1)}>
            Back
          </button>
          <button className="admin-btn" disabled={saving} onClick={handleSave}>
            {saving ? "Saving..." : "Save"}
          </button>
          <button className="admin-btn admin-btn--danger" disabled={saving} onClick={handleReset}>
            Reset to defaults
          </button>
        </div>
      </header>

      <div className="admin-settings-grid">
        <Section title="General & Company Info">
          <label className="admin-field">
            <div className="admin-field__label">Company Name</div>
            <input
              value={(draft.general && draft.general.companyName) || ""}
              onChange={(e) => handleChange("general", "companyName", e.target.value)}
            />
          </label>

          <label className="admin-field">
            <div className="admin-field__label">Support Email</div>
            <input
              value={(draft.general && draft.general.supportEmail) || ""}
              onChange={(e) => handleChange("general", "supportEmail", e.target.value)}
            />
          </label>

        </Section>

        <Section title="Branding & Theming">
          <label className="admin-field">
            <div className="admin-field__label">Primary Color</div>
            <input
              type="color"
              value={(draft.branding && draft.branding.primaryColor) || "#3b82f6"}
              onChange={(e) => handleChange("branding", "primaryColor", e.target.value)}
            />
          </label>

          <label className="admin-field">
            <div className="admin-field__label">Logo URL</div>
            <input
              value={(draft.branding && draft.branding.logoUrl) || ""}
              onChange={(e) => handleChange("branding", "logoUrl", e.target.value)}
            />
          </label>
        </Section>

        <Section title="Security & Authentication">
          <label className="admin-field">
            <div className="admin-field__label">Maintenance Mode</div>
            <input
              type="checkbox"
              checked={(draft.security && draft.security.maintenanceMode) || false}
              onChange={(e) => handleChange("security", "maintenanceMode", e.target.checked)}
            />
          </label>

          <label className="admin-field">
            <div className="admin-field__label">Session Timeout (minutes)</div>
            <input
              type="number"
              value={(draft.security && draft.security.sessionTimeoutMinutes) || 30}
              onChange={(e) => handleChange("security", "sessionTimeoutMinutes", Number(e.target.value))}
            />
          </label>
        </Section>

        <Section title="Payments & Financials">
          <label className="admin-field">
            <div className="admin-field__label">Currency</div>
            <select
              value={(draft.payments && draft.payments.currency) || "NGN"}
              onChange={(e) => handleChange("payments", "currency", e.target.value)}
            >
              <option value="NGN">NGN</option>
              <option value="USD">USD</option>
              <option value="GHS">GHS</option>
            </select>
          </label>

          <label className="admin-field">
            <div className="admin-field__label">Default Delivery Fee</div>
            <input
              type="number"
              value={(draft.payments && draft.payments.defaultDeliveryFee) || 200}
              onChange={(e) => handleChange("payments", "defaultDeliveryFee", Number(e.target.value))}
            />
          </label>
        </Section>

        <Section title="Notifications">
          <label className="admin-field">
            <div className="admin-field__label">Push Enabled</div>
            <input
              type="checkbox"
              checked={(draft.notifications && draft.notifications.pushEnabled) || false}
              onChange={(e) => handleChange("notifications", "pushEnabled", e.target.checked)}
            />
          </label>

          <label className="admin-field">
            <div className="admin-field__label">SMS Enabled</div>
            <input
              type="checkbox"
              checked={(draft.notifications && draft.notifications.smsEnabled) || false}
              onChange={(e) => handleChange("notifications", "smsEnabled", e.target.checked)}
            />
          </label>
        </Section>

      </div>

      <footer className="admin-page-footer">
        <small>All changes are recorded in the audit log.</small>
      </footer>
    </div>
  );
}
