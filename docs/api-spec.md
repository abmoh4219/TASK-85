# MeridianMed API Specification
# Task ID: w2t85
# Base URL: https://localhost:3000/api (proxied) or https://localhost:4000 (direct)
# Generated from: actual implemented code (Phase 13)

---

## Standard Response Envelope

All endpoints return JSON in this envelope:

```json
{ "data": <payload> }
```

Errors use:
```json
{
  "statusCode": 400,
  "message": "Human-readable error",
  "error": "Bad Request",
  "timestamp": "2026-04-04T10:00:00.000Z",
  "path": "/endpoint"
}
```

---

## Authentication

Most endpoints require `Authorization: Bearer <accessToken>`.

Sensitive write operations optionally accept replay-prevention headers:
- `X-Nonce: <unique-string>` — must be unique within 5 minutes
- `X-Timestamp: <unix-ms>` — must be within ±5 minutes of server time

Rate limiting: **10 requests/minute per authenticated user**. Exceeding returns HTTP 429.

---

## 1. Health

### GET /health
**Auth:** None (public)
**Response 200:**
```json
{ "status": "ok", "timestamp": "2026-04-04T10:00:00.000Z" }
```

---

## 2. Auth

### POST /auth/login
**Auth:** None (public) | **Rate limit:** 10/min
**Body:**
```json
{ "username": "admin", "password": "meridian2024" }
```
**Response 200:**
```json
{
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "abc123...",
    "userId": "uuid",
    "expiresIn": 900
  }
}
```
**Errors:** 401 wrong password / unknown user, 403 inactive user

---

### POST /auth/refresh
**Auth:** None (public) | **Rate limit:** 10/min
**Body:**
```json
{ "userId": "uuid", "refreshToken": "abc123..." }
```
**Response 200:**
```json
{
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "xyz789...",
    "expiresIn": 900
  }
}
```
**Errors:** 401 invalid or revoked token

---

### POST /auth/logout
**Auth:** Bearer token required
**Body:**
```json
{ "userId": "uuid", "refreshToken": "abc123..." }
```
**Response 200:**
```json
{ "data": { "message": "Logged out successfully" } }
```

---

### GET /auth/me
**Auth:** Bearer token required
**Response 200:**
```json
{
  "data": {
    "id": "uuid",
    "username": "admin",
    "role": "admin",
    "isActive": true,
    "lastLoginAt": "2026-04-04T10:00:00.000Z",
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```
Note: `passwordHash` is never returned.

---

## 3. Procurement

All procurement endpoints: **Auth required**

### POST /procurement/requests
**Roles:** All authenticated | **Rate limit:** 10/min
**Body:**
```json
{
  "items": [
    { "itemId": "uuid", "quantity": 10, "unitOfMeasure": "box", "estimatedUnitPrice": 25.00 }
  ],
  "justification": "Monthly supply replenishment"
}
```
**Response 201:** `{ "data": PurchaseRequest }`

---

### GET /procurement/requests
**Roles:** All authenticated
**Response 200:** `{ "data": PurchaseRequest[] }`
Note: Employees see only their own requests. Admin/Supervisor see all.

---

### PATCH /procurement/requests/:id/submit
**Roles:** All authenticated
**Response 200:** `{ "data": PurchaseRequest }` (status → submitted)

---

### PATCH /procurement/requests/:id/approve
**Roles:** admin, supervisor
**Response 200:** `{ "data": PurchaseRequest }` (status → approved)

---

### PATCH /procurement/requests/:id/reject
**Roles:** admin, supervisor
**Response 200:** `{ "data": PurchaseRequest }` (status → rejected)

---

### POST /procurement/requests/:id/substitute
**Roles:** admin
**Body:** `{ "substituteItemId": "uuid", "reason": "string" }`
**Response 201:** `{ "data": PurchaseRequestItem }`

---

