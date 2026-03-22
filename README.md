# tcgdex-image-intake

A standalone REST service that accepts zipped batches of TCG card images, validates them against provided metadata, renames them into a canonical format, and uploads them into Google Drive.

---

## Requirements

- Node.js 18+
- PM2 (`npm install -g pm2`)
- A Google Cloud service account with Drive API access
- A Google Drive folder shared with the service account

---

## Local setup

```bash
git clone <repo>
cd tcgdex-image-intake
npm install
cp .env.example .env
# Fill in your values in .env
npm run dev
```

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Port to listen on (default: `4102`) |
| `NODE_ENV` | No | `production` or `development` |
| `API_KEY` | **Yes** | Secret key sent in `x-api-key` header |
| `MAX_UPLOAD_MB` | No | Max zip size in MB (default: `100`) |
| `TEMP_UPLOAD_DIR` | No | Temp path for uploaded zips |
| `TEMP_EXTRACT_DIR` | No | Temp path for extracted files |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | **Yes** | Service account email |
| `GOOGLE_PRIVATE_KEY` | **Yes** | Service account private key (with literal `\n`) |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | **Yes** | ID of the root Drive folder |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins |

---

## Google Drive setup

1. Create a Google Cloud project
2. Enable the **Google Drive API**
3. Create a **service account**
4. Download the JSON key — copy the `client_email` and `private_key` values into your `.env`
5. Share your target Drive folder with the service account email (Editor access)
6. Copy the folder ID from the Drive URL into `GOOGLE_DRIVE_ROOT_FOLDER_ID`

The folder ID is the long string at the end of the Drive URL:
```
https://drive.google.com/drive/folders/<FOLDER_ID_HERE>
```

---

## API

### `GET /health`

Returns service status.

```json
{ "ok": true, "service": "tcgdex-image-intake" }
```

---

### `POST /api/uploads/card-images`

Upload a zip of card images.

**Headers**

```
x-api-key: your-secret-api-key
Content-Type: multipart/form-data
```

**Fields**

| Field | Type | Required | Description |
|---|---|---|---|
| `setCode` | string | Yes | Set code e.g. `SV2A` (case-insensitive) |
| `cardNumbers` | string | Yes | Comma-separated card numbers e.g. `1,2,10` or `001,002,010` |
| `zipFile` | file | Yes | A `.zip` file containing the images |

**Zip file rules**
- Files must be at the **root level** of the zip — no subfolders
- Card image filenames must be **numeric only** e.g. `001.png`, `002.jpg`, `010.webp`
- Optionally include a set symbol/logo named `symbol.png` (or `.jpg`, `.webp`)
- Allowed formats: `.png`, `.jpg`, `.jpeg`, `.webp`
- No duplicate files for the same card number
- Card image filenames must exactly match the declared `cardNumbers` — no missing, no extras
- The symbol file is optional and does not need to be declared in `cardNumbers`

**Success response `200`**

```json
{
  "success": true,
  "setCode": "SV2A",
  "submissionId": "SV2A-2026-03-21T15-12-44Z-a1b2c3",
  "requestedCardNumbers": ["001", "002", "010"],
  "matchedCount": 3,
  "uploadedFiles": [
    { "cardNumber": "001", "filename": "SV2A-001.png", "fileId": "..." },
    { "cardNumber": "002", "filename": "SV2A-002.jpg", "fileId": "..." },
    { "cardNumber": "010", "filename": "SV2A-010.webp", "fileId": "..." }
  ],
  "symbolFile": {
    "filename": "symbol.png",
    "fileId": "..."
  },
  "drive": {
    "setFolderId": "...",
    "submissionFolderId": "..."
  }
}
```

> `symbolFile` is only present in the response if a symbol file was included in the zip.

**Error responses**

| Status | Meaning |
|---|---|
| `400` | Validation failure — see `error` field for details |
| `401` | Missing or invalid `x-api-key` |
| `429` | Rate limit exceeded (10 requests per 15 minutes per IP) |
| `500` | Internal server error |

---

## Google Drive folder structure

```
<Drive Root>/
  SV2A/
    symbol.png
    SV2A-2026-03-21T15-12-44Z-a1b2c3/
      SV2A-001.png
      SV2A-002.jpg
      SV2A-010.webp
```

The set symbol is uploaded directly into the set folder and is shared across all submissions for that set. Each submission gets its own timestamped folder underneath, preventing accidental overwrites and keeping each batch grouped for review.

---

## Deployment

### 1. Create log directory

```bash
sudo mkdir -p /var/log/tcgdex-image-intake
sudo chown $USER:$USER /var/log/tcgdex-image-intake
```

### 2. Create temp directories

```bash
sudo mkdir -p /var/www/tcgdex-image-intake/tmp/{uploads,extracted}
sudo chown $USER:$USER /var/www/tcgdex-image-intake/tmp
```

### 3. Configure environment

```bash
cp .env.example .env
nano .env  # fill in all required values
```

### 4. Install dependencies

```bash
npm install --omit=dev
```

### 5. Start with PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # follow the printed instructions to auto-start on boot
```

### 6. Check it's running

```bash
pm2 status
curl http://localhost:4102/health
```

---

## Nginx reverse proxy

```nginx
server {
    listen 80;
    server_name tcgdex-upload.sixbyfive.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name tcgdex-upload.sixbyfive.com;

    # SSL config here (certbot / Let's Encrypt)

    client_max_body_size 110M;

    location / {
        proxy_pass http://localhost:4102;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
```

> Set `client_max_body_size` slightly above `MAX_UPLOAD_MB` so Nginx doesn't reject before Express can give a clean error.

---

## curl example

```bash
curl -X POST https://tcgdex-upload.sixbyfive.com/api/uploads/card-images \
  -H "x-api-key: your-secret-api-key" \
  -F "setCode=SV2A" \
  -F "cardNumbers=1,2,10" \
  -F "zipFile=@/path/to/cards.zip"
```

---

## PM2 commands

```bash
pm2 status                          # check process status
pm2 logs tcgdex-image-intake        # tail logs
pm2 restart tcgdex-image-intake     # restart after config change
pm2 stop tcgdex-image-intake        # stop the service
pm2 flush                           # clear all log files
```

---

## PM2 log rotation

PM2 logs are unbounded by default and will grow indefinitely. Install log rotation before deploying:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 5
pm2 set pm2-logrotate:compress true
```

---

## Project structure

```
tcgdex-image-intake/
  src/
    app.js                  Express app (middleware, routes)
    server.js               Startup, config validation, listen
    config/
      env.js                Environment variable loader
    routes/
      health.routes.js
      uploads.routes.js
    controllers/
      health.controller.js
      uploads.controller.js
    middleware/
      auth.middleware.js    x-api-key enforcement
      error.middleware.js   Global error handler
      rateLimit.middleware.js
      upload.middleware.js  Multer zip-only config
    services/
      drive.service.js      Google Drive API integration
      upload.service.js     Upload orchestration
      zip.service.js        Safe zip extraction + validation
    utils/
      cardNumbers.js        Normalisation and padding
      filenames.js          Zip filename validation + canonical naming
      logger.js             Pino logger
      responses.js          Typed JSON response helpers
      tempDirs.js           Temp path helpers + cleanup
  tmp/                      Local dev temp files (gitignored)
  ecosystem.config.js       PM2 config
  .env.example
  package.json
```