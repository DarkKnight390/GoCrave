import { useEffect, useMemo, useState } from "react";
import AdminDataTable from "./components/shared/AdminDataTable";
import {
  createPromotion,
  deletePromotion,
  listenPromotions,
  updatePromotion,
} from "../../services/promotions.service";
import { uploadImage } from "../../services/storage.service";

const toDateInput = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const fromDateInput = (value) => {
  if (!value) return 0;
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const formatDate = (value) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return "-";
  }
};

export default function AdminPromotions() {
  const [promotions, setPromotions] = useState([]);
  const [editingId, setEditingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imageError, setImageError] = useState("");
  const [form, setForm] = useState({
    title: "",
    subtitle: "",
    badge: "",
    ctaText: "",
    ctaLink: "",
    imageUrl: "",
    startsAt: "",
    endsAt: "",
    isActive: true,
  });

  useEffect(() => {
    const unsub = listenPromotions(setPromotions);
    return () => unsub();
  }, []);

  const resetForm = () => {
    setEditingId("");
    setImageFile(null);
    setImageError("");
    setForm({
      title: "",
      subtitle: "",
      badge: "",
      ctaText: "",
      ctaLink: "",
      imageUrl: "",
      startsAt: "",
      endsAt: "",
      isActive: true,
    });
  };

  const onEdit = (promo) => {
    setEditingId(promo.promoId);
    setImageFile(null);
    setImageError("");
    setForm({
      title: promo.title || "",
      subtitle: promo.subtitle || "",
      badge: promo.badge || "",
      ctaText: promo.ctaText || "",
      ctaLink: promo.ctaLink || "",
      imageUrl: promo.imageUrl || "",
      startsAt: toDateInput(promo.startsAt),
      endsAt: toDateInput(promo.endsAt),
      isActive: promo.isActive !== false,
    });
  };

  const onSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setImageError("");
    try {
      let imageUrl = form.imageUrl.trim();
      if (imageFile) {
        if (imageFile.size > 5 * 1024 * 1024) {
          setImageError("Image too large (max 5MB).");
          return;
        }
        const safeName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `promotions/${Date.now()}-${safeName}`;
        imageUrl = await uploadImage(path, imageFile);
      }
      const payload = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim(),
        badge: form.badge.trim(),
        ctaText: form.ctaText.trim(),
        ctaLink: form.ctaLink.trim(),
        imageUrl,
        startsAt: fromDateInput(form.startsAt),
        endsAt: fromDateInput(form.endsAt),
        isActive: form.isActive,
      };
      if (!payload.title) return;

      if (editingId) {
        await updatePromotion(editingId, payload);
      } else {
        await createPromotion(payload);
      }
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const rows = useMemo(() => promotions || [], [promotions]);

  const columns = [
    { key: "title", label: "Title" },
    { key: "subtitle", label: "Subtitle" },
    { key: "badge", label: "Badge" },
    {
      key: "ctaText",
      label: "CTA",
      render: (val, row) => (val ? `${val}${row.ctaLink ? " ->" : ""}` : "-"),
    },
    {
      key: "status",
      label: "Status",
      render: (_, row) => (
        <span className={`admin-payroll ${row.isActive ? "isOpen" : "isLocked"}`}>
          {row.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "period",
      label: "Period",
      render: (_, row) =>
        row.startsAt || row.endsAt
          ? `${formatDate(row.startsAt)} - ${formatDate(row.endsAt)}`
          : "Always on",
    },
  ];

  return (
    <div className="admin-promos">
      <div className="admin-card">
        <div className="admin-card-header">
          <div>
            <h3 className="admin-card-title">Create Promotion</h3>
            <p className="admin-card-sub">Promotions appear on the customer home screen.</p>
          </div>
        </div>

        <form className="admin-promo-form" onSubmit={onSave}>
          <input
            className="admin-input"
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <input
            className="admin-input"
            placeholder="Subtitle"
            value={form.subtitle}
            onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
          />
          <input
            className="admin-input"
            placeholder="Badge (e.g. LIMITED)"
            value={form.badge}
            onChange={(e) => setForm({ ...form, badge: e.target.value })}
          />
          <input
            className="admin-input"
            placeholder="CTA text (e.g. Order now)"
            value={form.ctaText}
            onChange={(e) => setForm({ ...form, ctaText: e.target.value })}
          />
          <input
            className="admin-input"
            placeholder="CTA link (optional)"
            value={form.ctaLink}
            onChange={(e) => setForm({ ...form, ctaLink: e.target.value })}
          />
          <input
            className="admin-input"
            placeholder="Image URL (optional)"
            value={form.imageUrl}
            onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
          />
          <label className="admin-file">
            Upload image
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            />
          </label>
          {imageFile && (
            <div className="admin-file-meta">
              Selected: {imageFile.name}
            </div>
          )}
          {imageError && <div className="admin-error">{imageError}</div>}
          <div className="admin-promo-dates">
            <label>
              Start date
              <input
                type="date"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              />
            </label>
            <label>
              End date
              <input
                type="date"
                value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
              />
            </label>
          </div>
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active
          </label>

          <div className="admin-promo-actions">
            <button className="admin-primary" type="submit" disabled={saving}>
              {editingId ? "Update Promotion" : "Create Promotion"}
            </button>
            {editingId && (
              <button className="admin-ghost" type="button" onClick={resetForm}>
                Cancel edit
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <div>
            <h3 className="admin-card-title">Promotions</h3>
            <p className="admin-card-sub">Manage what customers see.</p>
          </div>
        </div>

        <AdminDataTable
          columns={columns}
          data={rows.map((promo) => ({
            ...promo,
            actions: [
              { label: "Edit", onClick: () => onEdit(promo) },
              {
                label: promo.isActive ? "Disable" : "Enable",
                onClick: () => updatePromotion(promo.promoId, { isActive: !promo.isActive }),
              },
              { label: "Delete", onClick: () => deletePromotion(promo.promoId) },
            ],
          }))}
          emptyMessage="No promotions yet."
        />
      </div>
    </div>
  );
}
