# tcgdex-image-intake

A standalone REST service that accepts zipped batches of TCG card images, validates them against provided metadata, renames them into a canonical format, and uploads them into MinIO object storage.

---

## Requirements

- Docker + Docker Compose

That's it. Node.js, MinIO, and all dependencies run inside Docker.

---

## Local setup

```bash
git clone <repo>
cd tcgdex-image-intake
cp .env.example .env
# Fill in your values in .env
docker compose up --build
```

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Port to listen on (default: `4102`) |
| `NODE_ENV` | No | `production` or `development` |
| `API_KEY` | **Yes** | Secret key sent in `x-api-key` header |
| `MAX_UPLOAD_MB` | No | Max zip size in MB (default: `100`) |
| `MINIO_ROOT_USER` | **Yes** | MinIO admin username |
| `MINIO_ROOT_PASSWORD` | **Yes** | MinIO admin password |
| `MINIO_ACCESS_KEY` | **Yes** | Service access key (used by the intake service) |
| `MINIO_SECRET_KEY` | **Yes** | Service secret key (used by the intake service) |
| `MINIO_BUCKET_NAME` | No | Bucket name (default: `tcgdex-images`) |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins — no trailing slashes |

### Example `.env`

```dotenv
API_KEY=your-secret-api-key

MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=changeme-use-a-strong-password

MINIO_ACCESS_KEY=your-access-key
MINIO_SECRET_KEY=your-secret-key
MINIO_BUCKET_NAME=tcgdex-images

ALLOWED_ORIGINS=https://tcgdex.net,http://localhost:3000
```

---

## Docker

The project includes three Docker services:

- **`minio`** — MinIO object storage, data persisted via a named Docker volume
- **`minio-init`** — runs once on first boot to create the bucket and service user
- **`intake`** — the Node.js intake service

### Start

```bash
docker compose up --build
```

### Stop

```bash
docker compose down
```

### Rebuild after code changes

```bash
docker compose down
docker compose up --build
```

### View logs

```bash
docker compose logs -f intake
docker compose logs -f minio
```

### MinIO console

The MinIO web UI is available internally at `http://localhost:9001`.

On the server, access it via SSH tunnel:

```bash
ssh -L 9001:localhost:9001 user@your-server
# then open http://localhost:9001 in your browser
```

Log in with `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD`.

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
- Filenames must contain a number — that number is used as the card number
- Valid examples: `001.png`, `002.jpg`, `Blitzle-12-XY-Trainer-Kit.png`, `Potion-21.webp`
- Optionally include a set symbol/logo named `symbol.png` or `logo.png` (or `.jpg`, `.webp`)
- Allowed formats: `.png`, `.jpg`, `.jpeg`, `.webp`
- No duplicate files for the same card number
- Card image filenames must exactly match the declared `cardNumbers` — no missing, no extras
- The symbol/logo file is optional and does not need to be declared in `cardNumbers`

**Success response `200`**

```json
{
  "success": true,
  "setCode": "SV2A",
  "submissionId": "SV2A-2026-03-21T15-12-44Z-a1b2c3",
  "requestedCardNumbers": ["001", "002", "010"],
  "matchedCount": 3,
  "uploadedFiles": [
    { "cardNumber": "001", "filename": "SV2A-001.png", "objectKey": "SV2A/SV2A-.../SV2A-001.png" },
    { "cardNumber": "002", "filename": "SV2A-002.jpg", "objectKey": "SV2A/SV2A-.../SV2A-002.jpg" },
    { "cardNumber": "010", "filename": "SV2A-010.webp", "objectKey": "SV2A/SV2A-.../SV2A-010.webp" }
  ],
  "symbolFile": {
    "filename": "symbol.png",
    "objectKey": "SV2A/symbol.png"
  },
  "storage": {
    "bucketName": "tcgdex-images",
    "setPrefix": "SV2A",
    "submissionPrefix": "SV2A/SV2A-2026-03-21T15-12-44Z-a1b2c3"
  }
}
```

> `symbolFile` is only present in the response if a symbol or logo file was included in the zip.

**Error responses**

| Status | Meaning |
|---|---|
| `400` | Validation failure — see `error` field for details |
| `401` | Missing or invalid `x-api-key` |
| `429` | Rate limit exceeded (10 requests per 15 minutes per IP) |
| `500` | Internal server error |

---

## Storage structure

```
tcgdex-images/                          ← bucket
  SV2A/
    symbol.png                          ← set symbol (set-level, shared across submissions)
    SV2A-2026-03-21T15-12-44Z-a1b2c3/  ← submission folder
      SV2A-001.png
      SV2A-002.jpg
      SV2A-010.webp
```

The set symbol is stored at the set level and is overwritten if resubmitted. Each card image submission gets its own timestamped folder, preventing accidental overwrites and keeping batches grouped for review.

---

## Deployment

### 1. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
```

### 2. Configure environment

```bash
cp .env.example .env
nano .env  # fill in all required values
```

### 3. Start

```bash
docker compose up -d
```

### 4. Check it's running

```bash
docker compose ps
curl http://localhost:4102/health
```

### 5. Nginx reverse proxy

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

### 6. SSL

```bash
certbot --nginx -d tcgdex-upload.sixbyfive.com
```

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
      storage.service.js    MinIO upload integration
      upload.service.js     Upload orchestration
      zip.service.js        Safe zip extraction + validation
    utils/
      cardNumbers.js        Normalisation and padding
      filenames.js          Zip filename validation + canonical naming
      logger.js             Pino logger
      responses.js          Typed JSON response helpers
      tempDirs.js           Temp path helpers + cleanup
  Dockerfile
  docker-compose.yml
  .env.example
  package.json
```