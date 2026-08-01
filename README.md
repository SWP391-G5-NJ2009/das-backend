# DAS Backend

Express API for the DentalCare Dentist Appointment System. The backend is the only layer that talks to Supabase; the React frontend calls this API only.

## Requirements

- Node.js 20.19 or newer
- npm
- A Supabase project with the DAS database schema
- TextBee credentials for OTP and SMS delivery

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

Local development values:

```env
PORT=3000
NODE_ENV=development

SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

JWT_SECRET=replace-with-at-least-32-characters
JWT_EXPIRES_IN=7d

TEXTBEE_DEVICE_ID=your-textbee-device-id
TEXTBEE_API_KEY=your-textbee-api-key

FRONTEND_URL=http://localhost:5173
FRONTEND_URLS=http://localhost:5173
```

Keep `.env` private. `SUPABASE_SERVICE_ROLE_KEY` must never be used in the frontend or committed to Git.

The backend now fails at startup if `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, or a strong `JWT_SECRET` is missing.

## Railway Deployment

Set these variables in Railway, not in a committed file:

```env
NODE_ENV=production
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=use-a-long-random-secret-at-least-32-characters
JWT_EXPIRES_IN=7d
TEXTBEE_DEVICE_ID=your-textbee-device-id
TEXTBEE_API_KEY=your-textbee-api-key
FRONTEND_URL=https://your-frontend-app.com
FRONTEND_URLS=https://your-frontend-app.com
```

Railway should use:

```text
Root Directory: das-backend
Start Command: npm start
```

Do not manually set `PORT` on Railway unless Railway explicitly requires it. The server uses Railway's provided `PORT` automatically.

Deploy order:

1. Deploy the backend to Railway with a temporary `FRONTEND_URL`, such as `http://localhost:5173`.
2. Copy the Railway backend URL.
3. Deploy the frontend to Vercel with `VITE_API_URL=https://your-backend-url/api`.
4. Copy the final Vercel frontend URL.
5. Update Railway `FRONTEND_URL` to the Vercel URL with no trailing slash.
6. Redeploy or restart the Railway backend.

## Run

Development mode:

```bash
npm run dev
```

Production-style start:

```bash
npm start
```

Local API base URL:

```text
http://localhost:3000/api
```

## Health Check

```http
GET /api/health
```

Expected response:

```json
{
  "success": true,
  "data": {
    "status": "ok"
  },
  "message": "Thanh cong"
}
```

## Test Accounts

Patient login:

```text
URL: /login
phone: 0900000002
password: Test12345!
```

Staff login:

```text
URL: /staff/login
password for all staff accounts: Test12345!
```

Staff usernames:

```text
admin
recep
owner
dentist
dentist2
dentist3
```

## Auth Endpoints

Patient login:

```http
POST /api/auth/patient/login
Content-Type: application/json

{
  "phone": "0900000002",
  "password": "Test12345!"
}
```

Staff login:

```http
POST /api/auth/staff/login
Content-Type: application/json

{
  "username": "admin",
  "password": "Test12345!"
}
```

Forgot password:

```http
POST /api/auth/forgot-password
Content-Type: application/json

{
  "identifier": "0900000002"
}
```

Staff forgot password:

```http
POST /api/auth/forgot-password/staff
Content-Type: application/json

{
  "username": "admin"
}
```

In development, forgot-password responses include `data.devOtp`. In production, `devOtp` is omitted.

Reset password:

```http
POST /api/auth/reset-password
Content-Type: application/json

{
  "accountId": "account-id-from-forgot-password",
  "otp": "123456",
  "newPassword": "NewPassword123!"
}
```

Authenticated password change:

```http
PATCH /api/auth/change-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "oldPassword": "Test12345!",
  "newPassword": "NewPassword123!"
}
```

## Database Notes

The backend expects the current DAS schema in Supabase, including these core tables:

- `role`
- `account`
- `patient`
- `dentist`
- `receptionist`
- `manager`
- `admin`
- `otp_tokens`
- `appointment`
- `work_slot`
- `schedule`
- `dental_service`
- `consultation_request`
- `treatment_record`
- `invoice`

Supported role names:

- `patient`
- `receptionist`
- `dentist`
- `manager`
- `admin`

## API Response Format

Success:

```json
{
  "success": true,
  "data": {},
  "message": "OK"
}
```

Error:

```json
{
  "success": false,
  "data": null,
  "message": "Invalid credentials.",
  "code": "INVALID_CREDENTIALS",
  "details": null
}
```

## Useful Commands

Check that the app can load:

```bash
node -e "require('./src/app'); console.log('backend app loaded')"
```

Run lint:

```bash
npm run lint
```

Note: lint currently requires an `eslint.config.js` file because this project uses ESLint 10.

## Troubleshooting

- If the server fails on startup, check `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `JWT_SECRET`.
- If browser requests are blocked by CORS, check that Railway `FRONTEND_URL` exactly matches the Vercel origin and has no trailing slash. For multiple frontend origins, set `FRONTEND_URLS` as a comma-separated list.
- If login returns `INVALID_CREDENTIALS`, confirm the account has a valid bcrypt `password_hash`.
- If forgot password returns `TEXTBEE_NOT_CONFIGURED`, confirm `TEXTBEE_DEVICE_ID` and `TEXTBEE_API_KEY`.
- If TextBee does not deliver SMS, confirm your TextBee device is online and the phone number can receive SMS.
- `SUPABASE_URL` should normally be `https://your-project-ref.supabase.co`; do not include `/rest/v1`.
