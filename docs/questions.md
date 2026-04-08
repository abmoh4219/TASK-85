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

**Solution Implemented:** No biometric capture is implemented in this build — the prompt uses "if captured" language. The masking architecture is in place: a central `maskId()` helper enforces last-4-character masking on all identifiers shown in the UI (procurement IDs, item IDs, sample IDs, etc.). The admin export-permission policy controls which fields are exportable per role. The system is architecturally ready for biometric integration via a future entity if needed — documented as out of scope for this delivery.

---

## 3. A-B Rollout Scope — Single Site vs Multi-Tenant

**Question:** The prompt says "staged gray rollout/A-B comparisons within a site." Does "within a site" mean within a single hospital deployment, or does the system need to support multiple sites?

**My Understanding:** "Within a site" means within a single on-premise deployment (one docker-compose stack = one hospital/clinic). A-B comparison means some users within the same deployment get rule version A, others get rule version B.

**Solution Implemented:** The rules engine A-B rollout assigns users to a group deterministically using a hash of `userId:ruleId` modulo 100, compared against the configurable `rolloutPercentage`. This ensures consistent assignment (same user always gets the same group for the same rule) while distributing evenly across the population. The `evaluateRuleForUser` service method returns whether a user is in the active group and the applicable rule definition. All within a single site deployment. Multi-site federation is explicitly out of scope.

---

## 4. Recommendation Feedback — Impression vs Click Definition

**Question:** The prompt mentions "recommendation feedback (impressions and clicks) for an on-prem closed loop." What exactly constitutes an impression vs a click in the replenishment recommendation context?

**My Understanding:** An impression is recorded when a replenishment recommendation is displayed to a user. A click is recorded when the user actively accepts the recommendation. This is standard recommendation system terminology applied to the procurement domain.

**Solution Implemented:** `RecommendationFeedback` records two event types: `IMPRESSION` (written when recommendation is fetched and returned — i.e., shown to the user) and `CLICK` (written when the user accepts the recommendation). Both are per-user, per-recommendation, with timestamp. The analytics endpoint returns CTR (click-through rate) per recommendation type for the closed-loop feedback.

---

## 5. JWT Storage — Access Token Client-Side Location

**Question:** The prompt says refresh tokens are "stored server-side for offline control" but does not specify where the client stores the access token. LocalStorage is vulnerable to XSS; httpOnly cookies have CSRF risks. What is the correct approach for an on-premise React app?

**My Understanding:** The access token (15min, short-lived) should be stored in memory. The refresh token needs to persist across page reloads. In an on-premise SPA with CSP/Helmet protections, localStorage is a pragmatic choice; httpOnly cookies are an alternative with CSRF tradeoffs.

**Solution Implemented:** Access token is stored in the Axios client's default Authorization header (in-memory). Refresh token is stored in localStorage with the user ID, used by the auto-refresh interceptor to obtain new access tokens on 401 responses. The refresh token is hashed server-side (bcrypt) and rotated on each use. This is a pragmatic tradeoff for an on-premise SPA where XSS risk is controlled by CSP headers and Helmet middleware. A future enhancement could migrate to httpOnly cookies with CSRF mitigation.

---

## 6. Partial Deliveries & Backorders — PO Lifecycle

**Question:** When a PO has partial delivery (some lines received, some backordered), what is the PO status? Can a PO be reconciled before all backorders are fulfilled?

**My Understanding:** A PO with partial delivery should remain in "partially-received" status until all lines are fulfilled or explicitly closed. Reconciliation should be possible on received portions independently.

**Solution Implemented:** PO status enum: `draft`, `approved`, `sent`, `partially_received`, `received`, `cancelled`. Each POLine tracks `receivedQuantity` and `backorderQuantity`. Reconciliation is performed at the PO level via `POST /procurement/orders/:id/reconcile`, comparing ordered vs received quantities and flagging discrepancies. The system updates PO status to `partially_received` when some lines are fulfilled, and `received` when all are complete.

---

## 7. Abnormal Consumption Calculation — Calendar Days vs Business Days

**Question:** The prompt says "7-day usage exceeds the prior 8-week average by 40% or more." Are these calendar days or business days? And is the 8-week average a rolling window or fixed calendar weeks?

**My Understanding:** In a medical supply context, consumption happens 7 days a week. Calendar days are correct. The 8-week average is a sliding window of the past 56 calendar days of consumption data.

**Solution Implemented:** 7-day usage = sum of outbound StockMovement quantities for the past 7 calendar days. 8-week average = total outbound movements in the past 56 calendar days ÷ 8 (giving a weekly average). If 7-day usage > 8-week-weekly-average × 1.4 → flag as `ABNORMAL_CONSUMPTION` Alert. Runs as part of the hourly AlertsService cron job.

