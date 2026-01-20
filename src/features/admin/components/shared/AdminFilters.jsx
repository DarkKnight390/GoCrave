import { useState } from "react";

/**
 * Admin Filters Panel Component
 * Reusable filter interface with apply/reset functionality
 *
 * @param {Object} props
 * @param {Array} props.filterGroups - [{title, filters: [{key, label, type, options}]}]
 * @param {Object} props.values - Current filter values {key: value}
 * @param {Function} props.onChange - (key, value) => void
 * @param {Function} props.onApply - (values) => void
 * @param {Function} props.onReset - () => void
 * @param {boolean} props.isOpen - Control visibility
 * @param {Function} props.onToggle - () => void
 */
export default function AdminFilters({
  filterGroups = [],
  values = {},
  onChange = () => {},
  onApply = () => {},
  onReset = () => {},
  isOpen = true,
  onToggle = () => {},
}) {
  const [localValues, setLocalValues] = useState(values);

  const handleChange = (key, value) => {
    setLocalValues({ ...localValues, [key]: value });
    onChange(key, value);
  };

  const handleApply = () => {
    onApply(localValues);
  };

  const handleReset = () => {
    setLocalValues({});
    onReset();
  };

  const hasActiveFilters = Object.values(localValues).some(
    (v) => v !== null && v !== undefined && v !== ""
  );

  return (
    <div className="admin-filters-panel">
      <div className="admin-filters-header">
        <h3>Filters</h3>
        <button className="admin-filters-toggle" onClick={onToggle}>
          {isOpen ? "v" : ">"}
        </button>
      </div>

      {isOpen && (
        <div className="admin-filters-content">
          {filterGroups.length === 0 ? (
            <p className="admin-filters-empty">No filters available</p>
          ) : (
            filterGroups.map((group) => (
              <div key={group.title} className="admin-filter-group">
                <h4 className="admin-filter-group-title">{group.title}</h4>

                {group.filters.map((filter) => (
                  <div key={filter.key} className="admin-filter-item">
                    <label className="admin-filter-label">{filter.label}</label>

                    {filter.type === "text" && (
                      <input
                        type="text"
                        className="admin-filter-input"
                        placeholder={filter.placeholder || "Enter value..."}
                        value={localValues[filter.key] || ""}
                        onChange={(e) => handleChange(filter.key, e.target.value)}
                      />
                    )}

                    {filter.type === "select" && (
                      <select
                        className="admin-filter-select"
                        value={localValues[filter.key] || ""}
                        onChange={(e) => handleChange(filter.key, e.target.value)}
                      >
                        <option value="">All {filter.label}</option>
                        {filter.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    )}

                    {filter.type === "multiselect" && (
                      <div className="admin-filter-multiselect">
                        {filter.options.map((opt) => (
                          <label key={opt.value} className="admin-filter-checkbox">
                            <input
                              type="checkbox"
                              checked={(localValues[filter.key] || []).includes(opt.value)}
                              onChange={(e) => {
                                const current = localValues[filter.key] || [];
                                const updated = e.target.checked
                                  ? [...current, opt.value]
                                  : current.filter((v) => v !== opt.value);
                                handleChange(filter.key, updated);
                              }}
                            />
                            <span>{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {filter.type === "daterange" && (
                      <div className="admin-filter-daterange">
                        <input
                          type="date"
                          className="admin-filter-date"
                          value={localValues[`${filter.key}_from`] || ""}
                          onChange={(e) => handleChange(`${filter.key}_from`, e.target.value)}
                          placeholder="From"
                        />
                        <input
                          type="date"
                          className="admin-filter-date"
                          value={localValues[`${filter.key}_to`] || ""}
                          onChange={(e) => handleChange(`${filter.key}_to`, e.target.value)}
                          placeholder="To"
                        />
                      </div>
                    )}

                    {filter.type === "range" && (
                      <div className="admin-filter-range">
                        <input
                          type="number"
                          className="admin-filter-number"
                          placeholder="Min"
                          value={localValues[`${filter.key}_min`] || ""}
                          onChange={(e) => handleChange(`${filter.key}_min`, e.target.value)}
                        />
                        <input
                          type="number"
                          className="admin-filter-number"
                          placeholder="Max"
                          value={localValues[`${filter.key}_max`] || ""}
                          onChange={(e) => handleChange(`${filter.key}_max`, e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}

          <div className="admin-filters-actions">
            <button
              className="admin-filters-apply"
              onClick={handleApply}
            >
              Apply Filters
            </button>
            {hasActiveFilters && (
              <button
                className="admin-filters-reset"
                onClick={handleReset}
              >
                Reset
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


