/**
 * Admin Status Badge Component
 * Displays status with appropriate color coding
 *
 * @param {Object} props
 * @param {string} props.status - Status value (e.g., "pending", "active", "delivered")
 * @param {string} props.type - Badge type for styling override
 * @param {string} props.className - Additional CSS classes
 */
export default function AdminStatusBadge({ status = "", type = null, className = "" }) {
  const statusConfig = {
    // Order statuses
    pending: { label: "Pending", color: "#f59e0b", bgColor: "#fffbeb" },
    accepted: { label: "Accepted", color: "#3b82f6", bgColor: "#eff6ff" },
    on_route: { label: "On Route", color: "#8b5cf6", bgColor: "#f5f3ff" },
    picked_up: { label: "Picked Up", color: "#06b6d4", bgColor: "#ecfdf5" },
    delivering: { label: "Delivering", color: "#8b5cf6", bgColor: "#f5f3ff" },
    delivered: { label: "Delivered", color: "#10b981", bgColor: "#ecfdf5" },
    cancelled: { label: "Cancelled", color: "#ef4444", bgColor: "#fef2f2" },
    disputed: { label: "Disputed", color: "#dc2626", bgColor: "#fef2f2" },
    refunded: { label: "Refunded", color: "#6b7280", bgColor: "#f3f4f6" },

    // Runner statuses
    online: { label: "Online", color: "#10b981", bgColor: "#ecfdf5" },
    offline: { label: "Offline", color: "#6b7280", bgColor: "#f3f4f6" },
    on_break: { label: "On Break", color: "#f59e0b", bgColor: "#fffbeb" },
    suspended: { label: "Suspended", color: "#ef4444", bgColor: "#fef2f2" },
    banned: { label: "Banned", color: "#7c2d12", bgColor: "#ffedd5" },

    // Verification statuses
    verified: { label: "Verified", color: "#10b981", bgColor: "#ecfdf5" },
    pending_verification: { label: "Pending", color: "#f59e0b", bgColor: "#fffbeb" },
    rejected: { label: "Rejected", color: "#ef4444", bgColor: "#fef2f2" },

    // General statuses
    active: { label: "Active", color: "#10b981", bgColor: "#ecfdf5" },
    inactive: { label: "Inactive", color: "#6b7280", bgColor: "#f3f4f6" },
    draft: { label: "Draft", color: "#9ca3af", bgColor: "#f3f4f6" },
    published: { label: "Published", color: "#10b981", bgColor: "#ecfdf5" },

    // Support/ticket statuses
    open: { label: "Open", color: "#3b82f6", bgColor: "#eff6ff" },
    "in-progress": { label: "In Progress", color: "#8b5cf6", bgColor: "#f5f3ff" },
    resolved: { label: "Resolved", color: "#10b981", bgColor: "#ecfdf5" },
    closed: { label: "Closed", color: "#6b7280", bgColor: "#f3f4f6" },
  };

  const config = statusConfig[status] || {
    label: status.charAt(0).toUpperCase() + status.slice(1),
    color: "#6b7280",
    bgColor: "#f3f4f6",
  };

  const finalType = type || status;
  const typeClass = `admin-badge-${finalType.replace(/_/g, "-")}`;

  return (
    <span
      className={`admin-badge ${typeClass} ${className}`}
      style={{
        color: config.color,
        backgroundColor: config.bgColor,
        borderColor: config.color,
      }}
    >
      {config.label}
    </span>
  );
}
