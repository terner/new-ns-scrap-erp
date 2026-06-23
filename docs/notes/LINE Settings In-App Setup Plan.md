# LINE Settings In-App Setup Plan

Date: 2026-06-23
Scope: `/admin/line-settings`, WTI/WTO LINE notification, and operator setup flow
Target: make day-to-day LINE setup finish inside NS Scrap ERP without opening LINE Developers

## Current Status

Core implementation is already in place in the current working branch:

- `/admin/line-settings` exists as the main LINE setup page.
- Server stores LINE channel access token and channel secret outside the browser.
- Admin can verify token, set webhook URL, check webhook information, test webhook, select a default LINE target, and send a test message.
- `/api/line/webhook` verifies LINE signature and records discovered `groupId`, `roomId`, or `userId`.
- `/daily/weight-ticket-list` share flow can generate a PDF and send a LINE Flex Message with PDF link.
- WTI/WTO create can auto-send after save when enabled in settings.

This is an MVP, not the final polished operator experience. The next work should focus on making setup obvious, hard to misconfigure, and easy to troubleshoot.

## Hard Boundary

The realistic goal is:

> After the LINE Messaging API channel, `Channel access token`, and `Channel secret` exist once, all normal setup should finish inside `/admin/line-settings`.

What we should not promise:

- Creating a new LINE Official Account or Messaging API channel fully inside our app.
- Getting a first token/secret without the channel owner creating or issuing them through LINE's own account/channel process.

Reason: LINE's official docs describe channel access tokens as the credential that authorizes an app to use a LINE channel, and Messaging API webhook management is exposed only after we already have that token. The Messaging API reference lists API endpoints for setting, getting, and testing webhook endpoint URLs, and receiving webhook events, so those parts can live in our app.

References:

- LINE channel access token docs: https://developers.line.biz/en/docs/basics/channel-access-token/
- LINE Messaging API reference: https://developers.line.biz/en/reference/messaging-api/
- LINE webhook receive docs: https://developers.line.biz/en/docs/messaging-api/receiving-messages/

## Desired Operator Flow

The operator should be able to do this in one page:

1. Open `/admin/line-settings`.
2. See current environment: local/dev/UAT/prod and the webhook URL for that host.
3. Paste `Channel access token` and `Channel secret`.
4. Click `à¸šà¸±à¸™à¸—à¸¶à¸`.
5. Click `à¸•à¸£à¸§à¸ˆ token`.
6. Click `à¸•à¸±à¹‰à¸‡ webhook à¹ƒà¸«à¹‰ LINE`.
7. Click `à¸—à¸”à¸ªà¸­à¸š webhook`.
8. Add the bot to the target LINE group, then send one message in that group.
9. Click `à¸£à¸µà¹€à¸Ÿà¸£à¸Š targets`.
10. Select the discovered group as default.
11. Click `à¸ªà¹ˆà¸‡à¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡à¸—à¸”à¸ªà¸­à¸š`.
12. Enable WTI/WTO auto-send if wanted.
13. Use the share button or create a real WTI/WTO and confirm the Flex Message arrives.

## Features To Add Next

## Detailed Feature Checklist

This section expands the requested `/admin/line-settings` feature set into explicit UI and behavior requirements.

### 1. Environment Status

Required fields/actions:

- Show environment name: `LOCAL`, `DEV`, `UAT`, `PROD`.
- Auto-detect current app URL from the opened host, for example:
  - `https://ns-dev.devkub.com`
  - `https://ns-uat.devkub.com`
- Show webhook URL for the current host:
  - `https://ns-dev.devkub.com/api/line/webhook`
  - `https://ns-uat.devkub.com/api/line/webhook`
- Add `à¸„à¸±à¸”à¸¥à¸­à¸ Webhook URL` button.
- Show latest webhook status:
  - last event received time
  - last webhook check time
  - last webhook test time
  - whether saved webhook URL matches current host

### 2. LINE Channel

Required fields/actions:

- Channel ID.
- Channel access token.
- Channel secret.
- `à¸—à¸”à¸ªà¸­à¸š Token` button.
- `à¸—à¸”à¸ªà¸­à¸š Webhook Secret` button.
- Mask saved values after save, for example `replace-with-line-channel-access-token`.
- Never show full token or full secret after save.
- Show who updated the settings and when.

### 3. LINE Groups / Targets

Required target table columns:

- Display name, for example `NS PRODUCTION`.
- `groupId`, `userId`, or `roomId`.
- Type: `group`, `user`, `room`.
- Applies to:
  - WTI
  - WTO
  - both
- Branch:
  - all branches
  - Samut Sakhon
  - other branches
- Active/inactive status.

Required target actions:

