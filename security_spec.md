# Security Specification — QHS Engenharia (Almoxarifado & Estoque)

## 1. Data Invariants

1. **Identity & Verification Invariant**: Every read or write operation requires an authenticated user with a verified Google email (`request.auth != null && request.auth.token.email_verified == true`), AND membership in the QHS Engenharia authorized directory (`/authorizedEmails/{email}`) or `/admins/{uid}` (or bootstrapped admin).
2. **PII Isolation Invariant**: Personal employee emails are stored strictly inside `/users/{userId}` and `/authorizedEmails/{emailKey}` where `get` and `list` are restricted exclusively to `isAdmin()` or the owning user (`email == request.auth.token.email`). The `/staffDirectory` collection used in dropdowns contains zero PII.
3. **Negative Stock Governance Invariant**: Normal users cannot create a `SAIDA` movement with `isNegativeStockAuthorized: true` or negative `stockAfterMovement`. Only an Administrator can approve a `PENDENTE` request in `/negativeRequests/{requestId}` and execute the atomic batch write creating the authorized negative stock movement.
4. **Relational & Atomic Stock Consistency Invariant**: Every `StockMovement` must reference an existing `/products/{productId}` document (`exists()`), and the product document must exist after the batch (`existsAfter()`).
5. **Terminal State Locking Invariant**: Once a `NegativeStockRequest` reaches `'APROVADO'` or `'RECUSADO'`, it is locked against further updates.
6. **Temporal Integrity Invariant**: All `createdAt` and `updatedAt` fields must equal `request.time` on creation/update and `createdAt` is immutable on update.
7. **Strict Schema & Size Bounds Invariant**: All collections enforce `hasAll` and `hasOnly` key checks, explicit types, `.size()` bounds on every string/list, and regex checks (`^[a-zA-Z0-9_\-]+$`) on path IDs.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Shadow Field Injection on Product Create**:
   - Payload: `{ id: "p1", orgId: "qhs-engenharia", ..., isApproved: true }`
   - Expected: `PERMISSION_DENIED` (blocked by `keys().hasOnly(...)` in `isValidProduct`).
2. **Unverified Email Spoof Attack**:
   - Auth: `{ email: "welisson.oliveira08@gmail.com", email_verified: false }`
   - Expected: `PERMISSION_DENIED` (blocked by `request.auth.token.email_verified == true`).
3. **PII Blanket Read on `/users`**:
   - Operation: Non-admin executes `getDocs(collection(db, 'users'))` without `where('email', '==', auth.email)`.
   - Expected: `PERMISSION_DENIED` (blocked by `allow list` evaluating `resource.data.email == request.auth.token.email`).
4. **Privilege Escalation on Own User Record**:
   - Operation: Non-admin attempts `updateDoc(doc(db, 'users', myId), { isAdmin: true, permissions: { configuracoes: true } })`.
   - Expected: `PERMISSION_DENIED` (only `isAdmin()` may update `/users`).
5. **Unauthorized Negative Stock Bypass**:
   - Operation: Non-admin creates `/movements/mov-hack` with `{ type: "SAIDA", quantity: 999, stockAfterMovement: -990, isNegativeStockAuthorized: true }`.
   - Expected: `PERMISSION_DENIED` (`isNegativeStockAuthorized == false || isAdmin()` and `stockAfterMovement >= 0 || isAdmin()`).
6. **Non-Admin Self-Approval of Negative Request**:
   - Operation: Non-admin updates `/negativeRequests/req-1` setting `{ status: "APROVADO" }`.
   - Expected: `PERMISSION_DENIED` (only `isAdmin()` can update `/negativeRequests`).
7. **Terminal State Reversal on Negative Request**:
   - Operation: Admin or user attempts to update `/negativeRequests/req-1` where `existing().status == "APROVADO"` back to `"PENDENTE"`.
   - Expected: `PERMISSION_DENIED` (`existing().status == 'PENDENTE'`).
8. **Orphaned Movement Injection**:
   - Operation: User creates `/movements/mov-orphan` referencing `productId: "non-existent-id"`.
   - Expected: `PERMISSION_DENIED` (blocked by `exists(/databases/$(database)/documents/products/$(incoming().productId))`).
9. **Client Timestamp Forgery**:
   - Operation: User creates `/products/p2` with `createdAt: Timestamp.fromDate(new Date('2020-01-01'))`.
   - Expected: `PERMISSION_DENIED` (blocked by `incoming().createdAt == request.time`).
10. **ID Poisoning / 1.5KB Junk ID**:
    - Operation: User attempts `setDoc(doc(db, 'products', 'A'.repeat(1500)), {...})`.
    - Expected: `PERMISSION_DENIED` (blocked by `isValidId(productId)` checking `size() <= 128` and regex).
11. **Value Poisoning / Type Mismatch on Update**:
    - Operation: User updates `/products/p1` with `{ currentStock: "cem", updatedAt: serverTimestamp() }`.
    - Expected: `PERMISSION_DENIED` (blocked by `isValidProduct(incoming())` requiring `currentStock is number`).
12. **DoW 1MB String Exhaustion on Description**:
    - Operation: User creates `/products/p3` with `description: "x".repeat(50000)`.
    - Expected: `PERMISSION_DENIED` (blocked by `data.description.size() <= 1000`).
