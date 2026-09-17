# Invoice PDF on Vercel (Spark-safe)

Firebase Cloud Functions are **not** used for invoices.

## Flow

Booking completed → generate invoice PDF → upload to Cloudinary (`raw/upload`) → save Cloudinary URL + metadata in Firestore → customer and admin open that URL.

## Endpoints

- `POST /api/invoices/generate` — body `{ bookingId, force?, sendEmail? }`
- `POST /api/invoices/resend-email` — body `{ bookingId?, invoiceId? }` (admin only)
- `GET /api/invoices/file?bookingId=` — authorized redirect to the stored Cloudinary PDF (Firebase ID token)

Auth: `Authorization: Bearer <Firebase ID token>`

Native apps that cannot set headers may pass the same ID token as `access_token` on this GET only. Do not put that token in emails or public pages.

## Vercel env

Required:

- `FIREBASE_SERVICE_ACCOUNT_JSON` — service account JSON (or base64)
- Cloudinary (images + invoice PDFs):
  - `CLOUDINARY_CLOUD_NAME`
  - `CLOUDINARY_API_KEY`
  - `CLOUDINARY_API_SECRET` (server-only)

Unsigned browser image uploads may also use:

- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
- `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`

Also:

- `POST /api/storage/upload` — authenticated Cloudinary image upload
- `GET /api/invoices/file?bookingId=` — after ownership checks, redirects to the Cloudinary PDF URL
- `POST /api/notifications/send` — event-driven push (no cron)
- `POST /api/notifications/process-outbox` — admin retry of failed notification sends only

Optional:

- `RESEND_API_KEY`, `RESEND_FROM_EMAIL` — email PDF attachment (server-only; never `NEXT_PUBLIC_*`)

See also `testing/.env.example` for placeholder names.
