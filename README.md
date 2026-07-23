# DAS Backend Setup

Express API for the DentalCare Dentist Appointment System. The backend is the only layer that talks to Supabase; the React app calls this API only.

## Requirements

- Node.js 18 or newer
- npm
- A Supabase project with the DAS tables

## Install

```bash
cd das-backend
npm install
```

## Environment

Create a local `.env` file from the example:

```bash
copy .env.example .env
```

Configure these values:

```env
PORT=3000
NODE_ENV=development

SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

JWT_SECRET=replace-with-at-least-32-characters
JWT_EXPIRES_IN=7d

TEXTBEE_DEVICE_ID=your-textbee-device-id
TEXTBEE_API_KEY=your-textbee-api-key

FRONTEND_URL=http://localhost:5173
```

Keep `.env` private. The service role key must never be used in the frontend.

## Database Notes

The backend expects the current DAS schema in Supabase, including:

- `role`
- `account`
- `patient`
- `dentist`
- `receptionist`
- `manager`
- `otp_tokens`

Phase 2 auth also expects these account fields:

- `account.username`
- `account.password_hash`
- `account.status`
- `account.role_id`

Current role names supported by the API:

- `patient`
- `receptionist`
- `dentist`
- `manager`
- `admin`

Forgot password OTP is stored in `otp_tokens` and sent by TextBee SMS. SpeedSMS is intentionally not integrated yet. In development, the forgot-password endpoint also returns `devOtp` for testing.

Staff forgot password looks up accounts by `account.username` case-insensitively, then sends the OTP to that specific row's `account.phone`. Supabase enforces case-insensitive username uniqueness with `account_username_ci_unique` on `lower(username)`.

## Run

Development mode:

```bash
npm run dev
```

Production-style start:

```bash
npm start
```

The API runs on:

```text
http://localhost:3000/api
```

## Health Check

```http
GET http://localhost:3000/api/health
```

Expected response:

```json
{
  "success": true,
  "data": {
    "status": "ok"
  },
  "message": "OK"
}
```

## Auth Endpoints

Patient login:

```http
POST /api/auth/patient/login
Content-Type: application/json

{
  "phone": "0901000001",
  "password": "Test12345"
}
```

Staff login:

```http
POST /api/auth/staff/login
Content-Type: application/json

{
  "username": "admin",
  "password": "Admin12345"
}
```

Forgot password:

```http
POST /api/auth/forgot-password
Content-Type: application/json

{
  "identifier": "0901000001"
}
```

In development, this request sends the OTP through TextBee and also returns the OTP in `data.devOtp`. In production, `devOtp` is omitted.

Staff forgot password:

```http
POST /api/auth/forgot-password/staff
Content-Type: application/json

{
  "username": "admin"
}
```

Both forgot-password endpoints return `data.accountId`; send that value to OTP verification and password reset.

Reset password:

```http
POST /api/auth/reset-password
Content-Type: application/json

{
  "accountId": "account-id-from-forgot-password",
  "otp": "123456",
  "newPassword": "NewPassword123"
}
```

Authenticated password change:

```http
PATCH /api/auth/change-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "oldPassword": "OldPassword123",
  "newPassword": "NewPassword123"
}
```

## Current Test Accounts

Admin account:

```text
username: admin
password: Admin12345
```

Patient account used during smoke testing:

```text
phone: 0901000001
password: Test12345
```

Other staff accounts may exist in Supabase, but they need a real `password_hash` value before login will work reliably.

## API Response Format

All responses use the same envelope:

```json
{
  "success": true,
  "data": {},
  "message": "OK"
}
```

Errors:

```json
{
  "success": false,
  "data": null,
  "message": "Invalid credentials.",
  "code": "INVALID_CREDENTIALS"
}
```

## Useful Commands

Lint:

```bash
npm run lint
```

Check that the app can load:

```bash
node -e "require('./src/app'); console.log('backend app loaded')"
```

## Troubleshooting

- If login returns `INVALID_CREDENTIALS`, confirm the account has a valid bcrypt `password_hash`.
- If forgot password returns `TEXTBEE_NOT_CONFIGURED`, confirm `TEXTBEE_DEVICE_ID` and `TEXTBEE_API_KEY`.
- If TextBee does not deliver SMS, confirm your TextBee device is online and the phone number can receive SMS.
- If Supabase requests fail, check `SUPABASE_URL` and the service role key.
- `SUPABASE_URL` should normally be `https://your-project-ref.supabase.co`; do not include `/rest/v1`.
