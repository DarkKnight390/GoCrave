# GoCrave App - Comprehensive Improvements & Implementation Analysis

**Date:** January 11, 2026  
**Status:** Ongoing development with significant features pending

---

## Executive Summary

The GoCrave food delivery platform has solid foundational architecture with core features implemented (authentication, basic order flow, chat, tracking). However, several critical features from the roadmap are incomplete or missing. This document categorizes improvements by priority and implementation complexity.

---

## ✅ COMPLETED FEATURES

### Authentication & Authorization
- ✅ Role-based access (Customer, Runner, Admin)
- ✅ Firebase Auth integration
- ✅ JWT token verification on server
- ✅ Role gating with RoleGate component

### Core Order Management
- ✅ Order creation and acceptance
- ✅ Runner assignment (manual admin assignment)
- ✅ Order status tracking (pending, accepted, delivered, cancelled)
- ✅ Order history and past orders

### Runner Features
- ✅ Runner availability toggle (online/offline)
- ✅ Available orders list (pending orders for online runners)
- ✅ Order acceptance/rejection
- ✅ Live location tracking with GPS
- ✅ ETA calculation via OSM/Nominatim
- ✅ Earnings tracking (deliveries count, total JMD)
- ✅ Runner metrics (rating, deliveriesCount, totalEarnings)

### Customer Features
- ✅ Restaurant browsing
- ✅ Menu browsing with categories
- ✅ Cart management (Zustand store)
- ✅ Order checkout
- ✅ Real-time order tracking with map
- ✅ Basic ratings (stars only)
- ✅ Profile management

### Admin Features
- ✅ Orders dashboard with status filtering
- ✅ Runner management (list view)
- ✅ Restaurant CRUD operations
- ✅ Menu and category management
- ✅ Image uploads for restaurants/items
- ✅ Basic support chat viewing

### Chat System
- ✅ Runner-to-Customer messaging
- ✅ Admin support chat
- ✅ Message persistence
- ✅ Last message tracking in thread metadata
- ✅ Chat history with last 200 messages
- ✅ Attachment upload with size validation (5MB)
- ✅ Image attachments with download URLs

### Database & Security
- ✅ Firebase Realtime Database rules configured
- ✅ Order ownership validation
- ✅ Runner assignment validation
- ✅ Admin access controls
- ✅ Public/private field separation (liveLocation with permissions)
- ✅ Location access grants via runnerLocationAccess

### Payment
- ✅ Per-delivery payout configuration (server-side cache)
- ✅ Earnings calculation and storage

---

## 🔴 MISSING/INCOMPLETE FEATURES

### 1. **Runner Status System** (HIGH PRIORITY)
**Requirement from roadmap:** Add "On route" + "Picked up" statuses with timestamps and status history

**Current State:**
- Status field exists but only has: pending, accepted, delivering, delivered, cancelled
- No "on_route" or "picked_up" statuses
- No status history/timeline
- Timestamps not stored with status changes

**What's Needed:**
- [ ] Add status enum: "picked_up", "on_route"
- [ ] Create status history tracking (array/document in order)
- [ ] Timestamp each status change
- [ ] Update UI to show status timeline
- [ ] Update RunnerHome to allow status transitions
- [ ] Update tracking UI to show detailed status

**Files to Modify:**
- `src/services/rtdb.service.js` - Add `updateOrderStatusWithHistory()`
- `src/features/runner/RunnerHome.jsx` - Add status action buttons
- `src/features/runner/RunnerTrackOrder.jsx` - Show status in tracking view
- `src/features/customer/CustomerTrackOrder.jsx` - Show detailed status timeline

---

### 2. **Runner Offline Hard Gate** (HIGH PRIORITY)
**Requirement:** Block order visibility when offline across all listeners

**Current State:**
- Availability field exists (online/offline)
- Read rules check availability for pending orders
- BUT: No enforcement that offline runners can't see orders

**What's Needed:**
- [ ] Enforce availability check in all order queries
- [ ] Add UI gate to prevent order acceptance if offline
- [ ] Disconnect order stream if runner becomes offline
- [ ] Show clear "You're offline" message in RunnerHome
- [ ] Prevent chat message sending if offline (optional)

**Files to Modify:**
- `src/features/runner/RunnerHome.jsx` - Early return if offline
- `src/services/rtdb.service.js` - Check availability before accepting
- `database.rules.json` - Tighten read rules (already partially done)

---

### 3. **Message Delivery & Read Receipts** (MEDIUM PRIORITY)
**Requirement:** Message delivery/read receipts + Unread badges on list + per chat thread

**Current State:**
- Messages stored with createdAt, senderUid, content
- No "delivered" or "read" field on messages
- Thread meta tracks "runnerUnread" and "customerUnread"
- No per-message read tracking

