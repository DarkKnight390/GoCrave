# GoCrave Admin Portal - Complete Redesign & Implementation Plan

**Version:** 2.0  
**Date:** January 11, 2026  
**Scope:** Full-featured admin management system

---

## 📊 Overview

Current admin portal is **minimal** (6 pages). Upgrading to enterprise-grade dashboard with:
- Real-time analytics & KPIs
- Advanced order management
- Runner lifecycle & performance management
- Restaurant management with analytics
- Customer management & support
- Financial tracking & payouts
- Compliance & reporting
- System administration

---

## 🏗️ New Admin Architecture

```
/admin
├── /dashboard          (Overview + KPIs)
├── /orders
│   ├── /list          (Advanced filtering)
│   ├── /[orderId]     (Detail view)
│   └── /bulk-actions  (Batch operations)
├── /runners
│   ├── /list          (Performance table)
│   ├── /[runnerId]    (Detailed profile + actions)
│   ├── /verification  (Pending verification queue)
│   ├── /performance   (Analytics)
│   └── /payouts       (Payment history)
├── /restaurants
│   ├── /list          (Restaurant management)
│   ├── /[restaurantId] (Dashboard)
│   ├── /menu-editor   (Menu management)
│   └── /analytics     (Restaurant performance)
├── /customers
│   ├── /list          (Customer directory)
│   ├── /[customerId]  (Profile + order history)
│   ├── /support       (Support tickets)
│   └── /analytics     (Cohort analysis)
├── /finance
│   ├── /dashboard     (Revenue overview)
│   ├── /payouts       (Runner payouts)
│   ├── /transactions  (All transactions)
│   └── /reports       (Financial reports)
├── /support
│   ├── /tickets       (All support tickets)
│   ├── /categories    (Issue categorization)
│   └── /analytics     (Support metrics)
├── /compliance
│   ├── /audit-log     (All system changes)
│   ├── /disputes      (Order/payment disputes)
│   ├── /complaints    (Customer complaints)
│   └── /appeals       (Runner appeals)
├── /settings
│   ├── /general       (App settings)
│   ├── /users         (Admin user management)
│   ├── /roles         (Role permissions)
│   ├── /integrations  (3rd party services)
│   └── /system        (Database, backups, etc)
└── /reports
    ├── /scheduled     (Automated reports)
    ├── /custom        (Build custom reports)
    └── /export        (Data export)
```

---

## 📈 Dashboard (Admin Home)

**Key Metrics Displayed:**

```
┌─────────────────────────────────────────────────────┐
│  TODAY'S SNAPSHOT                                   │
├─────────────────────────────────────────────────────┤
│ Orders: 247 (+15%)  │ Revenue: $5,820 (+8%)        │
│ Active Runners: 34  │ Avg Rating: 4.7★             │
│ Customers: 1,240    │ Support Queue: 12 unread     │
├─────────────────────────────────────────────────────┤
│  7-DAY TRENDS                                       │
│  Orders: ━━━━━━━  Revenue: ━━━━━━━  Ratings: ━━━━━ │
├─────────────────────────────────────────────────────┤
│  TOP SECTIONS                                       │
│ [Pending Orders] [New Runners] [Support Tickets]   │
│ [Restaurant Health] [Payment Issues] [Complaints]  │
└─────────────────────────────────────────────────────┘
```

**Components:**
- [ ] KPI cards (Orders, Revenue, Active Runners, Ratings)
- [ ] 7-day trend charts (Line charts for orders/revenue/ratings)
- [ ] Alert banner (Critical issues: system health, pending verification)
- [ ] Quick action buttons (New order, Approve runner, Resolve ticket)
- [ ] Recent activity feed (Last 10 orders, last 5 runner sign-ups)

---

## 📋 ORDERS MANAGEMENT

### Orders List Page

**Features:**
- [ ] Advanced filtering:
  - Status (pending, accepted, on_route, delivered, cancelled, disputed)
  - Date range (custom + presets: today, last 7 days, last month)
  - Customer name/email search
  - Runner ID search
  - Restaurant filter
  - Price range
  - Issue status (disputed, refunded, etc)