---

## 8. Study Frequency Rules — Enforcement Mechanism

**Question:** The prompt says learning plans have "study frequency rules (for example, '3 sessions/week')." How is this enforced — does the system block access, send alerts, or just report compliance?

**My Understanding:** The system cannot block a user from working if they haven't completed study sessions — that would be disruptive in a hospital setting. Enforcement means tracking compliance and generating notifications when the target is not met.

**Solution Implemented:** Each LearningGoal stores a `sessionsPerWeek` integer column. The `GET /learning/goals/:id/compliance` endpoint calculates weekly compliance by counting study sessions in the past 7 days against the target. Returns `sessionsThisWeek`, `targetSessionsPerWeek`, `isBelowTarget`, and `compliancePercent`. HR/admin can view compliance for any plan; employees see only their own. No automated notification generation for frequency breaches in this build — compliance is query-based and visible in the learning detail UI.

---

## 9. Rules Engine Hot Update — No Restart Definition

**Question:** The prompt says the rules engine supports "hot updates" without restart. In a NestJS application, what does "no restart" mean?

**My Understanding:** "Hot update" means the rule change takes effect for new requests immediately after activation, without restarting the NestJS process or Docker container. Existing in-flight requests complete with the old rule; new requests use the new rule.

**Solution Implemented:** Business rules are loaded directly from the DB on each request via the RulesEngineService. When a rule is activated or rolled back, the change is persisted immediately in a DB transaction. The next request reads the updated state. No process restart required. Rollback uses an atomic DB transaction and enforces a 5-minute time limit (throws 400 if exceeded).

---

## 10. Data Encryption at Rest — Column-Level vs Disk-Level

**Question:** The prompt says "all data at rest is encrypted using AES-256 with per-environment keys." Does this mean column-level encryption in the application layer, or disk-level encryption?

**My Understanding:** Disk-level encryption is an infrastructure concern that cannot be fully demonstrated in a docker-compose submission. Column-level encryption in the application layer using TypeORM column transformers with AES-256 is the implementable requirement — this is what "per-environment keys" refers to.

**Solution Implemented:** Sensitive columns use TypeORM column transformers that encrypt on write and decrypt on read using AES-256-CBC with a random IV per write. The key is derived from the `ENCRYPTION_KEY` environment variable (required, no fallback — app fails to start without it). Encrypted fields: patient identifiers, clinical notes, lab result text values, vendor contact info, purchase request justifications, PO notes, project descriptions, learning plan descriptions, goal descriptions, deliverable descriptions, and acceptance score feedback. The encryption key is never logged or exposed via API. For full disk-level at-rest protection, production deployments should additionally enable volume-level encryption (LUKS/dm-crypt or cloud provider disk encryption).

---

## 11. Nonce + Timestamp Validation — Storage and Expiry

**Question:** The prompt requires "nonce and timestamp validation to deter replay." Where are nonces stored server-side, and what is the nonce expiry window?

**My Understanding:** Nonces need to be stored temporarily to detect reuse. For an on-premise system with PostgreSQL available, a `UsedNonce` table with a TTL-based cleanup is appropriate. The timestamp window should be tight enough to prevent replay but loose enough to tolerate minor clock skew — 5 minutes is the standard.

**Solution Implemented:** A `used_nonces` table stores (nonce, user_id, created_at). On each sensitive write request (POST/PATCH/DELETE), the nonce middleware checks: (1) timestamp within ±5 minutes of server time, (2) nonce not already in the table for that user. If both pass, nonce is inserted. Stale nonces are cleaned up asynchronously after each request (DELETE WHERE created_at < cutoff). User ID is extracted from the JWT Authorization header directly in the middleware (pre-guard phase) for proper per-user scoping. Auth endpoints (login/refresh/logout) are exempt from the nonce requirement but still validate nonce if provided.

---

## 12. Approved Substitutes — Who Approves and When

**Question:** The prompt says "approved substitutes when the original item is unavailable." Who approves substitutes — Supervisor or Administrator? And can substitutes be pre-approved in the catalog, or only case-by-case?

**My Understanding:** Both patterns make sense in a medical supply context. Pre-approved substitutes (in the item catalog, configured by Admin) are safer for routine items. Case-by-case approval by Supervisor makes sense for non-routine situations. The prompt says "approved substitutes" which implies a formal approval process.

**Solution Implemented:** Case-by-case substitute approval on purchase request items. When an item is unavailable, an admin can approve a substitute via `POST /procurement/requests/:id/substitute` by specifying `purchaseRequestItemId` and `substituteItemId`. The substitution is recorded on the PurchaseRequestItem and tracked in the audit log. Pre-approved catalog-level substitutes are not implemented in this build — this is a future enhancement that would add an `ItemSubstitute` join table.