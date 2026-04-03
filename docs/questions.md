# questions.md — MeridianMed Supply & Lab Operations Platform
# Task ID: w2t85
# Business Logic Questions & Clarifications Log
# Format: Question → My Understanding/Assumption → Solution Implemented

---

## 1. TLS Within LAN — Certificate Management

**Question:** The prompt states "all traffic uses TLS even within the LAN." In a fully on-premise Docker deployment, who manages the TLS certificates? Does the QA/acceptance environment expect real certificates or are self-signed acceptable?

**My Understanding:** For an on-premise deployment delivered via docker-compose, real CA-signed certificates are not feasible at submission time. Self-signed certificates are the standard approach for dev/acceptance environments. The prompt's intent is to enforce the encryption requirement architecturally — not to mandate production PKI infrastructure.

**Solution Implemented:** Nginx is configured with TLS using self-signed certificates generated at container startup. The architecture is designed so that in production, a real certificate can be dropped in by replacing the cert/key volume mounts — no code changes required. A clear note is added to README explaining the production cert swap procedure.

---

## 2. Face-Related Fields — Biometric Capture Scope

**Question:** The prompt mentions "face-related fields, if captured for internal identity checks, are minimized to non-reconstructable templates, masked by default in the UI (only last 4 characters of any identifier shown), and never exposed via export unless explicitly permitted by admin policy." Does this mean the system must implement actual facial recognition/capture, or is this a design constraint for IF such data exists?

**My Understanding:** The prompt uses the phrase "if captured" — this is a conditional constraint, not a mandatory feature. The requirement is to implement the masking architecture and export policy controls so that IF biometric data were ever integrated, the system handles it correctly.

**Solution Implemented:** A `BiometricIdentifier` entity is created with a `templateHash` field (non-reconstructable, one-way). The UI enforces last-4-character masking on any field flagged as `sensitiveIdentifier: true`. The admin export policy controls which fields are exportable per role. No actual biometric capture hardware integration is implemented — the hook is clearly documented and ready for integration.

---

## 3. A-B Rollout Scope — Single Site vs Multi-Tenant

**Question:** The prompt says "staged gray rollout/A-B comparisons within a site." Does "within a site" mean within a single hospital deployment, or does the system need to support multiple sites?

**My Understanding:** "Within a site" means within a single on-premise deployment (one docker-compose stack = one hospital/clinic). A-B comparison means some users within the same deployment get rule version A, others get rule version B.

**Solution Implemented:** The rules engine A-B rollout assigns users to group A or group B based on `userId % 2` (deterministic, reproducible). The rollout percentage is configurable (e.g., 50% gets new rule, 50% gets old). All within a single site deployment. Multi-site federation is explicitly out of scope and documented as a future extension point.

---

## 4. Recommendation Feedback — Impression vs Click Definition

**Question:** The prompt mentions "recommendation feedback (impressions and clicks) for an on-prem closed loop." What exactly constitutes an impression vs a click in the replenishment recommendation context?

**My Understanding:** An impression is recorded when a replenishment recommendation is displayed to a user. A click is recorded when the user actively accepts the recommendation. This is standard recommendation system terminology applied to the procurement domain.

**Solution Implemented:** `RecommendationFeedback` records two event types: `IMPRESSION` (written when recommendation is fetched and returned — i.e., shown to the user) and `CLICK` (written when the user accepts the recommendation). Both are per-user, per-recommendation, with timestamp. The analytics endpoint returns CTR (click-through rate) per recommendation type for the closed-loop feedback.

---

## 5. JWT Storage — Access Token Client-Side Location

**Question:** The prompt says refresh tokens are "stored server-side for offline control" but does not specify where the client stores the access token. LocalStorage is vulnerable to XSS; httpOnly cookies have CSRF risks. What is the correct approach for an on-premise React app?

**My Understanding:** The access token (15min, short-lived) should be stored in memory only — never in localStorage. The refresh token should be stored in an httpOnly, SameSite=Strict cookie to prevent XSS access while remaining usable for the refresh flow.

**Solution Implemented:** Access token stored in React AuthContext memory only (lost on page refresh, then auto-refreshed via the httpOnly refresh token cookie). Refresh token set as httpOnly + SameSite=Strict + Secure cookie by the backend. On page load, the app calls GET /auth/me — if a valid refresh token cookie exists, a new access token is issued automatically giving seamless UX without LocalStorage token exposure.

---

## 6. Partial Deliveries & Backorders — PO Lifecycle

**Question:** When a PO has partial delivery (some lines received, some backordered), what is the PO status? Can a PO be reconciled before all backorders are fulfilled?

**My Understanding:** A PO with partial delivery should remain in "partially-received" status until all lines are fulfilled or explicitly closed. Reconciliation should be possible on received portions independently.

**Solution Implemented:** PO status enum includes: `draft`, `approved`, `sent`, `partially-received`, `fully-received`, `partially-reconciled`, `reconciled`, `closed`. Each POLine has its own status. Reconciliation can be triggered per-line or for all received lines. Backorders can be explicitly closed by a Supervisor, which moves the PO to `closed` even if not fully received.

