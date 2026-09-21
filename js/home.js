/* ============================================================
   SKYMARK — home.js
   the front page: loader, the six chapters, the rail, the bar,
   and the hand-off to webgl.js for the world behind it all.
   ============================================================ */

(function () {
  "use strict";

  const gsap = window.gsap;
  const App = window.SKY;
  const ScrollTrigger = window.ScrollTrigger;

  /* keep it simple — always start at the top */
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  /* ----------------------------------------------------------
     content model
     ---------------------------------------------------------- */
  const SECTIONS = [
    {
      label: "Vision",
      title:
        'We sketch the city <br class="sm-hidden"> before it exists <br> of real estate',
      text: "For over 35 years, Skymark has quietly redrawn the map of Lahore — homes, offices and entire neighbourhoods, carried from a pencil line on paper to streets your grandchildren will walk.",
      cta: "Explore our portfolio",
      href: "projects.html",
    },
    {
      label: "Ingenuity",
      title:
        'We see land the way <br class="sm-hidden"> it could become <br> not the way it is',
      text: "Where most people read an empty plot, we read school runs, shaded courtyards and a corner store that knows your name. Every project starts with one question — what could this piece of the city be?",
      cta: "Work with us",
      href: "careers.html",
    },
    {
      label: "Partnership",
      title:
        'We build alongside <br class="sm-hidden"> the finest minds <br> in the business',
      text: "Developers, sure — but also architects, engineers, landscape artists, surveyors and one very patient master bricklayer. It takes a small city to raise a proper one.",
      cta: "",
      href: "",
    },
    {
      label: "Mastery",
      title:
        'To deliver what <br class="sm-hidden"> others dismiss <br> as unbuildable',
      text: "We have taken on builds that kept our engineers up at night, then done them again, better. There is always a harder problem waiting — and honestly, we rather enjoy that.",
      cta: "Discover our story",
      href: "about.html",
    },
    {
      label: "Intent",
      title:
        'Build with intent, <br class="sm-hidden"> or don’t build <br> at all',
      text: "They are not making any more land, so every acre is a fifty-year decision — never a quarterly one. We build to outlast trends, tenants and, frankly, ourselves.",
      cta: "",
      href: "",
    },
    {
      label: "Horizon",
      title: "And hand tomorrow <br> a finer city",
      text: "The next chapter of Lahore is being drafted right now, and we intend to keep hold of the pencil. Come and see what we are drawing.",
      cta: "Explore our portfolio",
      href: "projects.html",
    },
  ];

  const DISTRICTS = [
    { name: "Walled City", count: "09" },
    { name: "Gulberg", count: "12" },
    { name: "Model Town", count: "18" },
    { name: "DHA", count: "06" },
  ];

  /* ----------------------------------------------------------
     build the DOM the loader needs (pixel brand letters)
     ---------------------------------------------------------- */

  /* ----------------------------------------------------------
     loader
     ---------------------------------------------------------- */
  const Loader = (() => {
    const el = document.querySelector(".loader");
    if (!el) return { run: (cb) => cb() };

    const center = el.querySelector(".loader-center");
    const holder = el.querySelector(".logo-holder");
    const progressText = el.querySelector(".progress-text");
    const loadingText = el.querySelector(".loading-text");
    const flash = el.querySelector(".flash-square");
    const brand = App.buildBrandSVG();
    holder.insertBefore(brand, holder.firstChild);

    const introSqs = Array.from(el.querySelectorAll(".intro-sq"));
    /* centre-out pairs, mirroring the letter order around the middle */
    const pairOrder = [];
    const seq = [
      [3, 4],
      [3, 4],
      [2, 5],
      [2, 5],
      [1, 6],
      [1, 6],
      [0, 0],
    ];
    seq.forEach((pr, i) => {
      const a = pr[0] * 2 + (i % 2 === 0 ? 0 : 1);
      const b = pr[1] * 2 + (i % 2 === 0 ? 0 : 1);
      if (introSqs[a] && introSqs[b] && a !== b)
        pairOrder.push([introSqs[a], introSqs[b]]);
      else if (introSqs[a]) pairOrder.push([introSqs[a]]);
    });

    let progress = 0;
    let target = 0;
    let shownPairs = 0;
    let done = false;
    let counting = true;

    function setTarget(v) {
      target = Math.max(target, v);
    }
    /* honest-ish progress: real milestones, one smooth counter */
    setTarget(34);
    document.fonts && document.fonts.ready.then(() => setTarget(72));
    window.addEventListener("load", () => setTarget(88));
    document.addEventListener("webgl:ready", () => setTarget(93));
    document.addEventListener("webgl:failed", () => setTarget(93));
    setTimeout(() => setTarget(100), 2600); /* nobody waits forever */

    function tick() {
      if (!counting) return;
      progress += (target - progress) * 0.06;
      if (target >= 100) progress += 0.4;
      const p = Math.min(100, Math.round(progress));
      progressText.textContent = p + "% ";
      progressText.style.opacity = loadingText.style.opacity = String(
        0.4 + (p / 100) * 0.6,
      );
      pairOrder.forEach((pair, i) => {
        if (p >= (i + 1) * (100 / pairOrder.length) && i >= shownPairs) {
          shownPairs = i + 1;
          pair.forEach((sq) => {
            const r = sq.querySelector("rect");
            gsap.to(r, { opacity: 1, duration: 0.3, ease: "power2.out" });
          });
        }
      });
      if (p >= 100 && target >= 100) {
        counting = false;
        finish();
        return;
      }
      requestAnimationFrame(tick);
    }

    async function intro() {
      gsap.set(center, { opacity: 1 });
      gsap.set([progressText, loadingText], { opacity: 0 });
      gsap.set(flash, { opacity: 0, scale: 3 });
      const w = gsap.timeline();
      w.to(flash, { scale: 1, duration: 0.2, ease: "power2.out" }, 0);
      for (let i = 0; i < 4; i++) {
        const at = i * 0.1;
        w.to(flash, { opacity: 1, duration: 0.05, ease: "power1.in" }, at);
        if (i < 3)
          w.to(
            flash,
            { opacity: 0, duration: 0.05, ease: "power1.out" },
            at + 0.05,
          );
      }
      await w.then();

      const b = gsap.timeline();
      const drift = (pairOrder.length - 1) * 0.033 + 0.15;
      b.to(
        progressText,
        { left: "102%", xPercent: -100, duration: drift, ease: "power2.out" },
        0,
      );
      b.to(
        loadingText,
        { left: "0%", xPercent: 0, x: 0, duration: drift, ease: "power2.out" },
        0,
      );
      await b.then();
    }

    function finish() {
      done = true;
      gsap.to([progressText, loadingText], {
        opacity: 0,
        duration: 0.5,
        ease: "power2.out",
      });
      /* squares slide to their grid homes */
      introSqs.forEach((sq, i) => {
        gsap.to(sq, {
          x: sq.style.getPropertyValue("--dx"),
          duration: 0.5,
          ease: "cubic-bezier(0.2, 0, 0, 1)",
          onComplete: () => {
            if (i === introSqs.length - 1) {
              center.classList.add("letters-animating");
              revealStatusLines();
            }
          },
        });
      });
      setTimeout(() => {
        gsap.to(el, {
          autoAlpha: 0,
          onComplete: () => {
            el.style.display = "none";
            App.hideLoaderDone();
          },
        });
      }, 2567);
    }

    function revealStatusLines() {
      const lines = el.querySelectorAll(".status-lines .line");
      lines.forEach((line, i) => {
        gsap.to(line.parentElement, {
          y: 0,
          duration: 0.6,
          delay: 0.9 + i * 0.12,
          ease: "power3.out",
        });
        const block = line.querySelector(".block");
        if (block) {
          gsap.fromTo(
            block,
            { scaleX: 1, transformOrigin: "100% 50%" },
            {
              scaleX: 0,
              transformOrigin: "0 50%",
              duration: 0.5,
              delay: 1.1 + i * 0.12,
              ease: "power2.inOut",
            },
          );
        }
      });
    }

    function run(onDone) {
      intro().then(() => {
        requestAnimationFrame(tick);
      });
      App.onLoaderHidden(onDone);
    }
    return { run };
  })();

  /* ----------------------------------------------------------
     sections (six chapters)
     ---------------------------------------------------------- */
  const pageScroll = document.querySelector(".page-scroll");
  const sectionsWrap = document.querySelector(".sections");
  let homeIndex = 0;
  let navLock = false;

  const splitters = [];

  function buildSections() {
    SECTIONS.forEach((data, i) => {
      const sec = document.createElement("section");
      sec.className = "section js-section";
      sec.id = "home-section-" + i;
      sec.style.height = i < 2 ? "400vh" : "500vh";
      sec.innerHTML = `
        <div class="sticky">
          <div class="section-inner">
            <div class="stack">
              <div class="section-kicker"><span class="sq"></span><span class="kicker-label">${data.label}</span></div>
              <h2 class="section-title">${data.title}</h2>
              <p class="section-copy">${data.text}</p>
              ${
                data.cta
                  ? `<div class="section-cta"><a class="btn" data-theme="transparent" data-border="true" data-corners="tr-bl" data-bevel="20" data-trail="50" href="${data.href}">
                      <span class="btn-box"><span class="btn-content">
                        <span class="px-icon px-icon--column" data-icon="column"><span data-sq="1"></span><span data-sq="2"></span><span data-sq="3"></span><span data-sq="4"></span><span data-sq="5"></span><span data-sq="6"></span></span>
                        <span class="btn-label">${data.cta}</span>
                        <span class="btn-bg"></span>
                      </span></span>
                    </a></div>`
                  : ""
              }
            </div>
          </div>
        </div>`;
      sectionsWrap.appendChild(sec);
    });
    App.initButtons(sectionsWrap);
  }

  function wireSections() {
    const STARTS = [
      ["top center", "bottom-=25% top"],
      ["top+=50% bottom+=25%", "bottom-=25% top+=50%"],
      ["top+=50% bottom+=100%", "bottom-=25% top+=50%"],
      ["top+=50% bottom+=200%", "bottom-=50% top+=75%"],
      ["top bottom-=175%", "bottom-=25% top-=100%"],
      ["top+=50% bottom+=25%", "bottom+=25% top"],
    ];

    document.querySelectorAll(".js-section").forEach((sec, i) => {
      const title = sec.querySelector(".section-title");
      const copy = sec.querySelector(".section-copy");
      const kicker = sec.querySelector(".section-kicker");
      const ctaWrap = sec.querySelector(".section-cta");

      const titleSplit = new SplitText(title, { type: "chars,words" });
      const copySplit = new SplitText(copy, { type: "lines" });
      splitters.push(titleSplit, copySplit);

      gsap.set(titleSplit.chars, { autoAlpha: 0 });
      gsap.set(copySplit.lines, { autoAlpha: 0, y: 40 });
      gsap.set(kicker, { autoAlpha: 0 });
      if (ctaWrap) gsap.set(ctaWrap, { autoAlpha: 0, y: 40 });

      const ctaBtn = ctaWrap ? ctaWrap.querySelector(".btn") : null;

      function enter() {
        if (navLock) return;
        homeIndex = i;
        updateRail();
        const tl = gsap.timeline({ defaults: { ease: "joe.out" } });
        tl.to(kicker, { autoAlpha: 1, duration: 1.5 }, 0)
          .to(
            titleSplit.chars,
            {
              autoAlpha: 1,
              duration: 0.4,
              stagger: { amount: 1.1, from: "random" },
            },
            0,
          )
          .to(
            copySplit.lines,
            { autoAlpha: 1, y: 0, duration: 1, stagger: { amount: 0.2 } },
            0.2,
          )
          .to(
            ctaWrap || {},
            {
              autoAlpha: 1,
              y: 0,
              duration: 1.5,
              onStart: () =>
                ctaBtn && ctaBtn.__hoverOnce && ctaBtn.__hoverOnce(),
            },
            0.4,
          );
      }

      function leave() {
        if (navLock) return;
        const tl = gsap.timeline({
          defaults: { ease: "joe.out", duration: 1 },
        });
        tl.to(kicker, { autoAlpha: 0 }, 0)
          .to(titleSplit.chars, { autoAlpha: 0 }, 0)
          .to(copySplit.lines, { autoAlpha: 0 }, 0)
          .to(ctaWrap || {}, { autoAlpha: 0 }, 0);
      }

      ScrollTrigger.create({
        scroller: pageScroll,
        trigger: sec,
        start: STARTS[i][0],
        end: STARTS[i][1],
        onEnter: enter,
        onEnterBack: enter,
        onLeave: leave,
        onLeaveBack: leave,
      });

      sec.__enter = enter;
      sec.__leave = leave;
    });
  }

  /* ----------------------------------------------------------
     left rail
     ---------------------------------------------------------- */
  const rail = document.querySelector(".rail");
  function buildRail() {
    SECTIONS.forEach((s, i) => {
      const item = document.createElement("div");
      item.className = "rail-item";
      item.innerHTML = `
        <div class="rail-sq"><i></i></div>
        <span class="rail-label">${s.label}</span>`;
      rail.appendChild(item);
      item.addEventListener("click", () => navigateTo(i));
      item.addEventListener("mouseenter", () => {
        if (i !== homeIndex) {
          App.sound.playSecondaryHover();
          gsap.to(item.querySelector(".rail-label"), {
            opacity: 0.7,
            duration: 0.2,
          });
        }
      });
      item.addEventListener("mouseleave", () => {
        if (i !== homeIndex)
          gsap.to(item.querySelector(".rail-label"), {
            opacity: 0.3,
            duration: 0.2,
          });
      });
    });
  }

  function updateRail(instant) {
    rail.querySelectorAll(".rail-item").forEach((item, i) => {
      item.classList.toggle("is-active", i === homeIndex);
      const sq = item.querySelector(".rail-sq i");
      gsap.to(sq, {
        scale: i === homeIndex ? 1 : 0,
        duration: instant ? 0 : 0.2,
        overwrite: "auto",
      });
    });
  }

  function railIntro() {
    const items = Array.from(rail.querySelectorAll(".rail-item"));
    const tl = gsap.timeline({ defaults: { duration: 1, ease: "joe.out" } });
    items.forEach((item, i) => {
      const label = item.querySelector(".rail-label");
      const sq = item.querySelector(".rail-sq i");
      gsap.set(item, { x: 10, autoAlpha: 0 });
      gsap.set(sq, { scale: 0 });
      tl.to(
        item,
        { x: 0, onStart: () => App.scramble(label, { duration: 1 }) },
        0.05 * i,
      );
      tl.to(item, { autoAlpha: 1, duration: 0.5 }, 0.05 * i);
      if (i === homeIndex) {
        tl.to(sq, { scale: 1, clearProps: "transform" }, "<");
        tl.fromTo(
          sq,
          { opacity: 0 },
          {
            opacity: 1,
            duration: 0.125,
            repeat: 7,
            yoyo: true,
            repeatDelay: 0,
            ease: "none",
            onComplete: () => gsap.set(sq, { opacity: 1 }),
          },
          "<",
        );
      } else {
        tl.to(item, { autoAlpha: 0.3, duration: 0.32 }, 0.05 * i + 0.16);
      }
    });
  }

  /* scroll a chapter into view the polite way */
  function navigateTo(i) {
    if (navLock || i === homeIndex) return;
    App.sound.playClick();
    navLock = true;
    const secs = document.querySelectorAll(".js-section");
    const current = secs[homeIndex];
    const target = secs[i];
    current.__leave && current.__leave();
    gsap.to(".districts", { autoAlpha: i === 0 ? 1 : 0, duration: 0.6 });

    const y = i === 0 ? 0 : target.offsetTop - window.innerHeight * 0.3;
    lenis.scrollTo(y, {
      duration: 1.35,
      easing: (t) => 1 - Math.pow(1 - t, 4),
      onComplete: () => {
        homeIndex = i;
        updateRail();
        target.__enter && target.__enter();
        setTimeout(() => (navLock = false), 350);
      },
    });
  }

  /* ----------------------------------------------------------
     smooth scroll
     ---------------------------------------------------------- */
  let lenis = null;
  function initScroll() {
    if (window.Lenis && pageScroll) {
      lenis = new Lenis({
        wrapper: pageScroll,
        content: sectionsWrap,
        lerp: 0.06,
        wheelMultiplier: 0.95,
      });
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      pageScroll.style.overflowY = "auto";
    }
  }

  /* ----------------------------------------------------------
     bottom bar behaviour
     ---------------------------------------------------------- */
  function initBar() {
    const fill = document.querySelector(".progress-fill");
    const hint = document.querySelector(".scroll-hint");
    const chev = hint ? hint.querySelector(".chev") : null;

    function onScroll() {
      const max = pageScroll.scrollHeight - pageScroll.clientHeight;
      const p = max > 0 ? clamp01(pageScroll.scrollTop / max) : 0;
      if (fill) {
        fill.style.setProperty("--p", (p * 100).toFixed(2) + "%");
        fill.style.setProperty("--o", (0.05 + p * 0.22).toFixed(3));
      }
      if (hint) {
        gsap.to(hint, {
          autoAlpha: p > 0.01 ? 0 : 1,
          duration: 0.4,
          overwrite: "auto",
        });
      }
    }
    pageScroll.addEventListener("scroll", onScroll, { passive: true });
    /* lenis emits its own scroll events, but keyboard / programmatic scrolls
       only fire the native one — keep both wired to ScrollTrigger */
    pageScroll.addEventListener("scroll", () => ScrollTrigger.update(), {
      passive: true,
    });
    onScroll();

    /* chevron pulses while we wait */
    if (chev) {
      gsap.to(chev, {
        opacity: 0.9,
        duration: 0.7,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        delay: 2,
      });
      gsap.to(chev, {
        y: 3,
        duration: 0.7,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        delay: 2,
      });
    }

    document.querySelectorAll("[data-prev], [data-next]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const dir = btn.hasAttribute("data-prev") ? -1 : 1;
        navigateTo(clampI(homeIndex + dir, 0, SECTIONS.length - 1));
      });
    });
  }
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const clampI = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ----------------------------------------------------------
     districts
     ---------------------------------------------------------- */
  function initDistricts() {
    const wrap = document.querySelector(".districts");
    if (!wrap) return;
    const items = DISTRICTS.map((d) => {
      const el = document.createElement("div");
      el.className = "district";
      el.innerHTML = `
        <div class="d-box">
          <div class="d-fill"></div>
          <div class="d-border"></div>
          <span class="d-corner tl"></span><span class="d-corner tr"></span>
          <span class="d-corner bl"></span><span class="d-corner br"></span>
          <div class="d-dot"></div>
        </div>
        <div class="d-meta">
          <div class="d-count"><span class="count-bg"></span><span class="count-txt">${d.count} Projects</span></div>
          <div class="d-name">${d.name}</div>
        </div>`;
      wrap.appendChild(el);
      return { el, name: d.name, count: d.count };
    });

    /* intro after the loader */
    App.onLoaderHidden(() => {
      items.forEach((it, i) => {
        const tl = gsap.timeline({
          delay: 0.7 + i * 0.14,
          defaults: { ease: "joe.out" },
        });
        tl.to(it.el, { autoAlpha: 1, duration: 0.01 }, 0)
          .fromTo(
            it.el.querySelector(".d-fill"),
            { scale: 0, opacity: 1 },
            { scale: 1, duration: 0.6, ease: "power3.out" },
            0,
          )
          .fromTo(
            it.el.querySelector(".d-fill"),
            { opacity: 1 },
            { opacity: 0, duration: 0.5, ease: "power2.in" },
            0.35,
          )
          .fromTo(
            it.el.querySelector(".count-bg"),
            { scaleX: 0 },
            { scaleX: 1, duration: 0.4, ease: "power2.out" },
            0.25,
          )
          .add(() => {
            const txt = it.el.querySelector(".count-txt");
            App.scramble(txt, { duration: 0.9 });
            const nm = it.el.querySelector(".d-name");
            gsap.fromTo(
              nm,
              { autoAlpha: 0, y: 8 },
              { autoAlpha: 1, y: 0, duration: 0.7, ease: "joe.out" },
            );
          }, 0.45);
      });
    });

    /* projection loop — markers ride the 3d anchors */
    let webgl = null;
    document.addEventListener("webgl:ready", (e) => (webgl = e.detail));
    if (window.SKY && window.SKY.webgl) webgl = window.SKY.webgl;

    const tmp = { visible: true };
    gsap.ticker.add(() => {
      if (!webgl || !webgl.markerAnchors) return;
      const cityUp = webgl.activeWorld() === "city";
      items.forEach((it) => {
        const anchor = webgl.markerAnchors[it.name];
        if (!anchor) return;
        const p = webgl.project(anchor);
        const on = cityUp && !p.behind && tmp.visible;
        const x = p.x - 20;
        const y = p.y - 20;
        it.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        it.el.style.opacity = on ? "" : "0";
      });
    });
  }

  /* ----------------------------------------------------------
     webgl choreography
     ---------------------------------------------------------- */
  let cinemaWired = false;
  function initWebGLCinema() {
    const tryWire = () => {
      if (cinemaWired) return;
      const webgl = window.SKY && window.SKY.webgl;
      if (!webgl) return;
      cinemaWired = true;
      wireCinema(webgl);
    };
    document.addEventListener("webgl:ready", tryWire);
    tryWire();
  }

  function wireCinema(webgl) {
    const rig = webgl.rig;

    /* one camera line for the whole page, scrubbed */
    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        scroller: pageScroll,
        trigger: sectionsWrap,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.9,
      },
    });
    /* s0 — drift in over the city */
    tl.to(rig, { px: 118, py: 142, pz: 198, duration: 0.1 }, 0)
      .to(
        rig,
        { px: 60, py: 66, pz: 130, tx: -30, ty: 6, tz: -30, duration: 0.09 },
        0.1,
      )
      /* s1 — low over the ridges */
      .to(
        rig,
        { px: 0, py: 52, pz: 150, tx: 0, ty: 4, tz: -420, duration: 0.17 },
        0.19,
      )
      /* s2/3 — through the constellation */
      .to(
        rig,
        { px: 0, py: 24, pz: 96, tx: 0, ty: 20, tz: -320, duration: 0.08 },
        0.36,
      )
      .to(rig, { px: 10, py: 40, pz: 40, duration: 0.16 }, 0.44)
      /* s4 — the breathing grid */
      .to(
        rig,
        { px: 150, py: 175, pz: 215, tx: 0, ty: 0, tz: 0, duration: 0.12 },
        0.6,
      )
      .to(rig, { px: 104, py: 128, pz: 152, duration: 0.13 }, 0.72)
      /* s5 — pull up for the last line */
      .to(
        rig,
        { px: 40, py: 210, pz: 260, tx: 0, ty: 12, tz: 0, duration: 0.15 },
        0.85,
      );

    /* world swaps at the seams */
    const swap = (name) => () => webgl.setWorld(name);
    const secs = () => document.querySelectorAll(".js-section");
    ScrollTrigger.create({
      scroller: pageScroll,
      trigger: () => secs()[1],
      start: "top 78%",
      onEnter: swap("terrain"),
      onLeaveBack: swap("city"),
    });
    ScrollTrigger.create({
      scroller: pageScroll,
      trigger: () => secs()[2],
      start: "top 78%",
      onEnter: swap("points"),
      onLeaveBack: swap("terrain"),
    });
    ScrollTrigger.create({
      scroller: pageScroll,
      trigger: () => secs()[4],
      start: "top 78%",
      onEnter: swap("cubes"),
      onLeaveBack: swap("points"),
    });

    /* the map is only grabbable while the hero chapter is on screen.
       driven straight off the scroll position — cheap and reliable. */
    let heroDragOn = null;
    function updateHeroState() {
      const s0 = secs()[0];
      if (!s0) return;
      const limit =
        s0.offsetTop + s0.offsetHeight - pageScroll.clientHeight * 0.35;
      const on = pageScroll.scrollTop < limit;
      if (on !== heroDragOn) {
        heroDragOn = on;
        webgl.setDragEnabled(on);
        gsap.to(".districts", { autoAlpha: on ? 1 : 0, duration: 0.5 });
      }
    }
    pageScroll.addEventListener("scroll", updateHeroState, { passive: true });
    updateHeroState();

    /* finale pulse on the hero cube */
    ScrollTrigger.create({
      scroller: pageScroll,
      trigger: () => secs()[5],
      start: "top+=50% bottom+=25%",
      onEnter: () =>
        gsap.to(rig, { cubePulse: 0.55, duration: 1.2, ease: "power2.out" }),
      onLeaveBack: () => gsap.to(rig, { cubePulse: 0, duration: 0.8 }),
    });

    App.onLoaderHidden(() => webgl.intro && webgl.intro());
  }

  /* ----------------------------------------------------------
     intro handshake — the loader calls this
     ---------------------------------------------------------- */
  function siteIntro() {
    /* frame border draws itself in */
    const borderPath = document.querySelector(".frame .bevel-border-svg path");
    if (borderPath) {
      const len = borderPath.getTotalLength ? borderPath.getTotalLength() : 0;
      if (len) {
        gsap.fromTo(
          borderPath,
          { strokeDasharray: len, strokeDashoffset: len },
          {
            strokeDashoffset: 0,
            duration: 1.6,
            ease: "power2.inOut",
            delay: 0.15,
          },
        );
      }
    }
    /* header + bar */
    gsap.fromTo(
      ".site-header",
      { autoAlpha: 0, y: -8 },
      { autoAlpha: 1, y: 0, duration: 1, ease: "joe.out", delay: 0.25 },
    );
    gsap.fromTo(
      ".bottombar",
      { autoAlpha: 0 },
      { autoAlpha: 1, duration: 1, ease: "joe.out", delay: 0.45 },
    );
    document
      .querySelectorAll(".bar-btn .lbl, .scroll-hint .txt")
      .forEach((el, i) => {
        App.scramble(el, { duration: 1, delay: 0.55 + i * 0.08 });
      });
    document.querySelectorAll(".header-nav a").forEach((a, i) => {
      gsap.to(a, { opacity: 1, duration: 0.4, delay: 0.35 + i * 0.06 });
    });
    railIntro();
    /* first chapter shows itself */
    const first = document.querySelector(".js-section");
    first && first.__enter && setTimeout(() => first.__enter(), 250);
  }

  /* ----------------------------------------------------------
     boot
     ---------------------------------------------------------- */
  document.addEventListener("app:ready", () => {
    buildSections();
    buildRail();
    initScroll();
    initBar();
    initDistricts();
    initWebGLCinema();
    /* split after the real fonts land, else every measurement lies */
    let wired = false;
    const ready = () => {
      if (wired) return;
      wired = true;
      wireSections();
      ScrollTrigger.refresh();
      Loader.run(siteIntro);
    };
    if (document.fonts && document.fonts.status !== "loaded") {
      document.fonts.ready.then(() => setTimeout(ready, 60));
      setTimeout(ready, 2500); /* escape hatch if fonts stall */
    } else {
      ready();
    }
  });

  /* fonts landing can shift the splits — re-measure once */
  document.fonts && document.fonts.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener("resize", () => ScrollTrigger.refresh());
})();
