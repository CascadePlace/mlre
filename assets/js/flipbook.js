/* ==========================================================
   MLRE interactive flipbook
   Reads book/mlre.pdf with PDF.js and turns it into a page-flip
   book with StPageFlip. Pages are rendered lazily around the
   current spread so the 6 MB PDF stays quick to open.

   To swap the book: replace the files in /book and adjust
   BOOK below (no build step needed).
   ========================================================== */
(function () {
  "use strict";

  const BOOK = {
    pdf: "book/mlre.pdf",
    frontCover: "book/front-cover.png",
    backCover: "book/back-cover.png",
    // Book page shape = the cover's shape, so the covers fill their pages.
    // PDF pages are centred on that page with a little extra paper.
    pageWidth: 1410,
    pageHeight: 2250,
    // PDF page 1 is already the front cover, so skip it inside the book.
    skipPdfPages: [1],
    // Chapters by PDF page number.
    chapters: [
      { title: "Ch. 1 — Disaster Report", pdfPage: 2 },
      { title: "Ch. 2 — Generation Gamma", pdfPage: 14 },
      { title: "Ch. 3 — Workplace Escalations", pdfPage: 25 },
      { title: "Ch. 4 — Liability", pdfPage: 37 },
      { title: "Ch. 5 — ISO 10218", pdfPage: 48 },
      { title: "Epilogue", pdfPage: 59 },
      { title: "Art Gallery & Acknowledgements", pdfPage: 62 },
    ],
  };

  const $ = (id) => document.getElementById(id);
  const host = $("flipbook");
  if (!host || !window.pdfjsLib || !window.St) return;

  pdfjsLib.GlobalWorkerOptions.workerSrc = "assets/vendor/pdf.worker.min.js";

  const els = {
    stage: $("fbStage"), loading: $("fbLoading"), count: $("fbCount"),
    prev: $("fbPrev"), next: $("fbNext"), first: $("fbFirst"), last: $("fbLast"),
    chapter: $("fbChapter"), full: $("fbFull"),
    guide: $("fbGuide"), end: $("fbEnd"), open: $("fbOpen"), restart: $("fbRestart"),
  };

  let pdf = null;
  let flip = null;
  /** pages[i] = { el, pdfPage|null, rendered: width, rendering: bool } */
  const pages = [];
  const pdfPageToIndex = new Map();

  function makePage({ cls = "", density = "soft", html = "" }) {
    const el = document.createElement("div");
    el.className = "page " + cls;
    el.dataset.density = density;
    el.innerHTML = '<div class="page__inner">' + html + "</div>";
    host.appendChild(el);
    return el;
  }

  function buildPages(numPages) {
    // Front cover
    pages.push({ el: makePage({ cls: "page--cover", density: "hard",
      html: '<img src="' + BOOK.frontCover + '" alt="Front cover" draggable="false">' }), pdfPage: null });

    for (let p = 1; p <= numPages; p++) {
      if (BOOK.skipPdfPages.includes(p)) continue;
      const el = makePage({ html: '<div class="page__spinner" aria-hidden="true"></div><span class="page__num">' + p + "</span>" });
      pdfPageToIndex.set(p, pages.length);
      pages.push({ el, pdfPage: p, rendered: 0, rendering: false });
    }

    // Keep the back cover on its own (even page count with the cover showing).
    if (pages.length % 2 === 0) {
      pages.push({ el: makePage({ cls: "page--blank", html: "<p>notes:</p>" }), pdfPage: null });
    }
    pages.push({ el: makePage({ cls: "page--cover", density: "hard",
      html: '<img src="' + BOOK.backCover + '" alt="Back cover" draggable="false">' }), pdfPage: null });
  }

  async function renderPage(i) {
    const pg = pages[i];
    if (!pg || !pg.pdfPage || pg.rendering) return;
    // Use the book's page size (hidden pages report a 0-width rect).
    let cssW = 0;
    try { cssW = flip.getBoundsRect().pageWidth; } catch (e) { /* not ready */ }
    cssW = Math.max(cssW || pg.el.getBoundingClientRect().width, 300);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Math.round(cssW * dpr);
    if (pg.rendered && pg.rendered >= targetW * 0.9) return;

    pg.rendering = true;
    try {
      const page = await pdf.getPage(pg.pdfPage);
      const base = page.getViewport({ scale: 1 });
      const box = flip.getBoundsRect();
      const fit = Math.min(1, (box.height / box.pageWidth) / (base.height / base.width));
      const viewport = page.getViewport({ scale: (targetW * fit) / base.width });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await page.render({ canvasContext: canvas.getContext("2d", { alpha: false }), viewport }).promise;
      const inner = pg.el.querySelector(".page__inner");
      const old = inner.querySelector("canvas, .page__spinner");
      if (old) old.remove();
      canvas.style.width = (fit * 100) + "%";
      inner.prepend(canvas);
      pg.rendered = targetW;
    } catch (err) {
      console.warn("[flipbook] page", pg.pdfPage, err);
    } finally {
      pg.rendering = false;
    }
  }

  // After a resize, re-render visible pages so text stays sharp and fitted.
  function rerender() {
    pages.forEach((p) => { p.rendered = 0; });
    renderAround(flip.getCurrentPageIndex());
  }

  function renderAround(idx) {
    // Current spread first, then pages either side.
    const order = [idx, idx + 1, idx - 1, idx + 2, idx + 3, idx - 2, idx + 4, idx - 3];
    order.reduce((p, i) => p.then(() => renderPage(i)), Promise.resolve());
  }

  function labelFor(idx) {
    const last = pages.length - 1;
    if (idx <= 0) return "Front cover";
    if (idx >= last) return "Back cover";
    const landscape = flip.getOrientation() === "landscape";
    let a = idx, b = idx;
    if (landscape) { a = idx % 2 ? idx : idx - 1; b = a + 1; }
    const nums = [...new Set([a, b])].map((i) => pages[i] && pages[i].pdfPage).filter(Boolean);
    if (!nums.length) return "The end";
    const total = pdf.numPages;
    return (nums.length > 1 ? "pp. " + nums[0] + "–" + nums[1] : "p. " + nums[0]) + " / " + total;
  }

  // Show instructions in the empty half beside the front cover,
  // and an end panel beside the back cover (two-page view only).
  function placeGuides() {
    const idx = flip.getCurrentPageIndex();
    const landscape = flip.getOrientation() === "landscape";
    const atFront = landscape && idx === 0;
    const atBack = landscape && idx === pages.length - 1;
    els.guide.hidden = !atFront;
    els.end.hidden = !atBack;
    const panel = atFront ? els.guide : atBack ? els.end : null;
    if (!panel) return;
    const b = flip.getBoundsRect();
    const stage = els.stage.getBoundingClientRect();
    const book = host.getBoundingClientRect();
    const left = book.left - stage.left + b.left + (atFront ? 0 : b.pageWidth);
    Object.assign(panel.style, {
      left: left + "px",
      top: (book.top - stage.top + b.top) + "px",
      width: b.pageWidth + "px",
      height: b.height + "px",
    });
  }

  function updateUI() {
    const idx = flip.getCurrentPageIndex();
    placeGuides();
    els.count.textContent = labelFor(idx);
    els.prev.disabled = els.first.disabled = idx <= 0;
    els.next.disabled = els.last.disabled = idx >= pages.length - 1;
    // reflect chapter
    let current = "";
    const pdfHere = (pages[idx] && pages[idx].pdfPage) || (pages[idx + 1] && pages[idx + 1].pdfPage) || 0;
    BOOK.chapters.forEach((c) => { if (pdfHere >= c.pdfPage) current = String(c.pdfPage); });
    els.chapter.value = current;
  }

  function goToIndex(idx) {
    if (!flip) return;
    idx = Math.max(0, Math.min(pages.length - 1, idx));
    const cur = flip.getCurrentPageIndex();
    if (Math.abs(idx - cur) <= 2) flip.flip(idx);
    else flip.turnToPage(idx);
    renderAround(idx);
    setTimeout(updateUI, 30);
  }

  function goToPdfPage(p) {
    const idx = pdfPageToIndex.get(p);
    if (idx != null) goToIndex(idx);
  }

  function sizeHost() {
    // Fit a two-page spread inside the viewport height.
    const toolbarH = 210; // nav + toolbar + breathing room
    const availH = Math.max(360, window.innerHeight - toolbarH);
    const ratio = BOOK.pageWidth / BOOK.pageHeight;
    const pageW = availH * ratio;
    host.style.maxWidth = Math.round(pageW * 2) + "px";
    host.style.width = "100%";
  }

  async function init() {
    try {
      pdf = await pdfjsLib.getDocument({ url: BOOK.pdf }).promise;
    } catch (err) {
      els.loading.classList.add("is-error");
      els.loading.querySelector("p").textContent =
        "Couldn’t load the book. If you opened this file directly, serve the folder over http (see README).";
      console.error(err);
      return;
    }

    buildPages(pdf.numPages);
    sizeHost();

    flip = new St.PageFlip(host, {
      width: BOOK.pageWidth,
      height: BOOK.pageHeight,
      size: "stretch",
      minWidth: 240,
      maxWidth: 1000,
      minHeight: 310,
      maxHeight: 1300,
      showCover: true,
      usePortrait: true,
      autoSize: true,
      maxShadowOpacity: 0.45,
      flippingTime: 750,
      mobileScrollSupport: true,
      showPageCorners: true,
    });
    flip.loadFromHTML(host.querySelectorAll(".page"));

    flip.on("flip", (e) => { renderAround(e.data); updateUI(); });
    // hide the panels as soon as a page starts turning
    flip.on("changeState", (e) => {
      if (e.data !== "read") { els.guide.hidden = true; els.end.hidden = true; }
      else placeGuides();
    });
    els.open.addEventListener("click", () => flip.flipNext());
    els.restart.addEventListener("click", () => goToIndex(0));
    flip.on("changeOrientation", () => { updateUI(); renderAround(flip.getCurrentPageIndex()); });

    els.loading.classList.add("is-done");
    renderAround(0);
    updateUI();

    // Chapters dropdown
    BOOK.chapters.forEach((c) => {
      const o = document.createElement("option");
      o.value = String(c.pdfPage);
      o.textContent = c.title;
      els.chapter.appendChild(o);
    });
    els.chapter.addEventListener("change", () => {
      if (els.chapter.value) goToPdfPage(Number(els.chapter.value));
    });

    els.prev.addEventListener("click", () => flip.flipPrev());
    els.next.addEventListener("click", () => flip.flipNext());
    els.first.addEventListener("click", () => goToIndex(0));
    els.last.addEventListener("click", () => goToIndex(pages.length - 1));

    els.full.addEventListener("click", () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (els.stage.requestFullscreen) els.stage.requestFullscreen();
    });
    document.addEventListener("fullscreenchange", () => {
      host.style.maxWidth = document.fullscreenElement ? "none" : host.style.maxWidth;
      if (!document.fullscreenElement) sizeHost();
      setTimeout(() => { flip.update(); rerender(); placeGuides(); }, 120);
    });

    // Arrow keys while the reader is on screen
    let readerVisible = false;
    new IntersectionObserver(([en]) => { readerVisible = en.isIntersecting; }, { threshold: 0.35 })
      .observe(els.stage);
    document.addEventListener("keydown", (e) => {
      if (!readerVisible && !document.fullscreenElement) return;
      if (/input|select|textarea/i.test(e.target.tagName)) return;
      if (e.key === "ArrowRight") { flip.flipNext(); e.preventDefault(); }
      if (e.key === "ArrowLeft") { flip.flipPrev(); e.preventDefault(); }
    });

    let t;
    window.addEventListener("resize", () => {
      clearTimeout(t);
      t = setTimeout(() => { if (!document.fullscreenElement) sizeHost(); flip.update(); rerender(); placeGuides(); }, 200);
    });
  }

  // Public hook used by the contents list on the page.
  window.MLREFlipbook = { goToPdfPage, goToIndex };

  // Start loading once the reader is near the viewport (or after 2s).
  let started = false;
  const start = () => { if (!started) { started = true; init(); } };
  new IntersectionObserver(([en]) => { if (en.isIntersecting) start(); }, { rootMargin: "800px" })
    .observe(els.stage);
  setTimeout(start, 2000);
})();
