# Security Specification (`security_spec.md`)

## 1. Data Invariants

1. **Default-Deny Catch-All**: Every unmatched path is strictly denied (`allow read, write: if false;`).
2. **Verified Identity & Role Source of Truth**:
   - All mutating operations require `request.auth != null && request.auth.token.email_verified == true`.
   - Administrator privileges (`isAdmin()`) are derived ONLY from either the verified bootstrapped admin email (`selvame@ai.jbedu.kr` with `email_verified == true`) or the existence of `/admins/$(request.auth.uid)`.
   - Non-admin users cannot self-assign `role: 'admin'` on `/users/{userId}` creation or update.
3. **PII Isolation (Split Collection Strategy)**:
   - `/users/{userId}` contains zero PII (no email, phone, or address).
   - `/users_private/{userId}` holds user email and is strictly readable only by `request.auth.uid == userId || isAdmin()`.
4. **Query Enforcer (`allow list`)**:
   - No collection allows blanket `allow list: if isSignedIn();`.
   - Every `allow list` rule evaluates `resource.data.schoolId == 'jeonju-sindong'` (or owner/admin scoping on private data), forcing clients to include `where('schoolId', '==', 'jeonju-sindong')`.
5. **Relational & Atomic Integrity for Reservations**:
   - A `Reservation` cannot be created unless the referenced `/rooms/$(incoming().roomId)` exists (`exists(...)`).
   - `userId` on a created `Reservation` must equal `request.auth.uid`.
   - `startPeriod` and `endPeriod` must satisfy `1 <= startPeriod && startPeriod <= endPeriod && endPeriod <= 6`.
   - Terminal State Locking: Once a `Reservation` has `status == 'cancelled'`, standard teachers cannot modify or reactivate it (`existing().status == 'confirmed'` required for teacher updates).
6. **Temporal Integrity**:
   - On `create`: `incoming().createdAt == request.time` (and `incoming().updatedAt == request.time` where present).
   - On `update`: `incoming().updatedAt == request.time` and `incoming().createdAt == existing().createdAt`.

---

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Payload 1 (Self-Assigned Admin Escalation on User Creation)**:
   - Target: `CREATE /users/teacher_1` (as non-admin `teacher_1`)
   - Payload: `{ "uid": "teacher_1", "schoolId": "jeonju-sindong", "displayName": "김교사", "role": "admin", "department": "5학년부", "grade": 5, "classNum": 2, "active": true, "createdAt": "<SERVER_TIME>", "updatedAt": "<SERVER_TIME>" }`
   - Expected: `PERMISSION_DENIED` (non-admin cannot create profile with `role == 'admin'`).

2. **Payload 2 (Shadow Field Injection on Reservation Creation)**:
   - Target: `CREATE /reservations/res_1`
   - Payload: Valid reservation fields + `{ "isBypassConflict": true }`
   - Expected: `PERMISSION_DENIED` (`hasOnly` rejects ghost key).

3. **Payload 3 (Identity Spoofing on Reservation Creation)**:
   - Target: `CREATE /reservations/res_2` (authenticated as `user_A`)
   - Payload: Reservation with `"userId": "user_B"`
   - Expected: `PERMISSION_DENIED` (`incoming().userId == request.auth.uid` fails).

4. **Payload 4 (Orphaned Reservation for Non-Existent Room)**:
   - Target: `CREATE /reservations/res_3`
   - Payload: Reservation referencing `"roomId": "non_existent_room_999"`
   - Expected: `PERMISSION_DENIED` (`exists(/databases/$(database)/documents/rooms/non_existent_room_999)` fails).

5. **Payload 5 (Terminal State Re-opening on Cancelled Reservation)**:
   - Target: `UPDATE /reservations/res_cancelled` (by owner `user_A`)
   - Payload: Changing `"status": "confirmed"` after `existing().status == "cancelled"`
   - Expected: `PERMISSION_DENIED` (Terminal State Locking blocks updates when `existing().status == 'cancelled'`).

6. **Payload 6 (PII Lateral Read on `/users_private/{userId}`)**:
   - Target: `GET /users_private/user_B` (authenticated as `user_A`)
   - Payload: N/A (Read request)
   - Expected: `PERMISSION_DENIED` (PII strictly isolated to owner or admin).

7. **Payload 7 (Unconstrained Blanket List Query on `/reservations`)**:
   - Target: `LIST /reservations` without `where('schoolId', '==', 'jeonju-sindong')`
   - Payload: N/A (Unfiltered query)
   - Expected: `PERMISSION_DENIED` (Query Enforcer requires `resource.data.schoolId == 'jeonju-sindong'`).

8. **Payload 8 (Email Spoofing Without Verification)**:
   - Target: `CREATE /rooms/room_sci_2` (authenticated with `email: 'vortexai369@gmail.com'`, `email_verified: false`)
   - Payload: Valid `SpecialRoom` object
   - Expected: `PERMISSION_DENIED` (`request.auth.token.email_verified == true` is mandatory).

9. **Payload 9 (ID Poisoning / Resource Exhaustion)**:
   - Target: `CREATE /reservations/invalid$id#with!bad@chars`
   - Payload: Valid reservation fields
   - Expected: `PERMISSION_DENIED` (`isValidId` regex `^[a-zA-Z0-9_\-]+$` blocks malformed ID).

10. **Payload 10 (Value Poisoning on Update)**:
    - Target: `UPDATE /reservations/res_active`
    - Payload: Updating whitelisted key `"purpose"` with a 5,000-character string or integer `12345`
    - Expected: `PERMISSION_DENIED` (`isValidReservation(incoming())` wraps the entire update block and enforces `purpose.size() <= 120`).

11. **Payload 11 (Timestamp Forgery / Backdating)**:
    - Target: `CREATE /reservations/res_backdated`
    - Payload: Valid reservation with `"createdAt": "2020-01-01T00:00:00Z"` instead of `request.time`
    - Expected: `PERMISSION_DENIED` (`incoming().createdAt == request.time` fails).

12. **Payload 12 (Audit Log Tampering / Deletion)**:
    - Target: `DELETE /auditLogs/log_1` or `UPDATE /auditLogs/log_1` (even by admin)
    - Payload: Attempting to erase or alter audit history
    - Expected: `PERMISSION_DENIED` (`auditLogs` is strictly append-only; `allow update, delete: if false;`).