### POST /procurement/rfq
**Roles:** admin, supervisor | **Rate limit:** 10/min
**Body:**
```json
{
  "requestId": "uuid",
  "vendorIds": ["uuid1", "uuid2"],
  "lines": [
    { "itemId": "uuid", "quantity": 10, "unitOfMeasure": "box" }
  ]
}
```
**Response 201:** `{ "data": RFQ }`

---

### POST /procurement/rfq/:id/quotes
**Roles:** admin, supervisor
**Body:**
```json
{
  "vendorId": "uuid",
  "rfqLineId": "uuid",
  "unitPrice": 22.50,
  "leadTimeDays": 7,
  "notes": "In stock"
}
```
**Response 201:** `{ "data": VendorQuote }`

---

### GET /procurement/rfq/:id/comparison
**Roles:** admin, supervisor
**Response 200:**
```json
{
  "data": {
    "rfqId": "uuid",
    "lines": [
      {
        "itemId": "uuid",
        "itemName": "Item Name",
        "quotes": [
          { "vendorId": "uuid", "vendorName": "Vendor", "unitPrice": 22.50, "leadTimeDays": 7, "isLowest": true }
        ]
      }
    ],
    "recommendedVendorId": "uuid"
  }
}
```

---

### POST /procurement/orders
**Roles:** admin, supervisor | **Rate limit:** 10/min
**Body:**
```json
{ "rfqId": "uuid", "vendorId": "uuid" }
```
**Response 201:** `{ "data": PurchaseOrder }` — sets `priceLockUntil = approvedAt + 30 days`

---

### GET /procurement/orders
**Roles:** admin, supervisor
**Response 200:** `{ "data": PurchaseOrder[] }`

---

### GET /procurement/orders/:id
**Roles:** admin, supervisor
**Response 200:** `{ "data": PurchaseOrder }` with lines, receipts

---

### PATCH /procurement/orders/:id/approve
**Roles:** admin, supervisor
**Response 200:** `{ "data": PurchaseOrder }` (status → approved)

---

### PATCH /procurement/orders/:poId/lines/:lineId/price
**Roles:** admin
**Body:** `{ "unitPrice": 25.00 }`
**Response 200:** `{ "data": POLine }`
**Errors:** 400 if within 30-day price lock window

---

### POST /procurement/orders/:id/receipts
**Roles:** admin, supervisor
**Body:**
```json
{
  "lines": [
    { "poLineId": "uuid", "itemId": "uuid", "quantityReceived": 8, "lotNumber": "LOT001", "expiresAt": "2027-01-01" }
  ],
  "notes": "Partial delivery"
}
```
**Response 201:** `{ "data": POReceipt }`

---

### PATCH /procurement/receipts/:id/inspect
**Roles:** admin, supervisor
**Body:**
```json
{
  "lines": [
    { "receiptLineId": "uuid", "inspectionStatus": "pass", "inspectionNotes": "OK" }
  ]
}
```
**Response 200:** `{ "data": POReceipt }`

---

### POST /procurement/receipts/:id/putaway
**Roles:** admin, supervisor
**Body:**
```json
{
  "lines": [
    { "receiptLineId": "uuid", "location": "Shelf A-3", "quantityStored": 8 }
  ]
}
```
**Response 201:** `{ "data": PutAway[] }`

---

### POST /procurement/orders/:id/reconcile
**Roles:** admin, supervisor
**Response 201:** `{ "data": { "status": "matched"|"discrepancy", "discrepancies": [] } }`

---

## 4. Inventory

All inventory endpoints: **Auth required**

### GET /inventory/items
**Roles:** All authenticated
**Response 200:** `{ "data": Item[] }` — includes `inventoryLevel`, `alerts[]`

---

### GET /inventory/items/:id
**Roles:** All authenticated
**Response 200:** `{ "data": Item }` with full stock history

---

### GET /inventory/alerts
**Roles:** All authenticated
**Query:** `?status=active|acknowledged|resolved`
**Response 200:** `{ "data": Alert[] }`
Alert types: `safety_stock`, `min_max`, `near_expiry`, `abnormal_consumption`

---

### PATCH /inventory/alerts/:id/acknowledge
**Roles:** admin, supervisor
**Response 200:** `{ "data": Alert }` (status → acknowledged)

