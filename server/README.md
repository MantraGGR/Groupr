Groupr backend (local dev)
==========================

This small Express server provides two endpoints used by the extension during development:

- POST /authorize — accepts { accessToken } and checks the Google userinfo endpoint for the email, then checks the allowlist.
- POST /generate — accepts { prompt } and requires Authorization: Bearer <accessToken>. Verifies the user is allowed and calls the Generative Language API using the server-side key.

Setup
-----
1. Copy `.env.example` to `.env` and fill values:

   GENERATIVE_API_KEY=your_generative_api_key_here
   PORT=8080
   ALLOWLIST=alice@example.com,bob@example.com

2. Install and run

   npm install
   npm run start

Local usage
-----------
- Start the server: it will listen on http://localhost:8080 by default.
- In the extension `manifest.JSON` we add `http://localhost:8080/*` to `host_permissions` so the extension can call these endpoints during development.

Notes
-----
- For production you should use a service account or properly scoped service credentials and deploy the server to a secure host (Cloud Run, Cloud Functions, etc.).
- Do NOT commit your production API key to git. Use environment variables or a secret manager.
- In production, prefer verifying a signed ID token (JWT) instead of calling userinfo for performance and security.
