/**
 * Admin Timeline Component
 * Display ordered events/activities in timeline format
 *
 * @param {Object} props
 * @param {Array} props.events - [{timestamp, title, description, type, icon}]
 * @param {string} props.orientation - "vertical" (default) or "horizontal"
 */
export default function AdminTimeline({
  events = [],
  orientation = "vertical",
}) {
  if (events.length === 0) {
    return <div className="admin-timeline-empty">No events</div>;
  }

  const eventTypeConfig = {
    created: { color: "#3b82f6", label: "Created" },
    updated: { color: "#8b5cf6", label: "Updated" },
    accepted: { color: "#10b981", label: "Accepted" },
    rejected: { color: "#ef4444", label: "Rejected" },
    delivered: { color: "#10b981", label: "Delivered" },
    cancelled: { color: "#ef4444", label: "Cancelled" },
    paused: { color: "#f59e0b", label: "Paused" },
    resumed: { color: "#10b981", label: "Resumed" },
    completed: { color: "#10b981", label: "Completed" },
    status_change: { color: "#8b5cf6", label: "Status Change" },
    warning: { color: "#dc2626", label: "Warning" },
    default: { color: "#6b7280", label: "Event" },
  };

  return (
    <div className={`admin-timeline admin-timeline-${orientation}`}>
      {events.map((event, idx) => {
        const typeConfig = eventTypeConfig[event.type] || eventTypeConfig.default;
        const timestamp = new Date(event.timestamp);
        const timeStr = timestamp.toLocaleString([], {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        return (
          <div key={idx} className="admin-timeline-item">
            <div className="admin-timeline-marker" style={{ backgroundColor: typeConfig.color }}>
              {event.icon || "*"}
            </div>
            <div className="admin-timeline-content">
              <div className="admin-timeline-header">
                <h4 className="admin-timeline-title">{event.title}</h4>
                <span
                  className="admin-timeline-type-badge"
                  style={{ color: typeConfig.color, borderColor: typeConfig.color }}
                >
                  {typeConfig.label}
                </span>
              </div>
              {event.description && (
                <p className="admin-timeline-description">{event.description}</p>
              )}
              <p className="admin-timeline-timestamp">{timeStr}</p>
              {event.metadata && (
                <div className="admin-timeline-metadata">
                  {Object.entries(event.metadata).map(([key, value]) => (
                    <div key={key} className="admin-timeline-meta-item">
                      <span className="admin-timeline-meta-key">{key}:</span>
                      <span className="admin-timeline-meta-value">{String(value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}


