import { useMemo } from "react";

/**
 * Admin KPI Card Component
 * Displays key metrics with trend indicator
 *
 * @param {Object} props
 * @param {string} props.title - Card title
 * @param {number|string} props.value - Main metric value
 * @param {number} props.change - Change percentage (positive/negative)
 * @param {string} props.icon - Icon name or emoji
 * @param {string} props.trend - "up" or "down" (auto-detected from change if not provided)
 * @param {string} props.period - "today", "this month", "all time"
 * @param {Function} props.onClick - Click handler
 * @param {string} props.className - Additional CSS classes
 */
export default function AdminKPICard({
  title,
  value,
  change,
  icon,
  trend,
  period = "today",
  onClick,
  className = "",
}) {
  const trendDirection = useMemo(() => {
    if (trend) return trend;
    if (change === null || change === undefined) return null;
    return change >= 0 ? "up" : "down";
  }, [trend, change]);

  const trendColor = trendDirection === "up" ? "#10b981" : "#ef4444";
  const trendSymbol = trendDirection === "up" ? "^" : "v";

  const handleClick = () => {
    if (onClick) onClick();
  };

  return (
    <div
      className={`admin-kpi-card ${onClick ? "admin-kpi-clickable" : ""} ${className}`}
      onClick={handleClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                handleClick();
              }
            }
          : undefined
      }
    >
      <div className="admin-kpi-header">
        <div className="admin-kpi-info">
          <h3 className="admin-kpi-title">{title}</h3>
          <p className="admin-kpi-period">{period}</p>
        </div>
        {icon && <div className="admin-kpi-icon">{icon}</div>}
      </div>

      <div className="admin-kpi-value">{value}</div>

      {change !== null && change !== undefined && (
        <div className="admin-kpi-footer">
          <div className="admin-kpi-change" style={{ color: trendColor }}>
            <span className="admin-kpi-trend-symbol">{trendSymbol}</span>
            <span className="admin-kpi-change-value">{Math.abs(change)}%</span>
          </div>
          <span className="admin-kpi-vs">vs last period</span>
        </div>
      )}
    </div>
  );
}