- [ ] Sorting options:
  - Created date (newest/oldest)
  - Total amount
  - Status
  - Rating

- [ ] Columns:
  - Order ID
  - Customer name
  - Restaurant
  - Items count
  - Total
  - Runner
  - Status (badge color-coded)
  - Created at
  - Actions (view, edit, cancel, etc)

- [ ] Bulk actions:
  - Select multiple orders
  - Batch cancel
  - Batch reassign to different runner
  - Batch mark as delivered
  - Batch refund
  - Export to CSV

- [ ] Pagination:
  - 25/50/100 items per page
  - Jump to page
  - Total count

### Order Detail Page

**View:**
- [ ] Order header: ID, Status (with timeline), Customer, Runner
- [ ] Order items table (name, qty, price, customizations)
- [ ] Totals breakdown (subtotal, delivery fee, tax, discounts, final)
- [ ] Delivery info (address, instructions, location on map)
- [ ] Timeline:
  - Created at
  - Accepted at
  - Picked up at
  - On route at
  - Delivered at
  - Status history with all transitions
  
**Actions:**
- [ ] Change status (with reason required if cancelling)
- [ ] Reassign runner
- [ ] Refund full/partial
- [ ] Add notes/comments
- [ ] View chat history
- [ ] Mark as disputed/resolved
- [ ] Generate receipt/invoice

**Metrics:**
- [ ] Customer rating (if delivered)
- [ ] Rider performance during this order
- [ ] Delivery time actual vs estimated
- [ ] Support interactions count

---

## 👥 RUNNERS MANAGEMENT

### Runners List Page

**Filters:**
- [ ] Status: all, online, offline, on_break, suspended, banned
- [ ] Type: all, goCrave, independent
- [ ] Verification: verified, pending, rejected
- [ ] Active range: last 24h, last 7d, last 30d, inactive
- [ ] Rating range: 5★, 4★+, 3★+, all
- [ ] Subscription status: active, expired, none

**Columns:**
- [ ] Runner ID + Name
- [ ] Avatar (if exists)
- [ ] Type badge
- [ ] Verification status (✓ verified, ⏳ pending, ✗ rejected)
- [ ] Current status (online/offline/suspended)
- [ ] Rating (with review count)
- [ ] Deliveries (count, this month)
- [ ] Earnings (this month)
- [ ] Last active
- [ ] Actions

**Sorting:**
- [ ] Rating (high/low)
- [ ] Deliveries (high/low)
- [ ] Earnings
- [ ] Last active
- [ ] Joined date

**Bulk Actions:**
- [ ] Suspend selected runners
- [ ] Verify selected (batch)
- [ ] Send notification to selected
- [ ] Export to CSV

### Runner Detail Page

**Tabs:**

**1. Profile Tab**
- [ ] Basic info: name, phone, email, date of birth
- [ ] Documents: ID type, ID number, TRN, photos
- [ ] Bank info: account holder, account number, bank (masked)
- [ ] Address: physical address
- [ ] Status: current + history of status changes
- [ ] Joined date, last active, total hours worked

**2. Performance Tab**
- [ ] Metrics:
  - Total deliveries
  - Completion rate %
  - Cancellation rate %
  - Average rating
  - On-time delivery %
  - Average delivery time
  
- [ ] 30-day chart:
  - Orders trend
  - Rating trend
  - Cancellation rate trend
  
- [ ] Top stats:
  - Busiest day of week
  - Most active hours
  - Avg orders per shift

**3. Earnings Tab**
- [ ] Current balance (pending, available, total paid out)
- [ ] 30-day earnings chart
- [ ] Payout history table:
  - Date, amount, status, method
  - Breakdown: base earnings + tips + bonuses
  
- [ ] Earnings breakdown:
  - Per-delivery payout: $X
  - Tips received: $Y
  - Bonuses/incentives: $Z
  - Deductions (if any): -$A

