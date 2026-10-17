# ⛷️ Ski Commute: Colorado Resort Drive-Time Dashboard

Enter your address and see the live drive time, with traffic, to 10 Colorado ski resorts. Resorts are sorted fastest first and shown on a map.

**Stack:** Next.js (React) · Google Maps Routes API · GitHub · Vercel

---

## Contents

1. [How it works](#1-how-it-works)
2. [Run it on your computer (demo mode, no keys needed)](#2-run-it-on-your-computer)
3. [Google Cloud setup (API keys)](#3-google-cloud-setup)
4. [Put the project on GitHub](#4-put-the-project-on-github)
5. [Deploy on Vercel](#5-deploy-on-vercel)
6. [Costs and the free tier](#6-costs-and-the-free-tier)
7. [Customize and troubleshoot](#7-customize-and-troubleshoot)

---

## 1. How it works

### The data flow

```
 ┌──────────────── YOUR BROWSER ────────────────┐
 │  AddressInput.tsx (BROWSER key) ─────────────┼─────► Places API: suggestions as you type
 │  Dashboard.tsx                               │
 │   1. Pick a suggestion (or click the button) │
 │   2. POST /api/commute { address }  ─────────┼──┐
 │                                              │  │
 │   6. Draw the cards and markers  ◄───────────┼──┼── JSON: 10 resorts, sorted
 │  ResortMap.tsx (uses the BROWSER key) ───────┼──┼──► Google Maps JavaScript API
 └──────────────────────────────────────────────┘  │     (map tiles only)
                                                   ▼
 ┌──────────── NEXT.JS SERVER (Vercel) ─────────────────┐
 │  src/app/api/commute/route.ts  (uses the SECRET key) │
 │   3. Geocoding API: address  →  lat/lng              │
 │   4. Routes API computeRouteMatrix:                  │
 │        1 origin × 10 resorts, TRAFFIC_AWARE_OPTIMAL  │
 │   5. Turn seconds into numbers, sort fastest first   │
 └──────────────────────────────────────────────────────┘
```

**Why the server step?** API keys are passwords. Anything that runs in the browser can be read by anyone who opens your site. The browser therefore never talks to the Routes API directly. It calls **your own** endpoint, `/api/commute`. That endpoint runs on Vercel's servers, where the secret key lives in an environment variable.

The map has to load in the browser, so it uses a **second, public key**. That key is locked to your website's URL and to the Maps JavaScript API only, so a copied key is useless anywhere else.

### What the Route Matrix API does

One request asks for travel times from a set of **origins** (here, just your home) to a set of **destinations** (here, the 10 resorts). Each origin→destination pair is one **element**, and Google bills per element. One refresh therefore costs **10 elements**.

The request we send (see [`src/lib/google.ts`](src/lib/google.ts)):

```http
POST https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix
X-Goog-Api-Key: <secret key>
X-Goog-FieldMask: originIndex,destinationIndex,status,condition,distanceMeters,duration,staticDuration

{
  "origins":      [{ "waypoint": { "location": { "latLng": { "latitude": 39.75, "longitude": -105.00 }}}}],
  "destinations": [ ...10 resorts, same shape... ],
  "travelMode": "DRIVE",
  "routingPreference": "TRAFFIC_AWARE_OPTIMAL"
}
```

What comes back is one entry per resort:

```json
[
  { "destinationIndex": 3, "condition": "ROUTE_EXISTS", "distanceMeters": 127140,
    "duration": "6060s", "staticDuration": "4980s" },
  ...
]
```

| Field | Meaning | Shown on the dashboard as |
|---|---|---|
| `duration` | Drive time **with current traffic** | Big number on each card |
| `staticDuration` | Drive time **ignoring traffic** | "Normal 1h 23m" |
| `duration − staticDuration` | Extra time caused by traffic | "+18m Heavy" badge |
| `destinationIndex` | Which resort the entry is for. Entries can arrive in any order. | n/a |

- **Field mask:** This header is required. It tells Google exactly which fields to return. Smaller responses are faster, and some fields cost more.
- **`TRAFFIC_AWARE_OPTIMAL`:** Uses live and historical traffic, the same quality as the Google Maps app. With no `departureTime`, Google assumes "leaving now."

### How the app avoids wasting API calls

- **One request for all 10 resorts**, not 10 separate requests.
- **Nothing runs automatically on a timer.** Google is called only when you submit an address or click **Refresh**. Opening the page also triggers one call, but only when your last results are more than 10 minutes old.
- **The browser remembers your last results** in `localStorage`. Reopening the page within 10 minutes shows them for free.
- **Server cache:** a repeat request for the same address within 2 minutes reuses the previous answer.
- **Refresh cooldown:** after a refresh, the button stays disabled for 30 seconds.
- **The Directions ↗ links** just open Google Maps. They cost nothing.
- **Address suggestions** wait until you've typed 3 characters and paused briefly.

### Where the files are

```
src/
├─ app/
│  ├─ page.tsx               the home page (just renders <Dashboard/>)
│  ├─ layout.tsx             fonts, page title
│  ├─ globals.css            all styling (dark theme + mobile rules at the bottom)
│  └─ api/commute/route.ts   ★ the server endpoint (secret key used here)
├─ components/
│  ├─ Dashboard.tsx          refresh, stats, resort cards (loads Google's script once)
│  ├─ AddressInput.tsx       address box with suggestions as you type
│  └─ ResortMap.tsx          the Google Map + markers
└─ lib/
   ├─ resorts.ts             ★ the 10 resorts (edit this to change them)
   ├─ google.ts              calls Geocoding + Route Matrix (server only)
   ├─ config.ts              reads the public browser key
   ├─ demo.ts                sample data used when no key is set
   ├─ format.ts              "4512s" → "1h 15m", traffic levels
   └─ types.ts               shape of the API response
```

---

## 2. Run it on your computer

You need **Node.js** (already installed: `node -v` shows v24).

```bash
cd ~/Documents/Claude/ski-commute
```

```bash
npm install
```

```bash
npm run dev
```

Open **http://localhost:3000**. With no keys set, you'll see **demo data** (sample times from downtown Denver) and a placeholder where the map goes. That's expected, and it means the app works. Press `Ctrl + C` in the terminal to stop the server.

---

## 3. Google Cloud setup

Allow about 15 minutes. You'll create **two keys**:

| Key | Env variable | Who can see it | Locked to |
|---|---|---|---|
| Server key | `GOOGLE_MAPS_API_KEY` | Only the server | Routes API + Geocoding API |
| Browser key | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Anyone (it's in the page) | Maps JavaScript API + Places API (New) + your URLs |

> In Next.js, anything starting with `NEXT_PUBLIC_` is sent to the browser. Never put the server key in a `NEXT_PUBLIC_` variable.

### 3.1 Create a project and turn on billing

1. Go to **https://console.cloud.google.com** and sign in with a Google account.
2. Use the project picker at the top → **New Project** → name it `ski-commute` → **Create**. Make sure it's selected.
3. Go to the **☰ menu → Billing** and link a billing account by adding a card.
   Google requires this even for free usage. Normal personal use of this app stays inside the free monthly limits (see [section 6](#6-costs-and-the-free-tier)).

### 3.2 Enable the 3 APIs

Go to **☰ → APIs & Services → Library**, then search for and **Enable** each of these:

- ✅ **Routes API** (drive times)
- ✅ **Geocoding API** (address → coordinates)
- ✅ **Maps JavaScript API** (the interactive map)
- ✅ **Places API (New)** (address suggestions as you type). Pick the one labeled **(New)**, not the older "Places API".

### 3.3 Create the server key (secret)

1. **☰ → APIs & Services → Credentials → + Create credentials → API key.** Copy the key.
2. Click the new key to edit it:
   - **Name:** `ski-commute-server`
   - **Application restrictions:** *None*. Vercel's servers don't have fixed addresses, so you can't lock this key to one. Keeping it secret is the protection.
   - **API restrictions:** *Restrict key* → tick **Routes API** and **Geocoding API**.
   - **Save.**

### 3.4 Create the browser key (public, locked down)

1. **+ Create credentials → API key** again, then edit it:
   - **Name:** `ski-commute-browser`
   - **Application restrictions:** *Websites* → add:
     - `http://localhost:3000/*`
     - (after step 5 you'll add your Vercel URL here too)
   - **API restrictions:** *Restrict key* → tick **Maps JavaScript API** and **Places API (New)**.
   - **Save.** Restrictions can take up to 5 minutes to take effect.

### 3.5 Put a cap on spending (strongly recommended)

Anyone who finds your site could press Refresh a lot. These steps put a hard ceiling on what that could cost:

- **☰ → APIs & Services → Routes API → Quotas & System Limits.** Lower the "Compute Route Matrix" limits (for example, elements per minute) to something small, such as `100`.
- **☰ → Billing → Budgets & alerts → Create budget.** Set the amount to **$5** and keep the email alerts at 50/90/100%. A budget **emails** you but does **not** stop charges, which is why the quota cap above matters.

### 3.6 Add the keys to your computer

```bash
cp .env.example .env.local
```

Open `.env.local` and paste in both keys:

```
GOOGLE_MAPS_API_KEY=AIza...server...
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...browser...
```

Restart `npm run dev`. Env files are read only at startup. The demo banner should disappear, and you'll get live times and a map.

`.env.local` is listed in `.gitignore`, so **git will never upload it**.

---

## 4. Put the project on GitHub

GitHub stores your code online, and Vercel deploys straight from it.

### 4.1 One-time setup

1. Create a free account at **https://github.com**.
2. Tell git who you are. Run these once, using your own name and email:

```bash
git config --global user.name "Your Name"
```

```bash
git config --global user.email "you@example.com"
```

3. Install the GitHub CLI, which handles logging in. Download the macOS installer (`.pkg`) from **https://cli.github.com** and run it, or use `brew install gh` if you have Homebrew. Then log in:

```bash
gh auth login
```

Choose **GitHub.com → HTTPS → Login with a web browser**.

### 4.2 Save your first version (a "commit")

From the project folder:

```bash
git init
```

```bash
git add .
```

Check that `.env.local` is **not** in the list this shows. If it is, stop and ask for help.

```bash
git status
```

```bash
git commit -m "First version of ski commute dashboard"
```

### 4.3 Create the GitHub repo and upload

```bash
gh repo create ski-commute --private --source=. --push
```

This creates a private repo at `github.com/<you>/ski-commute` and uploads ("pushes") your code.

### 4.4 The everyday loop after making changes

```bash
git add .
```

```bash
git commit -m "Describe what you changed"
```

```bash
git push
```

Once Vercel is connected, **every push redeploys your site automatically.**

---

## 5. Deploy on Vercel

1. Go to **https://vercel.com** → **Sign up** → **Continue with GitHub** (the free Hobby plan is fine).
2. **Add New… → Project** → find `ski-commute` → **Import**. You may need to click "Adjust GitHub App Permissions" to let Vercel see the repo.
3. Vercel detects Next.js automatically. Before clicking Deploy, open **Environment Variables** and add both:
   - `GOOGLE_MAPS_API_KEY` = your server key
   - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` = your browser key
4. Click **Deploy** and wait about 1 minute. You'll get a URL like `https://ski-commute-abc123.vercel.app`.
5. **Back in Google Cloud**, edit the **browser key** → Website restrictions → add your Vercel URL:
   - `https://ski-commute-abc123.vercel.app/*` (use your real one)
6. Open your Vercel URL on your phone. Done 🎉

> **Changing a key later?** Update it in Vercel → Project → Settings → Environment Variables, then go to **Deployments → ⋯ → Redeploy**. `NEXT_PUBLIC_` values are baked in when the site is built, so a redeploy is required.

---

## 6. Costs and the free tier

Google Maps Platform gives a free monthly allowance **per API**:

| What | Google's billing name | Free per month | This app uses |
|---|---|---|---|
| Drive times (traffic-aware) | Routes: Compute Route Matrix **Pro** | 5,000 elements | 10 per refresh → **~500 refreshes** |
| Address lookup | Geocoding (Essentials) | 10,000 requests | 1 per refresh |
| Interactive map | Dynamic Maps (Essentials) | 10,000 loads | 1 per page open |
| Address suggestions | Autocomplete Session Usage + Place Details Essentials | Unlimited sessions + 10,000 details | 1 per address you pick |

Suggestions use a **session token**. All the keystrokes for one address count as a single session, which is free. Only the final pick counts toward the 10,000-a-month details allowance. The app also waits a quarter-second after you stop typing before asking Google.

Traffic-aware routing is billed as the **Pro** tier. Plain routing without traffic would be cheaper, but it can't show traffic delays, which is the point of this app. A few checks a day stays well within the free tier.

Vercel Hobby and GitHub are free for a project like this.

---

## 7. Customize and troubleshoot

**Change the resorts:** Edit [`src/lib/resorts.ts`](src/lib/resorts.ts). To get coordinates, right-click a spot in Google Maps and click the numbers to copy them. Keep the list at 25 or fewer. Every resort you add costs 1 more element per refresh.

**Common problems:**

| Symptom | Fix |
|---|---|
| Yellow "Demo data" banner | `GOOGLE_MAPS_API_KEY` isn't set. Check `.env.local` (local) or the Vercel env vars, then restart or redeploy. |
| "Geocoding failed (REQUEST_DENIED)" | Geocoding API isn't enabled, or the server key's API restrictions don't include it. |
| "...API has not been used in project..." / "PERMISSION_DENIED" | Routes API isn't enabled, or billing isn't linked. |
| No suggestions appear while typing | Places API (New) isn't enabled, or it isn't ticked on the browser key. The browser console shows "Address suggestions failed". |
| Map is grey with "This page can't load Google Maps correctly" | The browser key is missing Maps JavaScript API, or your URL isn't in its website list. Wait 5 minutes after editing. |
| Map works locally but not on Vercel | Add the `https://<your-app>.vercel.app/*` URL to the browser key's website list. |
| See server errors on Vercel | Vercel → Project → **Logs** |
