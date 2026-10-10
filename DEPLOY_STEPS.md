# LizExpress — deploy, step by step (Phase 1 + Phase 2)

Do these in order. Each step says how to check it worked before moving on.

---

## Step 1 — Back up the database

Supabase → **Database → Backups** → confirm a backup from today exists, or take one.

Nothing in this release deletes data, but you have live users. Back up first, always.

---

## Step 2 — Check the KYC bucket ⚠

Supabase → **Storage** → open the bucket named in `SUPABASE_STORAGE_BUCKET` (usually `lizexpress`).

- **If it says "Public"** → identity documents and selfies are readable by anyone with the link. Tell me and I'll move KYC to a private bucket before you go further.
- **If it says "Private"** → you're fine. Continue.

---

## Step 3 — Push the code

Extract the zip **over your local copy** of the repo (overwrite when asked), then:

```bash
git add -A
git commit -m "Advertising, onboarding, dashboard redesign, auth and chat fixes"
git push
```

Vercel will deploy both projects automatically.

---

## Step 4 — Run migration 1

> If you already tried an earlier copy and saw `must be owner of table users`:
> nothing was applied (the migration rolls back on any error). Use the files
> from this zip and run it again.



Supabase → **SQL Editor** → **New query** → paste all of
`Backend/migrations/0001_advertising_and_onboarding.sql` → **Run**.

**Check it worked:**

```sql
select count(*) as states from public.ng_states;               -- expect 37
select count(*) filter (where onboarding_completed) as existing_users_kept,
       count(*) as total_users
  from public.users;                                           -- both numbers equal
```

The second query proves every existing user was grandfathered — nobody will see an onboarding screen they didn't ask for.

---

## Step 5 — Run migration 2 (admin account)

New query → paste all of `Backend/migrations/0002_seed_admin.sql` → **Run**.

**Check it worked:**

```sql
select u.email, p.role
  from auth.users u join public.users p on p.id = u.id
 where u.email = 'lizexpressorg@gmail.com';                    -- expect super_admin
```

---

## Step 5b — Run migration 3 (the 774 LGAs)

New query → paste all of `Backend/migrations/0003_seed_ng_lgas.sql` → **Run**.

**Check it worked:**

```sql
select count(*) from public.ng_lgas;                           -- expect 774
```

Once this is loaded, the advert form shows a dropdown of local governments for
each state instead of a text box. All three migrations were run twice against a
real Postgres engine before packaging; re-running them is safe.

---

## Step 5c — Run migration 4 (engagement)

New query → paste all of `Backend/migrations/0004_engagement.sql` → **Run**.

This adds likes, saves, comments, shares and the activity log behind
**Admin → Engagement**. It only adds new tables and columns, so existing data is
untouched, and it is safe to run again.

**Check it worked:**

```sql
select count(*) from public.reactions;                          -- expect 0 (new table)
select kind, total, people
  from public.engagement_summary(now() - interval '30 days');   -- runs without error
```

From now on, new chats about items are counted as engagement automatically, and
chats that already exist are counted on each item.

---

## Step 5d — Run migration 5 (advert payments + photo bucket)

New query → paste all of `Backend/migrations/0005_advert_payments_fix.sql` → **Run**.

Fixes "Something went wrong on our end" when paying for an advert: the old
payments table required every payment to belong to an item.

**Check it worked:**

```sql
select column_name, is_nullable from information_schema.columns
 where table_name = 'payments' and column_name = 'item_id';   -- expect YES
```

Then in **Vercel → Backend → Environment Variables**, add:

```
SUPABASE_PUBLIC_BUCKET      = items
SUPABASE_AVATAR_BUCKET      = avatars
SUPABASE_LEGACY_KYC_BUCKET  = verification
```

and redeploy the backend. These match the buckets in your project and are also
the defaults, so the code works even before you add them:

| Bucket | Should be | Holds |
|---|---|---|
| `items` | Public | Item and advert photos |
| `avatars` | Public | Profile pictures |
| `lizexpress` | **Private** | New identity documents |
| `verification` | **Private** | Identity documents from before the upgrade |

Keep `lizexpress` and `verification` private. Admins still see every ID
document through short-lived links, old and new.

---

## Step 5e — Run migration 6 (payments accept adverts)

New query → paste all of `Backend/migrations/0006_payments_accept_adverts.sql` → **Run**.

0005 relaxed the item columns we knew about. The original payments table can
have other required columns or rules that block advert payments. This finds
and relaxes all of them, and lists each change in the results panel.

**Then check it:** paste `Backend/migrations/TEST_advert_payment.sql` → **Run**.
It always ends with a red box, and never saves anything:

- **"TEST PASSED …"** — the database accepts advert payments.
- **Anything else** — that is the exact reason checkout fails. Send it over.

## Step 5f — Run migration 7 (advert approval + repair stuck adverts)

New query → paste all of `Backend/migrations/0007_advert_review_and_repair.sql` → **Run**.

It does three things:

