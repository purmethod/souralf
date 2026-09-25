# ÂLF — souralf.com

A living German sourdough culture. One product: **THE ÂLF BOX**. One action: **ADOPT ÂLF**.

## Stack

- Plain HTML, CSS and JavaScript. No framework, no build step, no dependencies, no webfonts.
- Visual reference: edocheesecake.com (white, monospace headlines, black scrolling band, beige rounded buttons, floating pill).
- Hosted on **Vercel** as a static site (`vercel.json`: clean URLs, cache and security headers).

## Structure

```
index.html          home: hero → band → ÂLF video / dough / risen / bread → quote → box → footer
box.html            product page (/box): box photo, $59, quantity, embedded Stripe checkout
thanks.html         after payment (/thanks)
api/checkout.js     Vercel function: creates the embedded Checkout Session (price set here)
api/session-status.js  Vercel function: status for the thank-you page
styles.css          design system (white / ink / beige, system mono + sans, mobile first)
app.js              reveals, floating adopt button, video, quantity
404.html            not-found page
assets/og.jpg       1200×630 share image
assets/icon.svg     favicon
scripts/check.mjs   pre-push check (syntax, links, sizes, brand spelling)
```

## Images

`assets/photos/` holds Paul's **real photographs** (dough → risen → bread), graded only:
white balance, tone, contrast, crop to 4:5, light grain. Nothing generated, nothing added.
Each file stays around 300 KB (720 px and 1080 px versions, served via `srcset`).
No generated or AI imagery. Never.

## Local

```bash
python3 -m http.server 8000     # any static server
node scripts/check.mjs          # run before every push
```

## Brand rule

The name is always written **ÂLF**. `scripts/check.mjs` fails on any other spelling.
Only technical slugs (the domain souralf.com, the Instagram handle) use plain letters.

## Payment (Stripe Embedded Checkout)

The payment form is embedded on /box; the customer never leaves souralf.com.
Set these in Vercel → Project → Settings → Environment Variables (never in the repo):

- `STRIPE_SECRET_KEY`: the secret key (`sk_live_…`) of the same Stripe account and mode as the publishable key in box.html (test: `sk_test_…` with `pk_test_…`)
- `SHIPPING_COUNTRIES`: optional, e.g. `DE,AT,CH` (default `DE`)

Without `STRIPE_SECRET_KEY` the button falls back to the adoption email.

## Conversion

Every "Adopt ÂLF" button opens a pre-filled email (`mailto:`). Swap the address in `index.html`
(search `mailto:`) when a dedicated inbox or checkout exists.
