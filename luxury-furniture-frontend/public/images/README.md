# Custom images

Drop your own photography in this folder to replace the stock/catalogue
imagery on the storefront.

## Where each file appears

| File | Where it shows | Recommended size | Orientation |
| --- | --- | --- | --- |
| `hero.jpg` | Behind the headline on the home page | 2400 × 1350 or wider | Landscape |
| `workshop.jpg` | Beside the "Six pairs of hands" copy | 1200 × 1500 | Portrait |
| `shop-banner.jpg` | Banner on Shop all and collection pages | 2400 × 1000 | Landscape |
| `collections/<slug>.jpg` | That collection's card in the moving rail | 900 × 1200 | Portrait |

## Collection slugs

One file per collection, named after its slug:

```
collections/arched-brass-mirror.jpg
collections/mirrors.jpg
collections/dining-tables.jpg
collections/wall-decor.jpg
collections/tables.jpg
```

The slug is the part in the URL, so `/collections/mirrors` needs
`collections/mirrors.jpg`.

## Rules

- Paths are referenced from code as `/images/...`, never `public/images/...`.
- JPEG at roughly 80% quality is fine. WebP is better if you can export it.
- Keep each file under about 400 KB. The hero is the one worth compressing
  hardest, since it loads first and affects how fast the page feels.
- Filenames are case-sensitive once deployed. Stick to lowercase.

## Changing a filename or extension

Edit `src/config/siteImages.ts`. That file is the single source of truth
for these four slots.

## If an image doesn't show

Nothing breaks. Each slot falls back to the catalogue image, then to a
branded placeholder. So a missing or misspelled file just means you see
the previous behaviour. Check:

1. The file really is in `public/images/`
2. The name matches `siteImages.ts` exactly, including the extension
3. A hard refresh, since browsers cache images aggressively
