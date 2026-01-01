<!-- Guidance for frontend developers about the new ban/suspend flow -->

# Frontend Integration Notes – Account Status Controls

## Overview
- Admins can now change a user’s account status to `active`, `suspended`, or `banned`. The account status is persisted alongside an optional `status_reason` and `suspended_until` timestamp (UTC). Suspended or banned users are blocked from logging in or accessing any authenticated routes, even if they still possess a valid token.
- All consumer-facing admin user responses now include `status`, `status_reason`, and `suspended_until` so the UI can display the current state without extra requests.

## API Changes

### `PATCH /admin/users/:id/status`
- **Purpose:** Toggle ban/suspend/reactivate on a specific user.
- **Headers:** Must include session cookie (or bearer token) for an admin user.
- **Request Body (`AdminUpdateUserStatusRequest`):**
  ```json
  {
    "status": "banned" | "suspended" | "active",
    "status_reason": "Opsional catatan untuk audit",
    "suspended_until": "2025-02-01T12:00:00.000Z" // hanya untuk suspend
  }
  ```
- **Responses:**
  - `200` with `UserResponse` (see below) reflecting updated fields.
  - Validation errors if required data is missing or date format invalid.

### Updated User responses
- Admin list (`GET /admin/users`), detail (`GET /admin/users/:id`), creation, update, and download-limit update responses all now return:
  ```ts
  interface UserResponse {
    status: "active" | "suspended" | "banned";
    status_reason: string | null;
    suspended_until: string | null;
    // existing fields (id, name, email, role, etc.)
  }
  ```
- Use these fields to show a badge/alert message and optionally a tooltip explaining why the account is locked.

## Frontend Responsibilities
1. **Admin UI changes**
   - Add controls for selecting the status (active/suspended/banned).
   - Provide inputs for `status_reason` and `suspended_until` when suspending/banning; `suspended_until` should only be sent for suspend operations.
   - Surface validation messages returned by the API (e.g., invalid date).
2. **User listings**
   - Show the current `status` for each user (and reason/date when applicable).
   - Prevent admins from editing `status` for themselves if desired (not enforced on backend yet).
3. **Error handling**
   - If the backend responds with a `403` due to the account being suspended/banned, display an explanatory message using the returned `status_reason` and `suspended_until`.

## Notes
- The backend enforces status checks at the authentication middleware level, so once an account is suspended/banned, any token will be rejected until the status switches back to `active`.
- No frontend validation prevents typing invalid ISO timestamps; rely on the API response for enforcement.