- `à¸ªà¹ˆà¸‡à¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡à¸—à¸”à¸ªà¸­à¸š`.
- `à¸•à¸±à¹‰à¸‡à¹€à¸›à¹‡à¸™à¸à¸¥à¸¸à¹ˆà¸¡à¸«à¸¥à¸±à¸`.
- Rename target.
- Disable target without deleting history.
- Refresh/discover targets from webhook events.

### 4. Auto Send

Required options:

- Enable/disable auto-send after creating WTI.
- Enable/disable auto-send after creating WTO.
- Choose behavior:
  - send immediately after save
  - require manual share button first
- Duplicate protection:
  - if a document has already been sent, ask before sending again
  - still allow admin/manual resend
- Failed-send handling:
  - failed sends must appear in the notification log
  - retry from log

### 5. Message Format

Required options:

- Template selection:
  - short summary
  - detailed summary
  - Flex card + PDF
- Default note text, for example `à¹à¸ˆà¹‰à¸‡à¹€à¸­à¸à¸ªà¸²à¸£à¸£à¸±à¸šà¸ªà¸´à¸™à¸„à¹‰à¸²`.
- Toggle fields shown in the LINE message:
  - seller/customer
  - branch
  - warehouse
  - gross weight
  - container deduction
  - impurity deduction
  - net weight
  - entered by
- Preview sample LINE card before saving.

### 6. PDF / Storage

Required options:

- PDF bucket, default `weight-ticket-pdfs`.
- Public URL or signed URL.
- Signed URL expiry when private mode is used.
- Images per page, default `8`.
- Include vehicle photos: yes/no.
- Include product photos: yes/no.
- `à¸ªà¸£à¹‰à¸²à¸‡ PDF à¸—à¸”à¸ªà¸­à¸š` button.

### 7. Notification Log

Required log columns:

- Document no.
- Sent target/group.
- Status: sent/failed.
- Error message.
- Requested by.
- Sent time.
- PDF URL/storage key.
- LINE request ID.

Required log actions:

- Retry.
- Open already-sent PDF.
- Open source WTI/WTO document.

## Recommended MVP

The first production-friendly version should include only these items:

- Channel access token.
- Channel secret.
- Webhook URL auto-display and copy button.
- LINE targets table.
- Default target.
- Test send button.
- Auto-send toggles for WTI/WTO.
- Notification log.

Everything else can be Phase 2 after the basic operator flow works reliably.

### 1. Setup Wizard

Add a wizard mode at the top of `/admin/line-settings`.

Steps:

- Step 1: Save token/secret.
- Step 2: Verify token and display bot name/basic ID.
- Step 3: Set webhook to this website.
- Step 4: Test webhook.
- Step 5: Discover target.
- Step 6: Choose default target.
- Step 7: Send test message.
- Step 8: Enable auto-send.

Each step should show:

- status: not started / passed / failed
- last checked time
- short next action
- detailed error if failed

### 2. Environment-Aware Settings

Support separate settings per environment:

- local
- dev: `https://ns-dev.devkub.com`
- UAT: `https://ns-uat.devkub.com`
- production, later

Recommended behavior:

- Detect environment from current host.
- Store settings with `environment_key`.
- Show a warning if the saved webhook domain differs from the website currently opened.
- Allow copying settings from dev to UAT only by an admin action.
- Never silently reuse dev target for UAT unless explicitly selected.

### 3. Webhook Health Panel

Add a clear health panel:

- Saved webhook URL.
- LINE-reported webhook URL.
- LINE-reported active status, if available from endpoint information.
- Last webhook event received.
- Last signature verification success.
- Last failed signature verification count/time.
- Last API error from LINE.

Operator-friendly statuses:

- `à¸žà¸£à¹‰à¸­à¸¡à¹ƒà¸Šà¹‰à¸‡à¸²à¸™`
- `à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹„à¸”à¹‰à¸•à¸±à¹‰à¸‡ webhook`
- `à¸•à¸±à¹‰à¸‡ webhook à¹à¸¥à¹‰à¸§ à¹à¸•à¹ˆà¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹€à¸„à¸¢à¸¡à¸µ event`
- `token à¹ƒà¸Šà¹‰à¹„à¸¡à¹ˆà¹„à¸”à¹‰`
- `secret à¹„à¸¡à¹ˆà¸•à¸£à¸‡`
- `target à¸«à¸¥à¸±à¸à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹„à¸”à¹‰à¹€à¸¥à¸·à¸­à¸`

### 4. Target Discovery And Naming

Improve target management:

