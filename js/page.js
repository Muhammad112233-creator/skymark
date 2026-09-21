/* ============================================================
   SKYMARK — page.js
   behaviour shared by the interior pages: the quick loader,
   headline reveals, cards, and the slow city drifting behind.
   ============================================================ */

(function () {
  "use strict";

  const gsap = window.gsap;
  const App = window.SKY;
  const ScrollTrigger = window.ScrollTrigger;

  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  const pageScroll = document.querySelector(".page-scroll");

  document.addEventListener("app:ready", () => {
    /* smooth scroll everywhere, same glide as the front page */
    let lenis = null;
    if (window.Lenis && pageScroll) {
      lenis = new Lenis({ wrapper: pageScroll, lerp: 0.08 });
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    }

    /* headline: chars decode in from random order, like the home titles */
    const title = document.querySelector(".page-hero-title");
    const splitTitle = () => {
      if (!title || title.__split) return;
      title.__split = true;
      const split = new SplitText(title, { type: "chars,words" });
      gsap.set(split.chars, { autoAlpha: 0 });
      App.onLoaderHidden(() => {
        gsap.to(split.chars, {
          autoAlpha: 1,
          duration: 0.4,
          stagger: { amount: 1.0, from: "random" },
          ease: "joe.out",
          delay: 0.15,
        });
      });
    };
    if (document.fonts && document.fonts.status !== "loaded") {
      document.fonts.ready.then(() => setTimeout(splitTitle, 60));
      setTimeout(splitTitle, 2500);
    } else {
      splitTitle();
    }

    /* section heads + cards rise in as they arrive */
    document.querySelectorAll(".page-section h3").forEach((h) => {
      gsap.set(h, { autoAlpha: 0, y: 14 });
      ScrollTrigger.create({
        scroller: pageScroll,
        trigger: h,
        start: "top 88%",
        once: true,
        onEnter: () => {
          gsap.to(h, { autoAlpha: 1, y: 0, duration: 0.8, ease: "joe.out" });
          const lbl = h.querySelector("span:last-child");
          if (lbl && lbl.textContent) App.scramble(lbl, { duration: 0.9 });
        },
      });
    });

    document
      .querySelectorAll(".page-section p, .card, .role, .news-item, .office")
      .forEach((el, i) => {
        gsap.set(el, { autoAlpha: 0, y: 22 });
        ScrollTrigger.create({
          scroller: pageScroll,
          trigger: el,
          start: "top 92%",
          once: true,
          onEnter: () =>
            gsap.to(el, { autoAlpha: 1, y: 0, duration: 0.9, ease: "joe.out" }),
        });
      });

    /* beveled frames for cards + the hero panel */
    document.querySelectorAll(".card").forEach((card) => {
      App.bevelElement(card, {
        corners: "all",
        bevelSize: 16,
        border: true,
        borderColor: App.colors.hairline,
        borderWidth: 1,
      });
    });

    /* the map drifts behind these pages too */
    let webgl = null;
    document.addEventListener("webgl:ready", (e) => {
      webgl = e.detail;
      webgl.setWorld("city");
      webgl.autoOrbit = true;
      App.onLoaderHidden(() => webgl.intro && webgl.intro());
    });
    if (window.SKY && window.SKY.webgl) {
      webgl = window.SKY.webgl;
      webgl.setWorld("city");
      webgl.autoOrbit = true;
      App.onLoaderHidden(() => webgl.intro && webgl.intro());
    }

    /* chrome intro */
    App.onLoaderHidden(() => {
      const borderPath = document.querySelector(
        ".frame .bevel-border-svg path",
      );
      if (borderPath && borderPath.getTotalLength) {
        const len = borderPath.getTotalLength();
        if (len) {
          gsap.fromTo(
            borderPath,
            { strokeDasharray: len, strokeDashoffset: len },
            { strokeDashoffset: 0, duration: 1.4, ease: "power2.inOut" },
          );
        }
      }
      gsap.fromTo(
        ".site-header",
        { autoAlpha: 0, y: -8 },
        { autoAlpha: 1, y: 0, duration: 1, ease: "joe.out", delay: 0.1 },
      );
      document.querySelectorAll(".header-nav a").forEach((a, i) => {
        gsap.to(a, { opacity: 1, duration: 0.4, delay: 0.25 + i * 0.06 });
      });
    });

    ScrollTrigger.refresh();
    App.quickLoader();
  });
})();