---

### POST /inventory/alerts/run-checks
**Roles:** admin
**Response 200:** `{ "data": { "triggered": true } }`
Runs all 4 alert checks immediately.

---

### GET /inventory/recommendations
**Roles:** admin, supervisor
**Response 200:** `{ "data": ReplenishmentRecommendation[] }`

---

### POST /inventory/recommendations/generate
**Roles:** admin, supervisor
**Body:** `{ "itemIds": ["uuid1", "uuid2"] }` (optional — omit to run for all items)
**Response 201:** `{ "data": ReplenishmentRecommendation[] }`
Formula: `qty = (leadTimeDays + bufferDays) × avgDailyUsage` (bufferDays default: 14)

---

### POST /inventory/recommendations/:id/accept
**Roles:** admin, supervisor
**Response 201:** Auto-drafts a PurchaseRequest. `{ "data": PurchaseRequest }`

---

### POST /inventory/recommendations/:id/dismiss
**Roles:** admin, supervisor
**Response 201:** `{ "data": ReplenishmentRecommendation }` (status → dismissed)

---

### POST /inventory/recommendations/:id/impression
**Roles:** admin, supervisor
**Response 200:** `{ "data": RecommendationFeedback }` — records impression event

---

## 5. Lab

All lab endpoints: **Auth required**

### POST /lab/tests
**Roles:** admin, supervisor
**Body:**
```json
{
  "name": "Hemoglobin", "testCode": "HGB",
  "sampleType": "Blood", "unit": "g/dL",
  "referenceRanges": [
    { "population": "adult_male", "minValue": 13.5, "maxValue": 17.5, "criticalLow": 7.0, "criticalHigh": 20.0 }
  ]
}
```
**Response 201:** `{ "data": LabTestDictionary }`

---

### GET /lab/tests
**Roles:** All authenticated
**Response 200:** `{ "data": LabTestDictionary[] }` with reference ranges

---

### PATCH /lab/tests/:id
**Roles:** admin, supervisor
**Body:** Partial LabTestDictionary fields
**Response 200:** `{ "data": LabTestDictionary }`

---

### POST /lab/samples
**Roles:** All authenticated
**Body:**
```json
{
  "sampleType": "Blood",
  "collectionDate": "2026-04-04T10:00:00.000Z",
  "patientIdentifier": "PATIENT-2024-ABC1234",
  "notes": "Fasting sample"
}
```
**Response 201:** `{ "data": LabSample }`
Note: `patientIdentifier` is AES-256 encrypted at rest; API response shows `****XXXX` (last 4 chars).

---

### GET /lab/samples
**Roles:** All authenticated
**Response 200:** `{ "data": LabSample[] }`
Note: Employees see only their own samples. Admin/Supervisor see all.
`patientIdentifier` masked to `****XXXX` in all responses.

---

### GET /lab/samples/:id
**Roles:** All authenticated
**Response 200:** `{ "data": LabSample }` with results and test details.
`patientIdentifier` masked to `****XXXX`.

---

### PATCH /lab/samples/:id/status
**Roles:** admin, supervisor
**Body:** `{ "status": "in_progress"|"reported"|"archived" }`
**Response 200:** `{ "data": LabSample }`
Valid transitions: `submitted→in_progress→reported→archived`
**Errors:** 400 invalid transition

---

### POST /lab/samples/:id/results
**Roles:** admin, supervisor
**Body:**
```json
{
  "results": [
    { "testId": "uuid", "value": "14.2", "numericValue": 14.2, "notes": "Normal" }
  ]
}
```
**Response 201:** `{ "data": LabResult[] }`
Note: `isAbnormal` and `isCritical` are auto-computed against reference ranges.

---

### POST /lab/samples/:id/report
**Roles:** admin, supervisor
**Body:** `{ "content": "Report narrative text...", "changeNotes": "Initial report" }`
**Response 201:** `{ "data": LabReport }`

---

