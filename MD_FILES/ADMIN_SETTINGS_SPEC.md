# Admin Portal Settings Specification

This document describes a comprehensive, production-grade settings area for the GoCrave admin portal. It covers UI sections, controls, defaults, backend mapping (Realtime Database paths), permissions, UX patterns, validation rules, migration notes and developer integration points.

## Goals
- Centralize operational configuration for the platform.
- Allow fine-grained control by environment and by role.
- Provide safe editing, audit logging, preview, and rollback.
- Make settings readable by services (serverless functions, cron jobs).

---

## Overview: Top-Level Sections
1. General & Company Info
2. Branding & Theming
3. Authentication & Security
4. Roles & Permissions
5. Payments & Financials
6. Runners & Delivery
7. Restaurants & Menus
8. Orders & Fulfillment
9. Notifications & Messaging
10. Integrations & Webhooks
11. Data, Privacy & Exports
12. Audit, Logging & Monitoring
13. Feature Flags & Experiments
14. Localization & Timezones
15. Maintenance, Backups & Disaster Recovery
16. Developer / Debugging Tools

Each section contains individual keys described below with UI control, data type, default, RTDB path and permissions.

---

## Backend mapping convention
- Root RTDB path: `/admin/settings/{namespace}/{key}`
- Example: `/admin/settings/general/companyName`
- Store metadata for each setting at `/admin/settings_meta/{namespace}/{key}` to include type, description, allowed values, lastUpdatedBy, lastUpdatedAt.
- Consider adding an environment override key: `/admin/settings_env/{env}/{namespace}/{key}` (e.g., `staging`, `production`)

All writes should be performed via `adminSettings.service.js` so audit logging can be enforced.

---

## Permissions model
- `super_admin`: full read/write across all settings
- `admin`: read + edit non-security and non-financial settings
- `ops`: read + limited edit (maintenance, feature flags)
- `auditor`: read-only access to settings & changes

UI must hide or disable controls according to the user's role. All edits must be recorded in `/admin/audit_log/settings` with before/after values and user metadata.

---

## Settings by Section (Detailed)

### 1) General & Company Info
- `companyName` (string)
  - UI: text input
  - Default: "GoCrave"
  - RTDB: `/admin/settings/general/companyName`
  - Permissions: `admin`+
- `supportEmail` (email)
  - UI: email input
  - RTDB: `/admin/settings/general/supportEmail`
- `supportPhone` (string)
  - UI: phone input

### 2) Branding & Theming
- `logoUrl` (string)
  - UI: file upload + url input
  - RTDB: `/admin/settings/branding/logoUrl`
- `primaryColor` (hex)
  - UI: color picker
  - Default: `#3b82f6`
- `themeMode` (enum: light, dark, automatic)
  - UI: select

Preview toggle: toggles a preview region showing header/footer with current values before saving.

### 3) Authentication & Security
- `maintenanceMode` (boolean)
  - UI: toggle with timed scheduling option (start/end)
  - RTDB: `/admin/settings/security/maintenanceMode`
  - Special behavior: APIs should read this value and return 503 where appropriate
- `sessionTimeoutMinutes` (number)
  - UI: numeric input
  - Default: 30
- `require2fa` (enum: off, optional, required)
  - UI: select
- `allowedIpRanges` (array)
  - UI: multi-line textarea (CIDR entries)

### 4) Roles & Permissions
- `defaultUserRole` (enum)
  - UI: select
- `roleOverrides` (object)
  - UI: JSON editor + schema validation
- Export/Import roles button

### 5) Payments & Financials
- `currency` (string)
  - UI: select (USD, NGN, etc.)
- `paymentProviders` (object)
  - Structure: {stripe: {enabled, apiKeyRef}, flutterwave: {...}}
  - UI: per-provider toggle + secure fields (secrets stored in environment/secret manager; service receives references)
- `defaultDeliveryFee` (number)
  - UI: numeric input + per-city overrides table
- `autoSettlePayoutDays` (number)
  - UI: numeric input

Security note: API keys/secrets must not be stored directly in RTDB plaintext. Store references to secret manager or encrypted values.

### 6) Runners & Delivery
- `defaultRunnerRadiusKm` (number)
- `runnerVerificationRequired` (boolean)
- `maxActiveDeliveriesPerRunner` (number)
- `autoAssignPolicy` (enum: nearest, balanced, manual)
- `runnerPayoutSchedule` (object)
  - UI: schedule editor (cron-like or interval + cutoff)

### 7) Restaurants & Menus
- `restaurantApprovalRequired` (boolean)
- `menuSyncIntervalMinutes` (number)
- `featuredRestaurants` (array of ids)

### 8) Orders & Fulfillment
- `orderCancellationWindowMinutes` (number)
- `autoCancelUnacceptedOrdersMinutes` (number)
- `refundPolicy` (text)
- `fraudCheckEnabled` (boolean)

