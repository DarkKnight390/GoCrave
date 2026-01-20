import React, { useState } from "react";

export default function SettingsModal({ open, onClose }) {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [theme, setTheme] = useState("light");

  if (!open) return null;

  const onSave = () => {
    // persist logic can be added later
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1200 }}>
      <div
        onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }}
      />

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: 480,
          maxWidth: "95%",
          background: "#fff",
          borderRadius: 8,
          padding: 18,
          boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>App settings</h3>
          <button onClick={onClose} aria-label="Close settings" style={{ border: "none", background: "none", fontSize: 18 }}>✕</button>
        </div>

        <div style={{ marginTop: 14 }}>
          <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span>Push notifications</span>
            <input type="checkbox" checked={pushEnabled} onChange={(e) => setPushEnabled(e.target.checked)} />
          </label>

          <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span>Theme</span>
            <select value={theme} onChange={(e) => setTheme(e.target.value)}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
            <button onClick={onClose} style={{ padding: "8px 12px" }}>Cancel</button>
            <button onClick={onSave} className="gc-btn">Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
