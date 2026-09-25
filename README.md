# ÂLF — souralf.com

A living German sourdough culture. One product: **THE ÂLF BOX**. One action: **ADOPT ÂLF**.

## Stack

Plain HTML, CSS and JavaScript. No framework, build step, dependencies or webfonts.
Vercel publishes `main` to https://souralf.com and creates previews for branches.

## Design and photographs

A warm off-white canvas, charcoal, oversized monospace typography and the founder’s real sourdough photographs. The loaf opens the page; a compact interactive sequence with the existing starter video and four photographic moments follows the dough through its natural cracks to the baked crust.

Original photographs supplied by the owner:

- `IMG_6159.jpeg` → `assets/dough-*.webp`
- `IMG_6167.jpeg` → `assets/cracks-*.webp`
- `IMG_6171.jpeg` → `assets/rise-*.webp`
- `IMG_6182.jpeg` → `assets/bread-*.webp`

Each photo is encoded at 640px and 1152px widths for responsive delivery. Original content is preserved; metadata is removed from the web assets. Layout cropping is handled in CSS. No generated or AI imagery.

The concurrently added JPEG variants in `assets/photos/` and the real-loaf `assets/og.jpg` share image are retained. The landing page uses the four original photos as responsive WebP assets; link previews use the existing landscape share image.

The story preserves the original starter video, followed by four still photographs. Reduced motion, short screens and JavaScript disabled all receive a complete static gallery. The story has labeled navigation buttons and a link to skip to the box. It occupies one screen rather than pinning the visitor through a long scroll. The page follows the concurrent main-branch shortening: hero, band, media story, box, footer. The new video, product photographs, `/box` product page, quantity selection and sitemap entry are retained.

## Local checks

```bash
python3 -m http.server 8000
node scripts/check.mjs
```

Verify desktop and mobile layouts, the video and four photo moments, product navigation, quantity controls, keyboard focus, reduced motion and the email adoption link before merging.

## Brand

Always write **ÂLF**. Only technical slugs (domain, repo and Instagram handle) use plain letters.

## Conversion

Adoption buttons open the concurrently added `/box` product page. Its quantity control is preserved and its button opens the existing prefilled email to brinkmannbuild@gmail.com. No checkout, price or availability is invented.