1. Adds the advert status **"Awaiting approval"**.
2. Turns approval **on**: a paid advert waits in Admin → Adverts → **Needs approval**
   until an admin taps **Approve and publish**. To publish adverts the moment
   they are paid instead, turn on *Publish adverts as soon as they are paid* in
   Admin → Settings.
3. Repairs adverts that were paid for but never switched on (the ones showing
   "Archived", "Unpaid" and Paid ₦0). They move to Needs approval with the right
   amount and their photos marked paid.

The results panel lists every paid advert and where it stands now. Re-running is safe.

> The app also repairs these by itself: opening Admin → Adverts (or the
> advertiser opening My adverts) applies any successful payment that was not
> applied yet, and sends the receipt the customer never got.

## Step 5g — Fix the Flutterwave webhook

Flutterwave's "Unsuccessful Webhook Delivery" emails mean it could not deliver
payment confirmations. Without them, a bank transfer that arrives after the
customer leaves the payment page never completes.

1. After pushing this release, open
   `https://api.lizexpressltd.com/api/v1/payments/webhook` in a browser.
   You should see *"LizExpress payment webhook is reachable"*.
2. Flutterwave dashboard → **Settings → Webhooks**:
   - **URL:** `https://api.lizexpressltd.com/api/v1/payments/webhook` (exactly this, no trailing slash)
   - **Secret hash:** any long random text you choose
   - Tick **Receive webhook response in JSON format** and **Enable webhook retries**
   - **Save**
3. Vercel → backend project → Settings → Environment Variables:
   `FLUTTERWAVE_WEBHOOK_HASH` = the same secret hash → **Redeploy**.
4. Back in Flutterwave, use **Test webhook** if it is shown. It should succeed.

The server now answers Flutterwave with 200 and checks every payment directly
with Flutterwave's API before acting on it, so a wrong or missing hash no
longer makes the URL look "down". Set the hash anyway; it is logged when it
does not match.

## Step 5h — Adverts end after a month (renewal)

Each advert runs **30 days**. When the month is up it disappears from the
adverts page straight away, moves to **My adverts → Ended**, and the owner gets
an email with a **Renew my advert** button. Paying again (₦1,000 per photo)
puts it back up for another 30 days, without another review.

The daily check runs through Vercel Cron. In Vercel → backend project →
Settings → Environment Variables, add `CRON_SECRET` = any long random text,
then redeploy. (Ended adverts are hidden even without it; the cron is what sends
the "has ended" email on time.)

---

## Step 6 — Add the admin subdomain

**Vercel → Frontend project → Settings → Domains → Add** `admin.lizexpressltd.com`.
Vercel shows you a CNAME record — add it at your domain registrar.

**Vercel → Backend project → Settings → Environment Variables**, update:

```
ADMIN_URL    = https://admin.lizexpressltd.com
CORS_ORIGINS = https://lizexpressltd.com,https://www.lizexpressltd.com,https://admin.lizexpressltd.com
```

Then **Deployments → ⋯ → Redeploy** on the backend so it picks them up.

**Check it worked:** open `https://admin.lizexpressltd.com` → you land on the admin sign-in.
Open `https://lizexpressltd.com/admin` → it sends you to the admin subdomain.

---

## Step 7 — Sign in as admin and change the password

Sign in at `admin.lizexpressltd.com` with:

```
lizexpressorg@gmail.com
LizExpress@2026
```

**Change the password immediately.** It's written in the migration file, which is now in your git history.

---

## Step 8 — Test the auth fixes with real accounts