### GET /lab/reports/:id
**Roles:** All authenticated
**Response 200:** `{ "data": LabReport }`

---

### PATCH /lab/reports/:id
**Roles:** admin, supervisor
**Body:** `{ "content": "Updated narrative...", "changeNotes": "Corrected value" }`
**Response 200:** `{ "data": LabReport }` — creates new LabReportVersion (immutable audit trail)

---

### GET /lab/reports/:id/history
**Roles:** All authenticated
**Response 200:** `{ "data": LabReportVersion[] }` — all versions ordered by version number

---

### PATCH /lab/reports/:id/archive
**Roles:** admin, supervisor
**Response 200:** `{ "data": LabReport }` (status → archived)

---

## 6. Projects

All project endpoints: **Auth required**

### POST /projects
**Roles:** admin, supervisor
**Body:**
```json
{
  "name": "Q2 Equipment Upgrade",
  "description": "...",
  "assignedToId": "uuid",
  "startDate": "2026-04-01",
  "targetEndDate": "2026-06-30"
}
```
**Response 201:** `{ "data": Project }`

---

### GET /projects
**Roles:** All authenticated
**Response 200:** `{ "data": Project[] }`

---

### GET /projects/:id
**Roles:** All authenticated
**Response 200:** `{ "data": Project }` with tasks, milestones

---

### PATCH /projects/:id/status
**Roles:** admin, supervisor
**Body:** `{ "status": "change"|"inspection"|"final_acceptance"|"archive" }`
**Response 200:** `{ "data": Project }`
Valid transitions: `initiation→change→inspection→final_acceptance→archive`

---

### POST /projects/:id/tasks
**Roles:** All authenticated
**Body:**
```json
{
  "title": "Install equipment",
  "description": "...",
  "priority": "high",
  "assignedToId": "uuid",
  "dueDate": "2026-05-01"
}
```
**Response 201:** `{ "data": ProjectTask }`

---

### GET /projects/:id/tasks
**Roles:** All authenticated
**Response 200:** `{ "data": ProjectTask[] }`

---

### PATCH /projects/:id/tasks/:taskId/status
**Roles:** All authenticated (supervisor/admin can approve; employee moves own tasks)
**Body:** `{ "status": "in_progress"|"review"|"done" }`
**Response 200:** `{ "data": ProjectTask }`

---

### POST /projects/:id/milestones
**Roles:** admin, supervisor
**Body:**
```json
{ "name": "Phase 1 Complete", "targetDate": "2026-05-15", "description": "..." }
```
**Response 201:** `{ "data": Milestone }`

---

### GET /projects/:id/milestones
**Roles:** All authenticated
**Response 200:** `{ "data": Milestone[] }`

---

### PATCH /projects/:id/milestones/:milestoneId
**Roles:** admin, supervisor
**Body:** `{ "progressPercentage": 75, "completedDate": "2026-05-10", "notes": "..." }`
**Response 200:** `{ "data": Milestone }`

---

### POST /projects/:id/tasks/:taskId/deliverables
**Roles:** All authenticated
**Body:** `{ "title": "Installation report", "description": "...", "fileUrl": "..." }`
**Response 201:** `{ "data": Deliverable }`

---

### POST /projects/:id/acceptance-score
**Roles:** admin, supervisor
**Body:** `{ "score": 92, "notes": "...", "criteria": { "quality": 95, "timeliness": 89 } }`
**Response 201:** `{ "data": AcceptanceScore }`

---

### GET /projects/:id/acceptance-score
**Roles:** admin, supervisor
**Response 200:** `{ "data": AcceptanceScore[] }`

---

## 7. Learning

All learning endpoints: **Auth required**

### POST /learning/plans
**Roles:** admin, hr
**Body:**
```json
{
  "title": "NestJS Mastery",
  "description": "...",
  "assignedToId": "uuid",
  "targetRole": "supervisor",
  "targetCompletionDate": "2026-12-31"
}
```
**Response 201:** `{ "data": LearningPlan }`

---

