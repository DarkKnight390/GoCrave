import { useCallback, useMemo, useState } from "react";

/**
 * Admin Data Table Component
 * Feature-rich table with sorting, filtering, pagination, and bulk actions
 *
 * @param {Object} props
 * @param {Array} props.columns - Column definitions [{key, label, sortable, render}]
 * @param {Array} props.data - Table data rows
 * @param {Object} props.pagination - {page, pageSize, total}
 * @param {Function} props.onPageChange - (page) => void
 * @param {Function} props.onSort - (key, direction) => void
 * @param {string} props.sortBy - Current sort column
 * @param {string} props.sortDirection - "asc" or "desc"
 * @param {Array} props.bulkActions - [{label, onClick, requiresSelection}]
 * @param {Array} props.selectedRows - Array of selected row keys
 * @param {Function} props.onSelectRows - (keys) => void
 * @param {boolean} props.loading - Show loading state
 * @param {string} props.emptyMessage - Message when no data
 */
export default function AdminDataTable({
  columns = [],
  data = [],
  pagination = { page: 1, pageSize: 25, total: 0 },
  onPageChange = () => {},
  onSort = () => {},
  sortBy = null,
  sortDirection = "asc",
  bulkActions = [],
  selectedRows = [],
  onSelectRows = () => {},
  loading = false,
  emptyMessage = "No data found",
}) {
  const [hoveredRow, setHoveredRow] = useState(null);

  const paginatedData = useMemo(() => {
    // If pagination handled server-side, data is already paginated
    // Otherwise, slice here
    if (pagination.total === undefined || pagination.total === data.length) {
      return data;
    }
    const start = (pagination.page - 1) * pagination.pageSize;
    const end = start + pagination.pageSize;
    return data.slice(start, end);
  }, [data, pagination]);

  const pageCount = Math.ceil((pagination.total || data.length) / pagination.pageSize);

  const handleSelectAll = (checked) => {
    if (checked) {
      const allKeys = paginatedData.map((row, idx) => idx);
      onSelectRows(allKeys);
    } else {
      onSelectRows([]);
    }
  };

  const handleSelectRow = (idx, checked) => {
    if (checked) {
      onSelectRows([...selectedRows, idx]);
    } else {
      onSelectRows(selectedRows.filter((i) => i !== idx));
    }
  };

  const handleColumnSort = (columnKey) => {
    const column = columns.find((c) => c.key === columnKey);
    if (!column || !column.sortable) return;

    let newDirection = "asc";
    if (sortBy === columnKey && sortDirection === "asc") {
      newDirection = "desc";
    }

    onSort(columnKey, newDirection);
  };

  const isAllSelected =
    paginatedData.length > 0 && selectedRows.length === paginatedData.length;

  const hasSelected = selectedRows.length > 0;

  if (loading) {
    return (
      <div className="admin-table-wrapper">
        <div className="admin-table-loading">
          <div className="admin-spinner"></div>
          <p>Loading data...</p>
        </div>
      </div>
    );
  }

  if (paginatedData.length === 0) {
    return (
      <div className="admin-table-wrapper">
        <div className="admin-table-empty">
          <p>{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-table-wrapper">
      {bulkActions.length > 0 && (
        <div className="admin-table-bulk-actions">
          <div className="admin-table-bulk-info">
            {isAllSelected ? (
              <span>{paginatedData.length} of {paginatedData.length} selected</span>
            ) : (
              <span>{selectedRows.length} selected</span>
            )}
          </div>
          <div className="admin-table-bulk-buttons">
            {bulkActions.map((action) => (
              <button
                key={action.label}
                className="admin-table-bulk-btn"
                onClick={() => action.onClick(selectedRows)}
                disabled={action.requiresSelection && !hasSelected}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <table className="admin-table">
        <thead>
          <tr>
            {bulkActions.length > 0 && (
              <th className="admin-table-checkbox-col">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  aria-label="Select all rows"
                />
              </th>
            )}
            {columns.map((column) => (
              <th
                key={column.key}
                className={column.sortable ? "admin-table-sortable" : ""}
                onClick={() => column.sortable && handleColumnSort(column.key)}
              >
                <div className="admin-table-header-cell">
                  <span>{column.label}</span>
                  {column.sortable && (
                    <span className="admin-table-sort-indicator">
                      {sortBy === column.key ? (
                        sortDirection === "asc" ? (
                          <span>^</span>
                        ) : (
                          <span>v</span>
                        )
                      ) : (
                        <span className="admin-table-sort-icon">-</span>
                      )}
                    </span>
                  )}
                </div>
              </th>
            ))}
            <th className="admin-table-actions-col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {paginatedData.map((row, idx) => (
            <tr
              key={idx}
              className={`admin-table-row ${hoveredRow === idx ? "admin-table-row-hover" : ""}`}
              onMouseEnter={() => setHoveredRow(idx)}
              onMouseLeave={() => setHoveredRow(null)}
            >
              {bulkActions.length > 0 && (
                <td className="admin-table-checkbox-col" data-label="Select">
                  <input
                    type="checkbox"
                    checked={selectedRows.includes(idx)}
                    onChange={(e) => handleSelectRow(idx, e.target.checked)}
                    aria-label={`Select row ${idx}`}
                  />
                </td>
              )}
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`admin-table-cell admin-table-cell-${column.key}`}
                  data-label={column.label}
                >
                  {column.render ? column.render(row[column.key], row, idx) : row[column.key]}
                </td>
              ))}
              <td className="admin-table-actions-col" data-label="Actions">
                {row.actions && (
                  <div className="admin-table-row-actions">
                    {row.actions.map((action) => (
                      <button
                        key={action.label}
                        className="admin-table-action-btn"
                        onClick={() => action.onClick(row)}
                        title={action.label}
                      >
                        {action.icon || action.label}
                      </button>
                    ))}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {pageCount > 1 && (
        <div className="admin-table-pagination">
          <button
            className="admin-table-pagination-btn"
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page === 1}
          >
            Previous
          </button>

          <div className="admin-table-pagination-info">
            Page {pagination.page} of {pageCount}
            {pagination.total && (
              <span className="admin-table-pagination-total">
                ({pagination.total} total items)
              </span>
            )}
          </div>

          <button
            className="admin-table-pagination-btn"
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page === pageCount}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}