**What's Needed:**
- [ ] Add `status` field to messages: "sent", "delivered", "read"
- [ ] Add `readAt` timestamp to messages
- [ ] Implement read receipt logic in ChatThread components
- [ ] Display checkmarks (✓ sent, ✓✓ read) in message UI
- [ ] Update thread meta when message is read
- [ ] Show unread badge count on chat list (partially implemented)

**Files to Modify:**
- `src/services/chat.service.js` - Add `markMessagesAsRead()`, `markMessagesAsDelivered()`
- `src/features/runner/RunnerChatThread.jsx` - Show read receipts, mark as read on scroll
- `src/features/customer/CustomerChatThread.jsx` - Same as runner
- `src/features/admin/AdminSupportChatThread.jsx` - Same

---

### 4. **Message Attachments with Size Limits** (MEDIUM PRIORITY)
**Requirement:** Attachments (photo) with size limits

**Current State:**
- Upload function exists: `uploadChatAttachment()`
- 5MB size limit implemented
- File validation present
- But: No UI to upload attachments in chat threads
- No display of attachment in chat messages

**What's Needed:**
- [ ] Add attachment upload button in chat input
- [ ] Show loading state during upload
- [ ] Display attachments in message thread
- [ ] Lazy load images (don't show full res in list)
- [ ] Handle upload errors gracefully
- [ ] Optional: Add image compression before upload

**Files to Modify:**
- `src/features/runner/RunnerChatThread.jsx` - Add attachment UI
- `src/features/customer/CustomerChatThread.jsx` - Add attachment UI
- `src/features/admin/AdminSupportChatThread.jsx` - Add attachment UI
- Consider creating shared `ChatInput.jsx` component

---

### 5. **Order Auto-Expiry & Re-queueing** (MEDIUM PRIORITY)
**Requirement:** Auto-expire pending orders (e.g., 20–30s) + re‑queue

**Current State:**
- Orders sit in pending state indefinitely
- No timeout mechanism
- No automatic re-queueing

**What's Needed:**
- [ ] Add `expiresAt` field to new orders (createdAt + 25s)
- [ ] Create Cloud Function to expire old pending orders
- [ ] Implement retry logic (increment retry count)
- [ ] Set max retries (e.g., 3 times)
- [ ] Cancel order if max retries exceeded
- [ ] Optional: Show "Finding runner..." -> "Retrying..." UI states

**Files to Modify:**
- `functions/index.js` - Add `expirePendingOrders` scheduled function
- `src/features/customer/CustomerCheckout.jsx` - Show timeout UI
- `src/services/rtdb.service.js` - Add `createOrderWithExpiry()`

---

### 6. **Smooth Map Marker Animation & Route Snapping** (MEDIUM PRIORITY)
**Requirement:** Smooth marker animation + route snapping on movement only + optional heading arrow rotation

**Current State:**
- Map shows runner location as CircleMarker
- Updates real-time but no animation
- Route updates every GPS poll (not snapped to movement)
- No heading/direction indicator

**What's Needed:**
- [ ] Animate marker movement smoothly (Leaflet plugin or custom)
- [ ] Only update route when runner moves > 10m (avoid jitter)
- [ ] Add heading/bearing indicator (arrow rotation on map marker)
- [ ] Snap heading to movement direction
- [ ] Cache last known good route to prevent map flashing

**Files to Modify:**
- `src/features/customer/CustomerTrackOrder.jsx` - Add animation logic
- `src/features/runner/RunnerTrackOrder.jsx` - Add animation logic
- `src/services/rtdb.service.js` - Add movement threshold check

**Libraries to Consider:**
- `react-leaflet-animated-marker`
- or use Leaflet's native L.Marker with Cesium-like animation

---

### 7. **Prevent Duplicate Ratings** (MEDIUM PRIORITY)
**Requirement:** Prevent duplicate ratings per order + add "comment" field with moderation

**Current State:**
- Can submit multiple ratings for same order
- Only stars field, no comments
- No comment moderation

**What's Needed:**
- [ ] Check if rating exists for orderId before allowing new one
- [ ] Add `comment` field to rating object
- [ ] Add comment text input in delivery confirmation modal
- [ ] Optional: Add moderation flags for inappropriate comments
- [ ] Optional: Admin panel to review flagged comments

**Files to Modify:**
- `src/services/ratings.service.js` - Check for existing rating
- `src/features/customer/CustomerOrderDelivered.jsx` - Add comment input

---

### 8. **Web Push Notifications & Background Sound** (MEDIUM PRIORITY)
**Requirement:** Web push + native sound on background (requires service worker + FCM)

**Current State:**
- FCM tokens stored in DB (`fcmTokens/{uid}`)
- FCM configured in Firebase
- Service worker exists (`public/firebase-messaging-sw.js`)
- In-app sound playback works (`notifyAudio.js`)
- BUT: No push notification trigger logic

**What's Needed:**
- [ ] Complete service worker FCM listener setup
- [ ] Send FCM from server when:
  - New order created (for runners)
  - Order accepted (for customer)
  - Runner en route (for customer)
  - Message received
  - Order delivered
- [ ] Handle notification click (navigate to relevant page)
- [ ] Settings to toggle notifications per user
- [ ] Settings to toggle notification sounds

**Files to Modify:**
- `server/index.js` - Add notification triggers in order endpoints
- `src/services/push.service.js` - Implement FCM registration
- `public/firebase-messaging-sw.js` - Implement message handlers
- `src/features/admin/AdminSettings.jsx` - Add notification toggle UI
- `src/features/runner/RunnerProfile.jsx` - Add settings
- `src/features/customer/CustomerProfile.jsx` - Add settings

---

### 9. **Orders Dashboard with Filters & Bulk Actions** (MEDIUM PRIORITY)
**Requirement:** Orders dashboard with filters + bulk actions

**Current State:**
- Basic AdminOrders view with 3 panels (Pending, On route, Delivered)
- Manual runner assignment
- No bulk actions
- Limited filters (status only)

**What's Needed:**
- [ ] Add date range filter
- [ ] Add restaurant filter
- [ ] Add runner filter
- [ ] Add customer search
- [ ] Bulk action checkboxes
- [ ] Cancel multiple orders at once
- [ ] Reassign multiple orders to runner
- [ ] Export orders (CSV/PDF)
- [ ] Pagination for large datasets

**Files to Modify:**
- `src/features/admin/AdminOrders.jsx` - Add filters and bulk UI

---

### 10. **Runner Lifecycle Management** (MEDIUM PRIORITY)
**Requirement:** Runner lifecycle: verify/suspend/reinstate with audit log

**Current State:**
- Status field exists on runner (active/inactive/suspended)
- No audit trail
- Manual status changes only
- No verification workflow

**What's Needed:**
- [ ] Add verification workflow (pending_verification -> active)
- [ ] Add suspension workflow with reason
- [ ] Add reinstatement workflow
- [ ] Create audit log (who, when, why, change)
- [ ] UI to view runner verification docs
- [ ] Automated suspension triggers (e.g., rating < 3.0, 3+ complaints)

**Files to Modify:**
- `functions/index.js` - Add runner status change functions with audit
- `src/features/admin/RunnerDetail.jsx` - Add action buttons
- Create `src/services/runnerLifecycle.service.js`

---

### 11. **Restaurant Menu Versioning** (LOW PRIORITY)
**Requirement:** Menu versioning for restaurants

**Current State:**
- Basic menu CRUD
- No version tracking
- Direct edits to menus

**What's Needed:**
- [ ] Add version field to menus
- [ ] Create archive of old menu versions
- [ ] Allow restaurant to rollback menu
- [ ] Track who changed menu and when
- [ ] Show "menu version X" on orders

**Files to Modify:**
- `src/services/restaurants.service.js` - Add versioning logic
- `src/features/admin/AdminRestaurants.jsx` - Show version history

---

### 12. **Pagination for Large Lists** (MEDIUM PRIORITY)
**Requirement:** Paginate large lists (orders, chats)

**Current State:**
- Chat loads last 200 messages (limitToLast)
- Orders load all (no limit)
- No pagination UI

**What's Needed:**
- [ ] Implement cursor-based pagination for orders
- [ ] Implement cursor-based pagination for chats
- [ ] Show "Load more" button
- [ ] Track pagination state in store
- [ ] Optimize queries with `limitToFirst(25)` and cursors

**Files to Modify:**
- `src/services/rtdb.service.js` - Add pagination helper
- `src/services/chat.service.js` - Modify to support pagination
- Admin and list components

---

### 13. **Debounced Search** (LOW PRIORITY)
**Requirement:** Debounced search

**Current State:**
- Basic client-side search implemented in some components
- Filters re-run on every keystroke
- No debounce

**What's Needed:**
- [ ] Create shared `useDebouncedSearch` hook
- [ ] Apply to:
  - Runner search in CustomerRunners
  - Chat search
  - Admin orders search
- [ ] 300ms debounce

**Files to Modify:**
- Create `src/hooks/useDebouncedSearch.js`
- Update search components to use hook

---

### 14. **Client-Side Metrics Caching** (LOW PRIORITY)
**Requirement:** Cache runner metrics client-side

**Current State:**
- Real-time listeners update metrics
- No caching strategy
- Metrics recalculated on every store update

**What's Needed:**
- [ ] Cache runner metrics in Zustand store
- [ ] Update cache on listener updates
- [ ] Optional: Persist cache to localStorage
- [ ] TTL-based invalidation (cache for 5 min, then refresh)

**Files to Modify:**
- `src/store/useAuthStore.js` or create `src/store/useRunnerMetricsStore.js`
- Update metric listeners to update cache

---

## 📊 Feature Completion Matrix

| Category | Feature | Status | Complexity | Priority |
|----------|---------|--------|-----------|----------|
| Orders | Status History | ❌ | Medium | HIGH |
| Runner | Offline Hard Gate | ⚠️ Partial | Low | HIGH |
| Chat | Read Receipts | ❌ | Medium | MEDIUM |
| Chat | Attachments UI | ⚠️ Partial | Medium | MEDIUM |
| Orders | Auto-Expiry & Re-queue | ❌ | High | MEDIUM |
| Tracking | Marker Animation | ❌ | Medium | MEDIUM |
| Ratings | Duplicate Prevention | ❌ | Low | MEDIUM |
| Ratings | Comments & Moderation | ❌ | Medium | MEDIUM |
| Push | Web Notifications | ⚠️ Partial | High | MEDIUM |
| Admin | Orders Dashboard Filters | ⚠️ Partial | Low | MEDIUM |
| Admin | Bulk Actions | ❌ | Medium | MEDIUM |
| Admin | Runner Lifecycle | ❌ | High | MEDIUM |
| Admin | Audit Logging | ❌ | High | MEDIUM |
| Restaurants | Menu Versioning | ❌ | Medium | LOW |
| Lists | Pagination | ❌ | Medium | MEDIUM |
| Search | Debouncing | ❌ | Low | LOW |
| Performance | Metrics Caching | ❌ | Low | LOW |

---

## 🏗️ Implementation Priority Roadmap

### Phase 1: Critical Functionality (Week 1)
1. **Runner Offline Hard Gate** - Prevents orders showing to offline runners
2. **Order Status History** - Enables proper order tracking flow
3. **Prevent Duplicate Ratings** - Prevents data integrity issues

### Phase 2: User Experience (Week 2)
4. **Message Read Receipts** - Improves chat UX
5. **Message Attachments UI** - Completes chat functionality
6. **Orders Dashboard Filters** - Better admin control

### Phase 3: Advanced Features (Week 3)
7. **Order Auto-Expiry** - Improves queue management
8. **Marker Animation** - Better tracking UX
9. **Web Push Notifications** - Engagement improvement
10. **Runner Lifecycle** - Admin control improvement

### Phase 4: Polish (Week 4)
11. **Pagination** - Performance optimization
12. **Debounced Search** - UX refinement
13. **Metrics Caching** - Performance
14. **Menu Versioning** - Restaurant management

---

## 🔧 Technical Debt & Code Quality

### Current Issues:
1. **No TypeScript** - Consider migrating for type safety
2. **Limited error handling** - Many async ops lack try/catch
3. **No input validation** - Client-side form validation is minimal
4. **Incomplete testing** - No test suite
5. **Magic numbers** - Hardcoded timeouts, distances, etc.

### Recommendations:
- Add ESLint rules for error handling
- Create validation schema library (Zod or Yup)
- Add integration tests for critical flows
- Create constants file for config values
- Add error boundary components

---

## 🚀 Quick Win Implementation Tasks

**Easy to implement (< 1 hour each):**
1. Add offline check in RunnerHome
2. Add comment field to ratings form
3. Create debounced search hook
4. Add pagination UI skeleton

**Medium effort (1-3 hours each):**
1. Implement status history tracking
2. Add read receipts to messages
3. Complete message attachment UI
4. Add more admin filters

**Complex (> 3 hours):**
1. Auto-expiry system with Cloud Functions
2. Complete push notification setup
3. Runner lifecycle with audit logs
4. Map marker animation

---

## 📝 Notes

- Most database rules are already in place; backend changes are mostly safe
- Firebase schema is flexible - can add fields without migration
- Consider using Cloud Functions for complex business logic (expiry, notifications)
- Chat system is feature-complete except for UI (attachments, receipts)
- Ratings system is partially complete (just add comments)

---

## Files Requiring Most Changes

By frequency of modification needed:
1. `src/features/runner/RunnerHome.jsx` - Offline gate, status UI
2. `src/services/rtdb.service.js` - New status functions, auto-expiry
3. `src/features/admin/AdminOrders.jsx` - More filters, bulk actions
4. `src/features/*/CatThread.jsx` - Read receipts, attachments (×3 files)
5. `functions/index.js` - New Cloud Functions

---

**Last Updated:** January 11, 2026