### GET /learning/plans
**Roles:** All authenticated
**Response 200:** `{ "data": LearningPlan[] }`
Note: Employees see only plans assigned to them. Admin/HR see all.

---

### GET /learning/plans/:id
**Roles:** All authenticated
**Response 200:** `{ "data": LearningPlan }` with goals

---

### PATCH /learning/plans/:id/status
**Roles:** admin, hr
**Body:** `{ "status": "active"|"paused"|"completed"|"archived", "reason": "Optional reason" }`
**Response 200:** `{ "data": LearningPlan }`
Valid transitions: `not_started→active→paused→active→completed→archived`
Creates `LearningPlanLifecycle` record.

---

### GET /learning/plans/:id/lifecycle
**Roles:** All authenticated
**Response 200:** `{ "data": LearningPlanLifecycle[] }` — full status history

---

### POST /learning/plans/:id/goals
**Roles:** admin, hr
**Body:**
```json
{
  "title": "Complete NestJS modules",
  "priority": "high",
  "tags": ["backend", "nestjs"],
  "studyFrequency": "3 sessions/week",
  "targetSessions": 24,
  "dueDate": "2026-09-01"
}
```
**Response 201:** `{ "data": LearningGoal }`

---

### GET /learning/plans/:id/goals
**Roles:** All authenticated
**Response 200:** `{ "data": LearningGoal[] }`

---

### POST /learning/goals/:id/sessions
**Roles:** All authenticated
**Body:** `{ "durationMinutes": 60, "notes": "Completed chapter 3", "sessionDate": "2026-04-04" }`
**Response 201:** `{ "data": StudySession }`

---

### GET /learning/goals/:id/compliance
**Roles:** All authenticated
**Response 200:**
```json
{
  "data": {
    "goalId": "uuid",
    "studyFrequency": "3 sessions/week",
    "sessionsPerWeek": 3,
    "sessionsThisWeek": 2,
    "compliancePercent": 66.7,
    "isBelowTarget": true
  }
}
```

---

## 8. Rules Engine

All rules endpoints: **Roles: admin only**

### POST /rules
**Body:**
```json
{
  "name": "Price Lock 30 Days",
  "description": "Lock PO unit prices for 30 days after approval",
  "category": "procurement_threshold",
  "definition": { "lockDays": 30 },
  "isAbTest": false,
  "rolloutPercentage": 100
}
```
**Response 201:** `{ "data": BusinessRule }` (status = draft)

---

### GET /rules
**Response 200:** `{ "data": BusinessRule[] }`

---

### GET /rules/:id
**Response 200:** `{ "data": BusinessRule }` with current version details

---

### PATCH /rules/:id
**Body:** `{ "name": "...", "definition": {...}, "description": "..." }`
**Response 200:** `{ "data": BusinessRule }` — creates new RuleVersion

---

### POST /rules/validate
**Body:** Same as POST /rules body
**Response 200:**
```json
{
  "data": {
    "hasConflicts": false,
    "conflicts": []
  }
}
```
Conflict example: `[{ "ruleId": "uuid", "ruleName": "...", "reason": "..." }]`

---

### GET /rules/:id/impact
**Response 200:**
```json
{
  "data": {
    "ruleId": "uuid",
    "affectedWorkflows": ["procurement.price_lock", "po.approval"],
    "summary": "This rule affects 2 workflows..."
  }
}
```

---

### PATCH /rules/:id/rollout
**Body:** `{ "rolloutPercentage": 50 }`
**Response 200:** `{ "data": BusinessRule }` (status → staged)

---

### PATCH /rules/:id/activate
**Response 200:** `{ "data": BusinessRule }` (status → active)

---

### POST /rules/:id/rollback
**Response 201:** `{ "data": BusinessRule }` — reverts to previous RuleVersion
Must complete within 5 minutes (MAX_ROLLBACK_MS = 300,000ms)
**Errors:** 400 if no previous version exists, 400 if rollback exceeds 5-minute time limit

---

## 9. Notifications

All notification endpoints: **Auth required**

### GET /notifications
**Roles:** All authenticated
**Response 200:** `{ "data": Notification[] }` — last 50, newest first