**4. Violations Tab**
- [ ] Warnings (if any):
  - Date, type, reason, details
  - Action taken
  
- [ ] Complaints:
  - Customer complaints about delivery
  - Ratings with comments
  - Resolved/unresolved
  
- [ ] Suspension history:
  - If ever suspended: dates, reason, lifted by

**5. Documents Tab**
- [ ] Upload/verify documents:
  - ID (photo)
  - License (if applicable)
  - Insurance (if required)
  - Bank statement (for payouts)
  
- [ ] Document verification status:
  - Verified ✓
  - Pending verification ⏳
  - Rejected ✗ (with reason)

**6. Activity Tab**
- [ ] Recent orders (last 20):
  - Order ID, date, customer, restaurant, rating, status
  
- [ ] Chat history:
  - With customers, show conversation count
  
- [ ] Login history:
  - Last 10 login attempts with timestamps

**Actions Available:**
- [ ] Change status (online → suspend → activate)
- [ ] Verify/reject verification
- [ ] Send message/notification
- [ ] Adjust earnings (manual payout/deduction with reason)
- [ ] Add warning/violation
- [ ] Ban runner
- [ ] Force logout
- [ ] Download documents

### Runner Verification Queue

- [ ] List of pending verification runners
- [ ] Document preview
- [ ] Approve/Reject button with reason
- [ ] Auto-reject after 30 days inactivity
- [ ] Bulk approve (if all docs clear)

### Runner Payouts

**History Table:**
- [ ] Payout ID
- [ ] Runner name
- [ ] Amount
- [ ] Date
- [ ] Method (bank transfer, mobile money, etc)
- [ ] Status (pending, completed, failed)
- [ ] Actions (view details, retry if failed)

