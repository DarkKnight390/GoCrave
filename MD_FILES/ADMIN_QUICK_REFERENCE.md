# Admin Portal Quick Reference

## Files Created

```
✅ src/features/admin/components/shared/
   ├── AdminKPICard.jsx                 (Metric cards)
   ├── AdminDataTable.jsx               (Advanced table)
   ├── AdminFilters.jsx                 (Filter panel)
   ├── AdminStatusBadge.jsx             (Status indicators)
   └── AdminTimeline.jsx                (Event timeline)

✅ src/features/admin/pages/
   └── dashboard/AdminDashboard.jsx     (Dashboard home)

✅ src/features/admin/styles/
   └── admin.css                        (1200+ lines)

✅ src/features/admin/
   ├── AdminLayout_NEW.jsx              (Updated layout)
   └── AdminLayout.jsx                  (Original - to be replaced)
```

## Deploy in 3 Steps

```bash
# 1. Replace layout file
rm src/features/admin/AdminLayout.jsx
mv src/features/admin/AdminLayout_NEW.jsx src/features/admin/AdminLayout.jsx

# 2. Update src/app/routes.jsx
# Add: import AdminDashboard from "../features/admin/pages/dashboard/AdminDashboard";
# Change route: <Route index element={<AdminDashboard />} />

# 3. Test
npm run dev
# Visit: http://localhost:5173/admin
```

## Component Usage Snippets

### KPI Card
```jsx
<AdminKPICard
  title="Orders Today"
  value={247}
  change={+15}
  icon="📦"
/>
```

### Data Table
```jsx
<AdminDataTable
  columns={[
    { key: "id", label: "ID", sortable: true },
    { key: "name", label: "Name", sortable: true },
  ]}
  data={data}
  pagination={{ page: 1, pageSize: 25, total: 100 }}
/>
```

### Filters
```jsx
<AdminFilters
  filterGroups={[
    {
      title: "Status",
      filters: [
        { key: "status", label: "Status", type: "select", 
          options: [{value: "active", label: "Active"}] },
      ],
    },
  ]}
  onApply={applyFilters}
/>
```

### Status Badge
```jsx
<AdminStatusBadge status="delivered" />
<AdminStatusBadge status="pending" />
<AdminStatusBadge status="online" />
```

### Timeline
```jsx
<AdminTimeline
  events={[
    { timestamp: Date.now(), title: "Order Created", type: "created" },
    { timestamp: Date.now(), title: "Delivered", type: "delivered" },
  ]}
/>
```

## Pre-configured Status Colors

| Status | Color | Use |
|--------|-------|-----|
| pending | Orange | Orders not assigned |
| accepted | Blue | Runner accepted order |
| on_route | Purple | Runner en route |
| picked_up | Cyan | Picked from restaurant |
| delivering | Purple | Delivering to customer |
| delivered | Green | Order delivered ✓ |
| cancelled | Red | Order cancelled |
| online | Green | Runner is online |
| offline | Gray | Runner is offline |
| suspended | Red | Runner suspended |
| verified | Green | Document verified |
| pending_verification | Orange | Awaiting verification |

## CSS Variables (Customize Theme)

Edit `src/features/admin/styles/admin.css` line 5-18:
```css
:root {
  --admin-primary: #3b82f6;      /* Blue - main brand */
  --admin-secondary: #8b5cf6;    /* Purple - secondary */
  --admin-success: #10b981;      /* Green - success */
  --admin-warning: #f59e0b;      /* Orange - warning */
  --admin-danger: #ef4444;       /* Red - danger */
  --admin-dark: #1f2937;         /* Dark gray - bg */
  --admin-light: #f9fafb;        /* Light gray - alt bg */
  /* ... etc ... */
}
```

## Folder Structure for Next Pages

```
src/features/admin/pages/

orders/
├── AdminOrdersList.jsx        (Main orders page)
├── AdminOrderDetail.jsx       (Single order view)
└── AdminOrderBulkActions.jsx  (Bulk action handler)

runners/
├── AdminRunnersList.jsx       (Runners directory)
├── AdminRunnerDetail.jsx      (Runner profile + actions)
├── AdminRunnerVerification.jsx (Pending verification queue)
├── AdminRunnerPayouts.jsx     (Payout history)
└── AdminRunnerPerformance.jsx (Analytics)

restaurants/
├── AdminRestaurantsList.jsx   (Restaurant directory)
├── AdminRestaurantDetail.jsx  (Restaurant dashboard)
└── AdminMenuEditor.jsx        (Menu management)

customers/
├── AdminCustomersList.jsx     (Customer directory)
└── AdminCustomerDetail.jsx    (Customer profile)

finance/
├── AdminFinanceDashboard.jsx  (Revenue overview)
├── AdminTransactions.jsx      (All transactions)
└── AdminPayouts.jsx           (Payout management)

support/
├── AdminSupportTickets.jsx    (Support tickets)
├── AdminDisputes.jsx          (Disputes & refunds)
└── AdminAuditLog.jsx          (System audit log)

settings/
└── AdminSettings.jsx          (App settings)
```

