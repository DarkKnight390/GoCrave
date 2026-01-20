Email: admin@gocrave.com
Password: GoCraveAdmin123!

GC@6ZDQH795
User466@GoCrave.com

User518@GoCrave.com
GC@MXXC9P90

User994@GoCrave.com
GC@J1FLNH50

npm run build
npm run preview -- --host 0.0.0.0 --port 4173

npm run build
npx cap sync android
cd android
.\gradlew.bat assembleRelease



gocravers@gocrave-app.iam.gserviceaccount.com

BBFFODRWipSxWljU3J4Tn1LIXwIk8Fk9ttpaasm4oETPNui39tcYIBmGrF_3yFH_cU98XsAwGu8eRZJuh0WOX3M

rders + runner flow

Runner “offline” hard gate: block order visibility when offline across all listeners.
Add “On route” + “Picked up” statuses with timestamps and status history.
Auto‑expire pending orders (e.g., 20–30s) + re‑queue.
Tracking

Smooth marker animation + route snapping on movement only.
Save last good route and show “ETA paused” when rate‑limited.
Optional: add driver “heading” arrow rotation.
Chat

Message delivery/read receipts.
Unread badges on list + per chat thread.
Attachments (photo) with size limits.
Ratings

Prevent duplicate ratings per order.
Add “comment” field with moderation/flagging.
Notifications

Web push + native sound on background (requires service worker + FCM).
Toggle settings for sounds and notifications.
Security / rules

Lock down admin writes (roles + claims).
Validate order ownership and runner assignment in RTDB rules.
Separate public vs private runner fields.
Admin

Orders dashboard with filters + bulk actions.
Runner lifecycle: verify/suspend/reinstate with audit log.
Restaurant CRUD + menu versioning + image uploads.
Performance

Paginate large lists (orders, chats).
Debounced search.
Cache runner metrics client‑side.