**Payout Management:**
- [ ] Trigger payout (select runners, confirm amount)
- [ ] Schedule payout (e.g., every Friday)
- [ ] View pending payouts
- [ ] Retry failed payouts
- [ ] Reconciliation (check what's been paid)

---

## 🏪 RESTAURANTS MANAGEMENT

### Restaurants List

**Filters:**
- [ ] Status: active, inactive, suspended
- [ ] Verification: verified, pending
- [ ] Cuisine type
- [ ] Rating range
- [ ] Orders count range

**Columns:**
- [ ] Restaurant name + thumbnail
- [ ] Cuisine
- [ ] Owner name
- [ ] Status
- [ ] Rating + review count
- [ ] Orders (this month)
- [ ] Revenue (this month)
- [ ] Last order
- [ ] Actions

### Restaurant Detail Dashboard

**Overview Tab:**
- [ ] KPIs: total orders, revenue, avg rating, delivery time
- [ ] 30-day charts:
  - Orders trend
  - Revenue trend
  - Rating trend
  
**Menu Editor Tab:**
- [ ] Categories list
- [ ] Items per category:
  - Name, price, description
  - Image
  - Availability toggle
  - Customization options
  
- [ ] Add/edit/delete category
- [ ] Add/edit/delete items
- [ ] Batch upload menu (CSV)
- [ ] Menu versioning (history + rollback)

**Analytics Tab:**
- [ ] Best selling items
- [ ] Least selling items
- [ ] Peak hours
- [ ] Customer ratings breakdown
- [ ] Order fulfillment time breakdown

**Settings Tab:**
- [ ] Operating hours
- [ ] Delivery fee
- [ ] Min order amount
- [ ] Prep time estimate
- [ ] Contact info
- [ ] Bank account (for payouts to restaurant)

**Team Tab:**
- [ ] Owner profile
- [ ] Staff accounts (login credentials for restaurant employees)
- [ ] Activity log (who logged in when)

**Documents Tab:**
- [ ] Business license
- [ ] Tax ID/TRN
- [ ] Health certificate
- [ ] Insurance
- [ ] Verification status

---

## 👤 CUSTOMERS MANAGEMENT

### Customers List

**Filters:**
- [ ] Date joined (custom range)
- [ ] Activity status (active, dormant, inactive)
- [ ] Order count range
- [ ] Spending range
- [ ] Loyalty tier (if implemented)
- [ ] Search by name/email/phone

**Columns:**
- [ ] Name + email
- [ ] Phone
- [ ] Total orders
- [ ] Total spent
- [ ] Loyalty points (if implemented)
- [ ] Last order date
- [ ] Account status (active/suspended)

### Customer Detail

**Profile Tab:**
- [ ] Name, email, phone, DOB
- [ ] Address (saved addresses)
- [ ] Account status
- [ ] Joined date

**Orders Tab:**
- [ ] All customer orders with filtering
- [ ] Reorder button (quick reorder)
- [ ] Order details on click

**Support Tab:**
- [ ] Support tickets/chats
- [ ] Open tickets
- [ ] Resolved tickets
- [ ] Send message

**Analytics Tab:**
- [ ] Spending trend
- [ ] Order frequency
- [ ] Favorite restaurants
- [ ] Favorite items
- [ ] Average order value

**Actions:**
- [ ] Suspend/unsuspend account
- [ ] Force password reset
- [ ] Send promotional message
- [ ] Issue refund
- [ ] Credit loyalty points
- [ ] View login history

---

## 💰 FINANCE MANAGEMENT

### Finance Dashboard

**KPIs:**
- [ ] Total revenue (today, this month, all time)
- [ ] Total payouts (runners, restaurants)
- [ ] Net profit
- [ ] Active users (customers, runners)
- [ ] Average order value
- [ ] Platform commission

**Charts:**
- [ ] Revenue trend (daily/weekly/monthly)
- [ ] Payouts vs revenue
- [ ] Top revenue days
- [ ] Commission breakdown (by restaurant vs runner payouts)

### Transactions

**Table:**
- [ ] Transaction ID
- [ ] Type (order, refund, payout, adjustment)
- [ ] Amount
- [ ] Related (customer name, runner name, or restaurant)
- [ ] Date
- [ ] Status
- [ ] Method (payment method)

**Filters:**
- [ ] Type
- [ ] Date range
- [ ] Amount range
- [ ] Status

### Payouts Management

(Detailed payout tracking - already partially covered in Runners section)

---

## 💬 SUPPORT & COMPLIANCE

### Support Tickets System

**Ticket List:**
- [ ] Ticket ID
- [ ] Customer name
- [ ] Issue type (order issue, delivery problem, payment, account, other)
- [ ] Status (open, in-progress, resolved, closed)
- [ ] Priority (low, medium, high, critical)
- [ ] Created date
- [ ] Last updated
- [ ] Assigned to (admin)

**Ticket Detail:**
- [ ] Full conversation thread
- [ ] Customer info
- [ ] Related order (if applicable)
- [ ] Attachments
- [ ] Resolution actions taken
- [ ] Admin comments

**Bulk Actions:**
- [ ] Assign to admin
- [ ] Mark as resolved
- [ ] Change priority
- [ ] Add tags

### Disputes & Refunds

**Disputes Table:**
- [ ] Dispute ID
- [ ] Order ID
- [ ] Customer name
- [ ] Reason (missing items, wrong order, cold food, driver issue, payment issue)
- [ ] Status (open, investigating, resolved, rejected)
- [ ] Amount in dispute
- [ ] Created date

**Dispute Detail:**
- [ ] Full details
- [ ] Customer statement
- [ ] Runner response (if applicable)
- [ ] Evidence (photos, screenshots)
- [ ] Resolution options:
  - Full refund
  - Partial refund
  - Credit
  - Replace order
  - Reject dispute with reason

### Audit Log

**All system changes logged:**
- [ ] Who (admin name)
- [ ] What (action description)
- [ ] When (timestamp)
- [ ] Resource (order ID, runner ID, etc)
- [ ] Change details (before/after values)

**Filters:**
- [ ] Action type
- [ ] Admin user
- [ ] Date range
- [ ] Resource type

---

## ⚙️ SETTINGS & ADMINISTRATION

### General Settings

- [ ] App name, logo, tagline
- [ ] Support email/phone
- [ ] Business hours
- [ ] Time zone
- [ ] Currency (JMD)
- [ ] App version

### User Management

**Admin Users:**
- [ ] List of all admin accounts
- [ ] Create new admin
- [ ] Edit admin (name, email, role, permissions)
- [ ] Deactivate/delete admin
- [ ] Force password reset
- [ ] Login history per admin

### Role Permissions

**Predefined Roles:**
- [ ] Super Admin (full access)
- [ ] Operations Manager (orders, runners, restaurants, support)
- [ ] Finance Manager (finances, payouts, refunds)
- [ ] Support Lead (support tickets, disputes)
- [ ] Moderator (complaints, flags, content review)

**Custom Role Creation:**
- [ ] Select permissions per role
- [ ] Assign users to roles

### Integrations

- [ ] Payment gateway settings
- [ ] SMS provider (for notifications)
- [ ] Email service
- [ ] Maps API key (if needed)
- [ ] Analytics (Google Analytics, etc)
- [ ] Slack webhook (for alerts)

### System Health

- [ ] Database status
- [ ] API health check
- [ ] Last backup date
- [ ] Storage usage
- [ ] Error logs (recent errors)
- [ ] Active user sessions

---

## 📊 REPORTING

### Scheduled Reports

- [ ] Daily summary email
- [ ] Weekly business report
- [ ] Monthly analytics
- [ ] Custom reports

### Custom Reports

- [ ] Build custom report (select metrics, filters, date range)
- [ ] Save report template
- [ ] Export as PDF/CSV/Excel

### Export Data

- [ ] Orders export
- [ ] Customers export
- [ ] Runners export
- [ ] Restaurants export
- [ ] Transactions export
- [ ] Support tickets export

---

## 🎨 UI Component Library Needed

**New Components to Build:**

```jsx
// Data Table
<AdminDataTable
  columns={[]}
  data={[]}
  filters={[]}
  sortBy={}
  onSort={}
  pagination={{page, pageSize}}
  onPageChange={}
  bulkActions={[]}
  onBulkAction={}
  loading={false}
/>

// KPI Card
<AdminKPICard
  title="Total Orders"
  value={247}
  change={+15}
  icon="orders"
  onClick={}
/>

// Filters Panel
<AdminFilters
  filters={[]}
  onFilterChange={}
  onReset={}
/>

// Status Badge
<AdminStatusBadge status="pending" />

// Action Buttons
<AdminActionButton>View Details</AdminActionButton>

// Tabs
<AdminTabs
  tabs={[{label, content}]}
/>

// Timeline
<AdminTimeline events={[]} />

// Chart
<AdminChart type="line" data={} />

// Modal Dialog
<AdminModal title="Confirm Action" onConfirm={} onCancel={} />

// Toast Notifications
<AdminToast message="" type="success" />
```

---

## 📱 Responsive Design

- [ ] Desktop-first (1920x1080+)
- [ ] Tablet support (768px+)
- [ ] Sidebar collapses on mobile (hamburger menu)
- [ ] Data tables become card layout on mobile

---

## 🔒 Security & Permissions

- [ ] Role-based access control (RBAC)
- [ ] Each admin sees only what their role allows
- [ ] Audit all admin actions
- [ ] Session timeout (30 min inactivity)
- [ ] IP whitelisting (optional)
- [ ] 2FA for sensitive actions

---

## 🚀 Implementation Priority

### Phase 1: Foundation (Week 1-2)
- [ ] UI component library
- [ ] Dashboard with KPIs
- [ ] Orders list with filtering/sorting
- [ ] Order detail page
- [ ] Runners list with basic filtering

### Phase 2: Core Management (Week 2-3)
- [ ] Runner detail page with all tabs
- [ ] Runner verification queue
- [ ] Restaurant management
- [ ] Customer management
- [ ] Support tickets system

### Phase 3: Finance & Compliance (Week 3-4)
- [ ] Finance dashboard
- [ ] Payouts management
- [ ] Disputes & refunds
- [ ] Audit log
- [ ] Compliance tools

### Phase 4: Advanced Features (Week 4+)
- [ ] Advanced reporting
- [ ] Bulk actions
- [ ] Automation/scheduled tasks
- [ ] Data export
- [ ] Custom analytics

---

## 📂 New Folder Structure

```
src/features/admin/
├── components/
│   ├── shared/
│   │   ├── AdminDataTable.jsx
│   │   ├── AdminKPICard.jsx
│   │   ├── AdminFilters.jsx
│   │   ├── AdminStatusBadge.jsx
│   │   ├── AdminTimeline.jsx
│   │   └── AdminChart.jsx
│   └── layout/
│       ├── AdminHeader.jsx
│       ├── AdminSidebar.jsx
│       └── AdminNav.jsx
├── pages/
│   ├── dashboard/
│   │   └── AdminDashboard.jsx
│   ├── orders/
│   │   ├── AdminOrdersList.jsx
│   │   ├── AdminOrderDetail.jsx
│   │   └── AdminOrderBulkActions.jsx
│   ├── runners/
│   │   ├── AdminRunnersList.jsx
│   │   ├── AdminRunnerDetail.jsx
│   │   ├── AdminRunnerVerification.jsx
│   │   ├── AdminRunnerPayouts.jsx
│   │   └── AdminRunnerPerformance.jsx
│   ├── restaurants/
│   │   ├── AdminRestaurantsList.jsx
│   │   ├── AdminRestaurantDetail.jsx
│   │   └── AdminMenuEditor.jsx
│   ├── customers/
│   │   ├── AdminCustomersList.jsx
│   │   └── AdminCustomerDetail.jsx
│   ├── finance/
│   │   ├── AdminFinanceDashboard.jsx
│   │   ├── AdminTransactions.jsx
│   │   └── AdminPayouts.jsx
│   ├── support/
│   │   ├── AdminSupportTickets.jsx
│   │   ├── AdminTicketDetail.jsx
│   │   ├── AdminDisputes.jsx
│   │   └── AdminAuditLog.jsx
│   └── settings/
│       ├── AdminSettings.jsx
│       ├── AdminUserManagement.jsx
│       ├── AdminRoles.jsx
│       └── AdminIntegrations.jsx
├── hooks/
│   ├── useAdminOrders.js
│   ├── useAdminRunners.js
│   ├── useAdminFilters.js
│   └── useAdminBulkActions.js
├── services/
│   ├── adminOrders.service.js
│   ├── adminRunners.service.js
│   ├── adminRestaurants.service.js
│   ├── adminCustomers.service.js
│   ├── adminFinance.service.js
│   ├── adminSupport.service.js
│   ├── adminAudit.service.js
│   └── adminSettings.service.js
├── stores/
│   ├── useAdminStore.js (global state)
│   ├── useAdminFiltersStore.js
│   └── useAdminBulkActionsStore.js
└── styles/
    ├── adminDataTable.css
    ├── adminLayout.css
    ├── adminDashboard.css
    ├── adminForms.css
    └── adminResponsive.css
```

---

## ✅ Checklist for Full Implementation

- [ ] Design system/component library
- [ ] Auth/permissions middleware
- [ ] Dashboard with real-time KPIs
- [ ] Advanced data tables with filtering/sorting/pagination
- [ ] Order management system
- [ ] Runner management (with verification, performance, payouts)
- [ ] Restaurant management
- [ ] Customer management
- [ ] Finance/accounting module
- [ ] Support ticketing system
- [ ] Compliance & audit logging
- [ ] Settings & user management
- [ ] Reporting & export functionality
- [ ] Mobile responsive design
- [ ] Error handling & validation
- [ ] Performance optimization (pagination, lazy loading)
- [ ] Testing (unit + integration)
- [ ] Documentation

---

**Estimated Effort:** 200-300 dev hours  
**Team Size:** 2-3 developers  
**Timeline:** 4-6 weeks with full team

This redesign transforms the admin portal from a basic CRUD interface to an enterprise-grade management system.
