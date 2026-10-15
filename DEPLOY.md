# Deploying to Railway

One container runs **everything**: the Next app (UI + `/api/cal-hook` + `/api/crm-hook`),
the **WhatsApp worker**, and the **Telegram worker**. They share a `/data` volume for
sessions + group stores.

## 1. Create the service
1. Railway → **New Project → Deploy from GitHub repo** (this repo). It auto-detects the `Dockerfile`.
2. **Add a Volume** → mount path **`/data`** (this is where sessions + `*-store.json` live; the Dockerfile already points the workers at it).
3. After the first deploy, open **Settings → Networking → Generate Domain** to get the public URL.

## 2. Set environment variables
Copy these from your local `.env.local` (Railway → Variables). The `/data` paths are
already set in the Dockerfile — don't add them.

```
# CRM
CRM_API_URL=https://sales.apptics.org
CRM_API_KEY=...
CRM_LEAD_LIMIT=200
CRM_WEBHOOK_SECRET=          # optional, for /api/crm-hook

# Apptics Pay
APPTICS_EXPORT_URL=...
APPTICS_EXPORT_API_KEY=...

# Facebook ads (use a LONG-LIVED System User token — the Explorer one expires)
META_ACCESS_TOKEN=...
META_AD_ACCOUNT_ID=act_728849906940968
META_API_VERSION=v21.0

# Telegram app credentials (my.telegram.org → API development tools).
# The account itself is linked by QR from the dashboard (step 3).
TELEGRAM_API_ID=...
TELEGRAM_API_HASH=...

# Cal.com webhook (set after you create the webhook in step 4)
CAL_WEBHOOK_SECRET=
```

## 3. Link WhatsApp + Telegram (one time)
Open the dashboard → **Bots → Sales Bot Accounts**. Each panel shows a live QR:
- **WhatsApp:** on the Apptics number → Settings → **Linked Devices → Link a Device** → scan.
- **Telegram:** on the phone → Settings → **Devices → Link Desktop Device** → scan. If the
  account has a 2FA cloud password, the panel asks for it after the scan.

Sessions persist on the `/data` volume (`.wwebjs-auth/`, `telegram-session.txt`), so this is
once. **Re-link with new number** on either panel logs out the current account and shows a
fresh QR.

(Without `SALES_BOT_URL`/`SALES_BOT_API_KEY` the page drives the workers in this container;
with them it proxies to the external apptics-whatsapp sales bot instead.)

## 4. Point Cal.com at the app
Cal.com → **Settings → Developer → Webhooks → New**:
- **Subscriber URL:** `https://<your-railway-domain>/api/cal-hook`
- **Trigger:** `Booking Created`
- **Secret:** set one, and put the same value in `CAL_WEBHOOK_SECRET`.

(Optional CRM real-time: register `https://<domain>/api/crm-hook` with the Apptics Sales CRM,
put its returned secret in `CRM_WEBHOOK_SECRET`.)

## 5. Republish the Framer form
Publish the updated pre-qual form (it now forwards `utm_content`, `fb_ad_id`, and `device`
into Cal.com metadata). After this, the full chain is live:

```
tagged ad → lander/form → Cal.com → /api/cal-hook → lead gets its ad + device
WhatsApp/Telegram groups → workers → live conversations on each customer
```

## 6. Verify
- Open the domain → dashboard loads with live data.
- `GET https://<domain>/api/cal-hook` → `{ ok: true, capturedEntries: N }`.
- Integrations page → CRM / Telegram / Apptics Pay **Live**; WhatsApp **Live** after the scan.
- Book a test call from a tagged ad → that lead shows the ad + device; `/ads` CPL fills in.

## Notes
- **Resources:** give the service ~1–2 GB RAM (Chromium is hungry).
- Everything's behind `/data` — back that volume up if you want session durability across redeploys.