### 9) Notifications & Messaging
- `pushEnabled` (boolean)
- `smsEnabled` (boolean)
- `emailEnabled` (boolean)
- `notificationTemplates` (object)
  - UI: WYSIWYG/template editor for key templates (orderCreated, runnerAssigned, orderDelivered)
- `rateLimitNotificationsPerMinute` (number)

### 10) Integrations & Webhooks
- `webhooks` (array)
  - Structure: [{name, url, secretRef, events: []}]
  - UI: create/edit webhooks, test webhook button
- `thirdPartyIntegrations` (object)
  - e.g., analytics, CRM, accounting

### 11) Data, Privacy & Exports
- `dataRetentionDays` (number)
- `allowDataExport` (boolean)
- `exportFormats` (array)
- `gdprContact` (text)

### 12) Audit, Logging & Monitoring
- `auditLogRetentionDays` (number)
- `sendLogsTo` (enum: local, datadog, cloudwatch)
- `errorAlertEmails` (array)

### 13) Feature Flags & Experiments
- `featureFlags` (object)
  - UI: table with toggle, rollout percentage, target groups
- `experiments` (object)
  - UI: create AB tests, variants, metrics

### 14) Localization & Timezones
- `defaultTimezone` (string)
- `supportedLocales` (array)
- `currencyFormats` (object per-locale)

### 15) Maintenance, Backups & Disaster Recovery
- `scheduledBackup` (cron string)
- `lastBackupStatus` (read-only)
- `backupRetentionCount` (number)

### 16) Developer / Debugging Tools
- `enableDebugMode` (boolean)
- `apiMocking` (boolean)
- `logLevel` (enum: error, warn, info, debug)

---

## UI / UX Patterns & Requirements
- Show role-based visibility for each control.
- All pages provide `Save`, `Cancel`, `Reset to defaults` and `Export JSON` actions.
- Provide inline validation and acceptable value hints.
- Changes are staged locally until `Save` is clicked; `Preview` shows the effect where applicable (branding, identity, maintenance).
- When `Save` is clicked:
  1. Lock the UI and show progress spinner
  2. Call service to write to RTDB via a transaction that records `lastUpdatedBy` and `lastUpdatedAt`
  3. Append an entry to `/admin/audit_log/settings` containing before/after snapshot, user id and change reason (optional)
- Provide `Import JSON` for bulk updates with dry-run validation.
- Provide per-setting history (recent changes) accessible via a small `history` icon next to each key.

---

## Data Model Examples

Example: General settings object in RTDB

```
/admin/settings/general:
  companyName: "GoCrave"
  supportEmail: "support@gocrave.app"
  supportPhone: "+2348012345678"
  timezone: "Africa/Lagos"
  lastUpdatedAt: 1700000000000
  lastUpdatedBy: "uid_admin_123"
```

Feature flags example:

```
/admin/settings/featureFlags:
  promotionsV2:
    enabled: true
    rollout: 20
    targetGroups: ["beta_testers"]
```

Webhook example:

```
/admin/settings/webhooks:
  - id: webhook_1
    name: "Order Events"
    url: "https://hooks.example.com/orders"
    secretRef: "secret/webhooks/order_events"
    events: ["order.created","order.updated"]
```

---

## Audit & Compliance
- Every change to settings should write a record to `/admin/audit_log/settings` with:
  - `id`, `namespace`, `key`, `before`, `after`, `userId`, `userEmail`, `timestamp`, `reason`
- Keep audit log immutable (append-only) and respect `auditLogRetentionDays` policy.

---

## Migration & Versioning
- Maintain a `settings_schema_version` at `/admin/settings_meta/schemaVersion`.
- When adding fields, provide migration scripts that are idempotent and store migration logs at `/admin/migrations`.
- For breaking changes, provide a `compatibilityMode` toggle and a defined deprecation timeline.

---

## Security Notes
- Do NOT store plaintext API secrets in RTDB. Store references to secret manager or use encryption.
- Use server-side enforcement for critical toggles (e.g., `maintenanceMode`) — clients should only read; server processes should enforce behavior.
- Use role checks on server endpoints that accept setting changes.

---

## Developer Integration Points
- `adminSettings.service.js` should provide `getSettings(namespace)`, `subscribeSettings(namespace, cb)`, `saveSettings(patch)`, `resetDefaults()`.
- Cloud functions and servers should subscribe to `/admin/settings` for reactive behavior.

---

## Suggested Default Values (reference)
- `companyName`: "GoCrave"
- `primaryColor`: `#3b82f6`
- `themeMode`: `light`
- `currency`: `NGN`
- `defaultDeliveryFee`: 200
- `sessionTimeoutMinutes`: 30
- `maintenanceMode`: false

---

## Next Steps for Implementation
1. Implement `adminSettings.service.js` to centralize reads/writes.
2. Scaffold `AdminSettings.jsx` with form sections and per-key history links.
3. Add audit logging middleware in Cloud Functions or server to append changes.
4. Implement Import/Export JSON UI.
5. Add unit and integration tests to validate reading/writing and permissions.

---

End of specification.
