# Invoice PDF on Vercel (Spark-safe)

Firebase Cloud Functions are **not** used for invoices.

## Endpoints

- `POST /api/invoices/generate` — body `{ bookingId, force?, sendEmail? }`
- `POST /api/invoices/resend-email` — body `{ bookingId?, invoiceId? }` (admin only)
- `GET /api/invoices/file?bookingId=` — authorized PDF download (Firebase ID token)

Auth: `Authorization: Bearer <Firebase ID token>`

Native apps that cannot set headers may pass the same ID token as `access_token` on this GET only. Do not put that token in emails or public pages.

## Vercel env

Required:

- `FIREBASE_SERVICE_ACCOUNT_JSON` — service account JSON (or base64)
- Cloudinary (images):
  - `CLOUDINARY_CLOUD_NAME`
  - `CLOUDINARY_API_KEY`
  - `CLOUDINARY_API_SECRET`
- Google Drive (invoice PDFs, server-only):
  - `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON`
  - `GOOGLE_DRIVE_INVOICES_FOLDER_ID`

Also:

- `POST /api/storage/upload` — authenticated Cloudinary image upload
- `GET /api/invoices/file?bookingId=` — streams a private Drive PDF after ownership checks

Optional:

- `RESEND_API_KEY`, `RESEND_FROM_EMAIL` — email PDF attachment (server-only; never `NEXT_PUBLIC_*`)

See also `testing/.env.example` for placeholder names.