## Services to Create

```
src/features/admin/services/

adminOrders.service.js
├── getOrders(filters, sort, page)
├── getOrderDetail(orderId)
├── updateOrderStatus(orderId, status)
└── refundOrder(orderId)

adminRunners.service.js
├── getRunners(filters)
├── getRunnerDetail(runnerId)
├── verifyRunner(runnerId)
└── suspendRunner(runnerId)

adminRestaurants.service.js
├── getRestaurants()
├── getRestaurantDetail(id)
└── updateRestaurant(id, data)

adminCustomers.service.js
├── getCustomers(filters)
└── getCustomerDetail(uid)

adminFinance.service.js
├── getFinanceMetrics(dateRange)
├── getTransactions(filters)
└── getPayouts(filters)

adminSupport.service.js
├── getTickets(filters)
├── getDisputes()
└── resolveDispute(id)

adminAudit.service.js
└── getAuditLog(filters)
```

## Hooks to Create (Optional)

```
src/features/admin/hooks/

useAdminOrders.js
├── Manages order state
├── Fetching
└── Filtering/sorting

useAdminFilters.js
├── Filter state management
├── Apply/reset logic

useAdminBulkActions.js
├── Selection state
├── Action handling
```

## Real-time Data Setup

```jsx
// In any component:
useEffect(() => {
  const unsub = listenOrders((data) => {
    setOrders(data);  // Auto-updates on Firebase changes
  });
  return () => unsub?.();  // Cleanup
}, []);
```

## Common Patterns

### Pagination
```jsx
const [page, setPage] = useState(1);
const pageSize = 25;

<AdminDataTable
  pagination={{ page, pageSize, total: orders.length }}
  onPageChange={setPage}
/>
```

### Sorting
```jsx
const [sortBy, setSortBy] = useState("createdAt");
const [sortDir, setSortDir] = useState("desc");

<AdminDataTable
  sortBy={sortBy}
  sortDirection={sortDir}
  onSort={(key, dir) => {
    setSortBy(key);
    setSortDir(dir);
  }}
/>
```

### Filtering
```jsx
const [filters, setFilters] = useState({});

const filtered = useMemo(() => {
  return data.filter(item => {
    if (filters.status && item.status !== filters.status) return false;
    return true;
  });
}, [data, filters]);
```

### Bulk Actions
```jsx
const [selected, setSelected] = useState([]);

const handleDelete = (rowIndices) => {
  const itemsToDelete = rowIndices.map(i => data[i]);
  // ... delete logic ...
  setSelected([]);
};

<AdminDataTable
  selectedRows={selected}
  onSelectRows={setSelected}
  bulkActions={[
    { label: "Delete", onClick: handleDelete },
  ]}
/>
```

## Testing Checklist

- [ ] Dashboard KPI cards display correct data
- [ ] Table columns display in correct order
- [ ] Sorting works on each column
- [ ] Pagination moves through pages
- [ ] Bulk selection works (select all, individual)
- [ ] Filters apply and reset
- [ ] Status badges show correct colors
- [ ] Timeline events display in order
- [ ] Mobile responsive (test on 375px width)
- [ ] No console errors
- [ ] Real-time updates work (Firebase listeners)

## Performance Tips

- Use `useMemo` for filtered/sorted lists
- Paginate large datasets (not all at once)
- Lazy load images
- Clean up listeners in useEffect return
- Debounce search inputs
- Virtual scrolling for 1000+ rows

## Keyboard Navigation

- **Tab** - Move between elements
- **Shift+Tab** - Move backward
- **Enter** - Activate button
- **Space** - Toggle checkbox
- **Arrow Keys** - Navigate lists

## Color Palette

```
Primary Blue:     #3b82f6
Secondary Purple: #8b5cf6
Success Green:    #10b981
Warning Orange:   #f59e0b
Danger Red:       #ef4444
Info Cyan:        #06b6d4
Dark Gray:        #1f2937
Light Gray:       #f9fafb
Borders:          #e5e7eb
```

## File Sizes

- `admin.css` - ~40KB (1200 lines)
- Components - ~25KB total
- Dashboard - ~8KB
- **Total** - ~73KB (Production will be ~20KB gzipped)

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers (iOS 14+, Android 10+)

## Next Immediate Actions

1. Replace AdminLayout.jsx
2. Update routes in src/app/routes.jsx
3. Test on localhost (npm run dev)
4. Start building AdminOrdersList.jsx
5. Add new routes for each admin section

---

**Quick Links:**
- Full Redesign: `ADMIN_PORTAL_REDESIGN.md`
- Implementation Guide: `ADMIN_PORTAL_IMPLEMENTATION_GUIDE.md`
- Full Summary: `ADMIN_PORTAL_SUMMARY.md`

**Estimated Deployment Time:** 2-3 hours total