- Auto-capture `groupId`, `roomId`, `userId`.
- Fetch LINE group summary for group targets when possible.
- Let admin rename targets in our system, e.g. `NS PD`, `à¸šà¸±à¸à¸Šà¸µ`, `à¸„à¸¥à¸±à¸‡ 2`.
- Let admin set target per branch.
- Let admin set target per document type:
  - WTI default group
  - WTO default group
  - both
- Let admin disable a target without deleting history.
- Show whether bot has recently seen the target.

### 5. Send Rules

Add routing rules:

- One global default target.
- Optional branch-specific target.
- Optional WTI/WTO-specific target.
- Optional manual override when pressing Share.

Priority:

1. Manual selected target from share dialog.
2. Branch + document type rule.
3. Branch rule.
4. Document type rule.
5. Global default target.

### 6. Share Button UX

The existing share button should become a clean operator choice:

- `à¸ªà¹ˆà¸‡à¹€à¸‚à¹‰à¸² LINE à¸«à¸¥à¸±à¸`
- `à¹€à¸¥à¸·à¸­à¸à¸à¸¥à¸¸à¹ˆà¸¡à¸à¹ˆà¸­à¸™à¸ªà¹ˆà¸‡`
- `à¹€à¸žà¸´à¹ˆà¸¡à¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡à¸à¹ˆà¸­à¸™à¸ªà¹ˆà¸‡`
- `à¹à¸Šà¸£à¹Œà¹€à¸­à¸‡à¸œà¹ˆà¸²à¸™ LINE`

Recommended default:

- If default target is configured: primary action sends to default target.
- If not configured: open settings hint and offer manual LINE share fallback.

### 7. Message Template Editor

Add a small template editor in `/admin/line-settings`:

- Header text for WTI.
- Header text for WTO.
- Which fields to show in Flex Message.
- Whether to show gross/deduction/net weight.
- Whether to show product count.
- Whether to show vehicle number.
- Whether to include buttons:
  - Open PDF
  - Open in system
  - Open print page

Keep this limited. Do not build a full drag-and-drop Flex designer yet.

### 8. PDF Settings

Add PDF settings:

- Storage bucket name.
- Public URL vs signed URL policy.
- Signed URL expiry days, if signed URL is selected.
- Include vehicle photos: yes/no.
- Include product photos: yes/no.
- Images per page: fixed at 8 for now.
- PDF retention days, later.

### 9. Notification Log And Retry

Add a visible log tab:

- Document no.
- Type: WTI/WTO.
- Target.
- Status: sent/failed.
- PDF URL.
- LINE request ID.
- Requested by.
- Sent at.
- Error message.

Actions:

- Retry failed notification.
- Resend latest PDF.
- Open PDF.
- Open source WTI/WTO.

### 10. Secret Safety

Security requirements:

- Never show full token/secret after save.
- Show only masked hints.
- Store encrypted values server-side.
- Never put real token/secret in `.env.example`, docs, screenshots, or commits.
- Add `updated_by` and `updated_at`.
- Optional later: rotate token workflow with `old token active` vs `new token test`.

### 11. Validation Before Enabling Auto-Send

Auto-send toggles should require:

- token verified
- webhook set or intentionally skipped
- default target selected
- test message succeeded
- PDF bucket reachable

If any requirement fails, keep auto-send disabled and show the exact missing step.

### 12. UAT Checklist

Before calling this production-ready:

- Apply migrations to dev.
- Configure `/admin/line-settings` on `https://ns-dev.devkub.com`.
- Test webhook from dev.
- Discover dev group target.
- Send test message.
- Create WTI and confirm LINE message.
- Create WTO and confirm LINE message.
- Verify generated PDF page 1 is the print document.
- Verify generated PDF page 2+ includes photos in 8-image layout.
- Repeat on `https://ns-uat.devkub.com`.
- Confirm dev and UAT do not send to the wrong group.

## Suggested Implementation Order

### Phase A: Make Current MVP Friendly

- Add setup wizard.
- Add environment-aware settings key.
- Add health panel.
- Add clear missing-step warnings.
- Add target rename/default/branch/type routing.

### Phase B: Make Operations Safe

- Add notification log UI.
- Add retry/resend.
- Add PDF settings.
- Add auto-send prerequisites.

### Phase C: Make It Customizable

- Add simple message template controls.
- Add per-branch/per-document routing UI.
- Add signed URL/retention policy.

## Acceptance Criteria

The feature is complete enough when:

- Admin can configure a fresh dev/UAT LINE connection using only `/admin/line-settings` after receiving token/secret.
- Admin can set webhook from the page.
- Admin can discover a group target from webhook events.
- Admin can send a test message from the page.
- WTI/WTO manual send works.
- WTI/WTO auto-send works only after required checks pass.
- Failed sends are visible and retryable.
- No secrets are exposed in client payloads, logs, docs, or git.