---

### GET /notifications/unread-count
**Roles:** All authenticated
**Response 200:** `{ "data": { "count": 3 } }`

---

### PATCH /notifications/:id/read
**Roles:** All authenticated
**Response 200:** `{ "data": Notification }` (isRead → true)

---

### PATCH /notifications/read-all
**Roles:** All authenticated
**Response 200:** `{ "data": { "success": true } }`

---

### GET /anomalies
**Roles:** admin, supervisor
**Query:** `?status=pending|reviewed|dismissed|escalated`
**Response 200:** `{ "data": AnomalyEvent[] }` — last 100, newest first

---

### PATCH /anomalies/:id/review
**Roles:** admin, supervisor
**Body:** `{ "notes": "Investigated — false positive", "status": "dismissed" }`
**Response 200:** `{ "data": AnomalyEvent }`

---

## 10. Admin — User Management

All admin/users endpoints: **Roles: admin only**

### GET /admin/users
**Response 200:** `{ "data": User[] }` — `passwordHash` never included

---

### POST /admin/users
**Body:**
```json
{ "username": "newuser", "password": "SecurePass123!", "role": "employee" }
```
**Response 201:** `{ "data": User }` — `passwordHash` never included

---

### PATCH /admin/users/:id
**Body:** `{ "role": "supervisor" }` or `{ "isActive": true }`
**Response 200:** `{ "data": User }`

---

### PATCH /admin/users/:id/deactivate
**Response 200:** `{ "data": User }` (isActive → false)
Note: Record is NOT deleted — soft deactivation only.

---

## Auth Flow Diagrams

### Login Flow
```
POST /auth/login { username, password }
  → bcrypt.compare(password, user.passwordHash)
  → generate JWT (sub=userId, role, exp=+15min)
  → generate refreshToken (random 38 bytes → hex)
  → store SHA-256(refreshToken) in refresh_tokens table with expiresAt=+8h
  → return { accessToken, refreshToken, userId, expiresIn: 900 }
```

### Refresh Flow
```
POST /auth/refresh { userId, refreshToken }
  → look up refresh_tokens WHERE user_id=$userId AND revoked_at IS NULL
  → compare SHA-256(refreshToken) against stored token_hash
  → if match AND not expired: revoke old token (set revoked_at=now())
  → generate new JWT + new refreshToken
  → store new token in DB
  → return { accessToken, refreshToken, expiresIn: 900 }
```

### Logout Flow
```
POST /auth/logout { userId, refreshToken } + Bearer token
  → look up and revoke refresh token (set revoked_at=now())
  → return { message: "Logged out successfully" }
```

---

## Error Codes Reference

| HTTP Code | Meaning                              | Common Causes                                  |
|-----------|--------------------------------------|------------------------------------------------|
| 400       | Bad Request                          | Validation failure, duplicate nonce, invalid transition, price lock violation |
| 401       | Unauthorized                         | Missing/expired/invalid JWT, revoked refresh token |
| 403       | Forbidden                            | Insufficient role for endpoint, inactive user login |
| 404       | Not Found                            | Resource UUID not found                        |
| 400       | Bad Request                          | Rules rollback exceeded 5-minute limit         |
| 409       | Conflict                             | Duplicate username, unique constraint violation |
| 429       | Too Many Requests                    | Rate limit exceeded (10 req/min/user)          |
| 500       | Internal Server Error                | Unexpected server error (see logs)             |

---

## Rate Limiting Details

Rate limit applies per authenticated user ID (not per IP).
- **Limit:** 10 requests per 60 seconds
- **Scope:** All endpoints
- **Response on breach:** HTTP 429 with body `{ "message": "Too Many Requests" }`
- **Side effect:** Creates `AnomalyEvent(type=rate_limit_exceeded)` in database — visible in `GET /anomalies`

Login and refresh endpoints also have their own `@Throttle({ default: { limit: 10, ttl: 60000 } })` decorators as a secondary guard for unauthenticated burst protection.