---

## 7. Abnormal Consumption Calculation — Calendar Days vs Business Days

**Question:** The prompt says "7-day usage exceeds the prior 8-week average by 40% or more." Are these calendar days or business days? And is the 8-week average a rolling window or fixed calendar weeks?

**My Understanding:** In a medical supply context, consumption happens 7 days a week. Calendar days are correct. The 8-week average is a sliding window of the past 56 calendar days of consumption data.

**Solution Implemented:** 7-day usage = sum of outbound StockMovement quantities for the past 7 calendar days. 8-week average = total outbound movements in the past 56 calendar days ÷ 8 (giving a weekly average). If 7-day usage > 8-week-weekly-average × 1.4 → flag as `ABNORMAL_CONSUMPTION` Alert. Runs as part of the hourly AlertsService cron job.

---

## 8. Study Frequency Rules — Enforcement Mechanism

**Question:** The prompt says learning plans have "study frequency rules (for example, '3 sessions/week')." How is this enforced — does the system block access, send alerts, or just report compliance?

**My Understanding:** The system cannot block a user from working if they haven't completed study sessions — that would be disruptive in a hospital setting. Enforcement means tracking compliance and generating notifications when the target is not met.

**Solution Implemented:** StudyFrequencyRule stored as `{ sessionsPerWeek: number, windowType: 'calendar-week' }`. The LearningService calculates weekly compliance. If compliance < 1.0 at end of week, a `STUDY_FREQUENCY_BREACH` notification is created for the employee and their supervisor. HR dashboard shows compliance rate per plan. No access blocking — compliance reporting and notifications only.

---

## 9. Rules Engine Hot Update — No Restart Definition

**Question:** The prompt says the rules engine supports "hot updates" without restart. In a NestJS application, what does "no restart" mean?

**My Understanding:** "Hot update" means the rule change takes effect for new requests immediately after activation, without restarting the NestJS process or Docker container. Existing in-flight requests complete with the old rule; new requests use the new rule.

**Solution Implemented:** Business rules are loaded from the DB with a 30-second in-memory cache. When a rule is activated, the cache is immediately invalidated. The next request fetches the new version from DB. No process restart required. The rollback follows the same cache invalidation pattern and completes the DB transaction + cache invalidation in under 5 minutes (typically under 1 second).

---

## 10. Data Encryption at Rest — Column-Level vs Disk-Level

**Question:** The prompt says "all data at rest is encrypted using AES-256 with per-environment keys." Does this mean column-level encryption in the application layer, or disk-level encryption?

**My Understanding:** Disk-level encryption is an infrastructure concern that cannot be fully demonstrated in a docker-compose submission. Column-level encryption in the application layer using TypeORM column transformers with AES-256 is the implementable requirement — this is what "per-environment keys" refers to.

**Solution Implemented:** Sensitive columns use TypeORM column transformers that encrypt on write and decrypt on read using AES-256-GCM with a key from the `ENCRYPTION_KEY` environment variable (provided in docker-compose with a default dev key). The encryption key is never logged or exposed via API. Production deployments replace the key via environment variable — no code changes required.

---

## 11. Nonce + Timestamp Validation — Storage and Expiry

**Question:** The prompt requires "nonce and timestamp validation to deter replay." Where are nonces stored server-side, and what is the nonce expiry window?

**My Understanding:** Nonces need to be stored temporarily to detect reuse. For an on-premise system with PostgreSQL available, a `UsedNonce` table with a TTL-based cleanup is appropriate. The timestamp window should be tight enough to prevent replay but loose enough to tolerate minor clock skew — 5 minutes is the standard.

**Solution Implemented:** A `UsedNonce` table stores (nonce, userId, usedAt). On each sensitive write request, the middleware checks: (1) timestamp within ±5 minutes of server time, (2) nonce not already in UsedNonce table. If both pass, nonce is inserted. A cleanup job runs hourly to delete nonces older than 10 minutes. This prevents replay while keeping the table small.

---

## 12. Approved Substitutes — Who Approves and When

**Question:** The prompt says "approved substitutes when the original item is unavailable." Who approves substitutes — Supervisor or Administrator? And can substitutes be pre-approved in the catalog, or only case-by-case?

**My Understanding:** Both patterns make sense in a medical supply context. Pre-approved substitutes (in the item catalog, configured by Admin) are safer for routine items. Case-by-case approval by Supervisor makes sense for non-routine situations. The prompt says "approved substitutes" which implies a formal approval process.

**Solution Implemented:** Two-tier substitute system: (1) Admin can configure pre-approved substitutes in the item catalog (`ItemSubstitute` table with `approvedBy: admin`). (2) When a PR item is unavailable, the system suggests pre-approved substitutes automatically. If no pre-approved substitute exists, a Supervisor can approve a case-by-case substitute on the PR line (`substituteApproval` workflow). Both paths are tracked in audit log.