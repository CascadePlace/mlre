/* Page interactions: contents links, lightbox, counters, reveal */
(function () {
  "use strict";

  // Contents → open chapter in the flipbook
  document.querySelectorAll("[data-pdf-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = Number(btn.dataset.pdfPage);
      document.getElementById("read").scrollIntoView({ behavior: "smooth" });
      const go = () => {
        if (window.MLREFlipbook && document.querySelector("#flipbook .stf__block, #flipbook.stf__parent")) {
          window.MLREFlipbook.goToPdfPage(p);
        } else setTimeout(go, 250);
      };
      setTimeout(go, 400);
    });
  });

  // Lightbox for illustrations
  const box = document.getElementById("lightbox");
  const boxImg = document.getElementById("lightboxImg");
  document.querySelectorAll(".plate button").forEach((b) => {
    b.addEventListener("click", () => {
      const img = b.querySelector("img");
      boxImg.src = b.dataset.full;
      boxImg.alt = img.alt;
      if (box.showModal) box.showModal();
    });
  });
  box.addEventListener("click", (e) => { if (e.target === box) box.close(); });

  // Count-up numbers
  const counters = document.querySelectorAll(".counter");
  const countIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target, target = Number(el.dataset.target);
      let n = 0;
      const step = () => { n += 1; el.textContent = n; if (n < target) setTimeout(step, 90); };
      step();
      countIO.unobserve(el);
    });
  }, { threshold: 0.6 });
  counters.forEach((c) => countIO.observe(c));

  // Reveal on scroll
  const items = document.querySelectorAll(".card, .file, .incident, .plate, .spec, .toc");
  items.forEach((el) => el.classList.add("reveal"));
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("is-in"); revealIO.unobserve(en.target); } });
  }, { threshold: 0.12 });
  items.forEach((el) => revealIO.observe(el));
})();
