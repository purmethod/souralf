# ÂLF — souralf.com

A living German sourdough culture. One product: **THE ÂLF BOX**. One action: **ADOPT ÂLF**.

## Stack

- Plain HTML, CSS and JavaScript. No framework, no build step, no dependencies, no webfonts.
- Visual reference: edocheesecake.com (white, monospace headlines, black scrolling band, beige rounded buttons, floating pill).
- Hosted on **Vercel** as a static site (`vercel.json`: clean URLs, cache and security headers).
- The hero surface, the scroll transformation and the fallback stills are drawn live on `<canvas>`
  by `app.js`: a procedural dough/crust renderer with no image downloads.

## Structure

```
index.html          the page: hero → meet ÂLF → transformation → from ÂLF to bread → box → how it works → adopt
styles.css          design system (white / ink / beige, system mono + sans, mobile first)
app.js              living surface, scroll story, reveals, adopt dock
404.html            not-found page
assets/og.jpg       1200×630 share image
assets/icon.svg     favicon
assets/photos/      THE REAL PRODUCT PHOTOS go here (see assets/photos/README.md)
scripts/check.mjs   pre-push check (syntax, links, sizes, brand spelling)
```

## Real photographs

The three original photos (dough before fermentation, risen dough, finished bread) are the source of truth.
Drop them into `assets/photos/` as `dough.jpg`, `risen.jpg` and `bread.jpg`. They then replace the rendered
stills in the "From ÂLF to bread" section automatically. There is no code change to make.

## Local

```bash
python3 -m http.server 8000     # any static server
node scripts/check.mjs          # run before every push
```

## Brand rule

The name is always written **ÂLF**. `scripts/check.mjs` fails on any other spelling.
Only technical slugs (the domain souralf.com, the Instagram handle) use plain letters.

## Conversion

Every "Adopt ÂLF" button opens a pre-filled email (`mailto:`). Swap the address in `index.html`
(search `mailto:`) when a dedicated inbox or checkout exists.
