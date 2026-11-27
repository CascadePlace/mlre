# My Little Robot Employee — book website

Showcase site for *My Little Robot Employee, Volume 1* by M.S. Picton: a blueprint-themed one-pager with an interactive flipbook that reads the book straight from the PDF.

It's plain HTML, CSS and JS with no build step, so it runs on GitHub Pages as-is.

## What's where

```
index.html                 the site
book/mlre.pdf              the book (the flipbook reads this)
book/front-cover.png       front cover (first page of the flipbook)
book/back-cover.png        back cover (last page of the flipbook)
assets/css/style.css       blueprint theme
assets/js/flipbook.js      flipbook (PDF.js + StPageFlip), settings at the top
assets/js/main.js          contents links, gallery lightbox, small animations
assets/img/                web-sized covers and illustrations used on the page
assets/vendor/             PDF.js 3.11 and StPageFlip 2.0.7 (bundled, no CDN needed)
```

## Updating the book

1. Replace `book/mlre.pdf`, `book/front-cover.png` and/or `book/back-cover.png` (keep the same names).
2. If chapter pages moved, edit the `BOOK.chapters` list at the top of `assets/js/flipbook.js`, and the matching `data-pdf-page` numbers in the Contents list in `index.html`.
3. `skipPdfPages: [1]` hides PDF page 1 because it's the front cover. Remove it if a new PDF doesn't start with the cover.

## Run it locally

The flipbook loads the PDF over HTTP, so opening `index.html` directly from disk won't work. From this folder:

```
python -m http.server 8000
```

Then open http://localhost:8000.

## Publish with GitHub Pages

Repo **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)`**. The site will appear at `https://<owner>.github.io/<repo>/`.

## Credits

Story © M.S. Picton. Illustrations by Josh. PDF.js (Apache-2.0) and StPageFlip (MIT); licences are in `assets/vendor/`.