These are what users were complaining about. Test each one with an **older** account (one that's been around a while — those were the ones affected):

| Test | Expected |
|---|---|
| Forgot password → enter an old user's email | Code arrives within a minute |
| Enter the code → set new password → sign in | Works |
| Tap "Send code" twice quickly | No error; second tap is ignored gracefully |
| Sign in with a wrong password 3 times, then correct | Correct one works |
| Sign up a brand-new account | Code arrives, verify works, lands on dashboard |

If any of these fail, send me the exact error message shown on screen.

---

## Step 8b — Test advertising end to end

| Test | Expected |
|---|---|
| New account → verify email | Lands on "How will you use LizExpress?" |
| Old account → sign in | Goes straight to dashboard, no onboarding |
| Create advert → add 2 photos | Shows `2 × ₦1,000 = ₦2,000` |
| Pay with a Flutterwave test card or bank transfer | "Payment received. Your advert will appear on the adverts page shortly…" and a receipt email |
| Admins | "Advert waiting for approval" email and notification |
| Admin → Adverts → Needs approval → Approve and publish | Status Live, Paid shows the amount, Expires is 30 days out; owner gets "Your advert is live" email |
| Open `/adverts`, pick the state and LGA | Your advert appears |
| Admin → another paid advert → write a reason → Reject | Owner gets "needs changes" email with the reason |
| Tap "Show phone number" | Number shows; the advert's contact count goes up |
| Admin → Adverts → Review → Suspend with a reason | Advert disappears from `/adverts`; owner gets a notification |

## Step 8c — Test engagement

| Test | Expected |
|---|---|
| Open any item or advert, tap the heart | Turns red, count goes up; tap again to undo |
| Tap the bookmark | Turns purple; an item then appears in Saved items |
| Write a comment, then reply as the owner from the owner's account | Reply shows an "Owner" tag; the owner gets a notification |
| Tap share | Phone share sheet opens (or "Link copied" on desktop); share count goes up |
| Admin → Engagement | Numbers, daily chart, top adverts/items, top vendors, latest comments |
| Admin → Engagement → Hide a comment | Disappears from the public page; Restore brings it back |

The owner's own likes and replies are never counted as customer engagement.

## Step 8d — Test chat

| Test | Expected |
|---|---|
| Open a chat on two phones, send messages both ways | Arrive instantly |
| Lock phone A, send from phone B, unlock A | Missed messages appear without refreshing |
| Turn on airplane mode, send, turn it off | Red "Not sent. Tap to retry"; tapping sends it once |
| Tap a new-message notification or email link | Opens the conversation (was a 404 before) |

---

## Step 9 — Send the launch email

Now that the advert screens are live, the email's buttons work. When you're ready:

```bash
cd Backend
node scripts/broadcast-advert-launch.mjs --dry-run              # preview, sends nothing
node scripts/broadcast-advert-launch.mjs --to yourname@gmail.com # one real test
node scripts/broadcast-advert-launch.mjs --confirm              # everyone
```

It needs your real `.env` (Supabase + Resend keys). If it stops halfway, run the same command again — it remembers who already got it and won't double-send.

---

## What changed in this release

**Fixed — sign in, sign up, forgot password**
- Account lookup only ever saw the first 200 users. Everyone after that couldn't reset their password or verify their email. Now uses an indexed database lookup.
- Rate limits counted by IP address, and Nigerian mobile networks share IPs between thousands of users — so one person's typos locked out strangers. Now counted per account.
- A failed email send left a "please wait 60 seconds" lock on a code nobody received. Now cleared on failure.
- Old accounts with no profile row landed on a blank dashboard after signing in. Now repaired automatically on sign-in.

**New — advertising (backend complete)**
- 15 API endpoints under `/api/v1/adverts`: create, upload photos, ₦1,000 per photo checkout, location search by state / LGA / city, admin moderation.
- Payments reuse your existing Flutterwave setup. Photo price is editable from the database (`platform_settings`), no redeploy needed.

**New — onboarding**
- Users can choose **swapping**, **advertising**, or **both**. Stored on the account; endpoint `POST /api/v1/auth/onboarding`.

**New — admin**
- Admin seeded by migration, no registration anywhere.
- Admin console only on `admin.lizexpressltd.com`.
- Users can no longer change their own role, even by calling the database directly.

**New — look and feel**
- Archivo + IBM Plex Mono + Material Symbols across the site and in every email.
- Maximum font weight is now 600 everywhere — headings stop looking heavy.
- All existing pages keep working; the old colour and spacing classes are kept as aliases until each page is redesigned.
- New `<Icon>` and `<Image>` components. `<Image>` stops photo grids jumping around while loading and serves resized photos instead of full 4MB phone uploads.

**New in Phase 2 — screens**
- Browse adverts by state, LGA and city at `/adverts`, with search, categories and shareable links.
- Advert detail page with photo gallery, one-tap phone reveal and WhatsApp.
- Advert editor: details → photos (shrunk on the phone before upload) → pay and publish.
- My adverts, the onboarding picker (swap, advertise or both), and a redesigned dashboard shaped by that choice.
- Admin → Adverts: counts, search, review window, suspend with reason, restore, archive.
- All 774 LGAs, verified against official per-state counts (migration 0003).

**Fixed — chat**
- Messages sent while a phone was locked or offline never appeared until a full reload. The thread now re-syncs when the app comes back or the network returns.
- A slow notification or push step after saving made the sender see "Not sent" for a delivered message, so they sent it again and the other person got duplicates. Sending now succeeds as soon as the message is saved.
- A failed message lost its text. It now stays, in red, and is tap-to-retry.
- Unread counts dropped to zero for messages nobody had seen (marked read while the tab was in the background). Now marked read only when visible.
- "Typing…" could stick forever. It now clears itself.
- Notification and email links to chats pointed to a page that does not exist.
- The unread badge query broke for users with hundreds of conversations; it is now one query.

**Verified before packaging**
- Backend boots with all 102 routes mounted.
- Frontend production build passes.
- Every email template renders.
- All three migrations run twice against a real Postgres engine: existing users kept and grandfathered, admin can sign in, 774 LGAs loaded.
- 19 screens opened in a real browser at desktop and phone sizes with zero errors.

---

## What is left

Nothing from the original brief is outstanding. Three things worth doing after launch:

1. Turn on a nightly job in Supabase (Database → Cron) running `select public.expire_lapsed_adverts();` so adverts expire on time.
2. Move KYC documents to a private storage bucket if Step 2 showed the bucket is public.
3. Flutterwave → Settings → Webhooks: set the URL to `https://api.lizexpressltd.com/api/v1/payments/webhook`
   and the secret hash to the same value as `FLUTTERWAVE_WEBHOOK_HASH` in Vercel. Bank transfers often land
   after the customer has left the payment page; the webhook is what completes those.
