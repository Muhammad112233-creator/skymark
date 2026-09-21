/* ============================================================
   SKYMARK — app.js
   shared behaviour: bevel geometry, buttons, pixel icons,
   scramble text, sound, menu, page transitions.
   home page extras live in home.js / webgl.js.
   ============================================================ */

(function () {
  "use strict";

  const gsap = window.gsap;
  gsap.registerPlugin(
    window.ScrollTrigger,
    window.SplitText,
    window.ScrambleTextPlugin,
  );

  const App = (window.App = {
    colors: {
      dark: "#020a18",
      off: "#d5e0ff",
      hairline: "rgba(213, 224, 255, 0.1)",
    },
    easings: {
      out: "joe.out",
      in: "joe.in",
      inOut: "joe.inOut",
    },
    isTouch: matchMedia("(hover: none), (pointer: coarse)").matches,
  });

  /* the three brand curves — used everywhere so I keep them in one place */
  gsap.registerEase &&
    (function () {
      try {
        if (window.CustomEase) {
          window.CustomEase.create("joe.in", "M0,0 C0.8,0 0.8,0.5 1,1");
          window.CustomEase.create("joe.out", "M0,0 C0.2,0 0.1,1 1,1");
          window.CustomEase.create("joe.inOut", "M0,0 C0.333,0 0,1 1,1");
        }
      } catch (e) {
        /* CustomEase not vendored — fall back to power curves below */
      }
    })();
  if (!gsap.parseEase("joe.out")) {
    gsap.registerEase("joe.out", (p) => 1 - Math.pow(1 - p, 3.2));
    gsap.registerEase("joe.in", (p) => Math.pow(p, 3.0));
    gsap.registerEase("joe.inOut", (p) =>
      p < 0.5 ? 2 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2,
    );
  }

  /* ------------------------------------------------------------
     bevel geometry
     an octagon-ish cut: big 45° cuts on the chosen corners with
     tiny eased tips, 4px rounds on the rest.
     corners: "all" or any of "tl tr bl br"
     ------------------------------------------------------------ */
  const BEV = { k: 0.87, e: 0.8, c: 0.067 };

  function bevelPath(w, h, opts) {
    opts = opts || {};
    const corners = opts.corners || "all";
    const radius = opts.radius != null ? opts.radius : 4;
    let bevel = opts.bevelSize != null ? opts.bevelSize : Math.min(w, h) * 0.15;
    bevel = Math.min(bevel, w * 0.4, h * 0.4);
    if (!bevel) return "";
    const cut = (c) => corners.indexOf(c) !== -1 || corners === "all";
    const r = (c) =>
      opts.flatCorners && opts.flatCorners.indexOf(c) !== -1 ? 0 : radius;
    let d = "";

    if (cut("tl")) {
      d += `M ${bevel},0 Q ${bevel * BEV.k},0 ${bevel * BEV.e},${bevel * BEV.c} L ${bevel * BEV.c},${bevel * BEV.e} Q 0,${bevel * BEV.k} 0,${bevel}`;
    } else {
      d += `M ${r("tl")},0 Q 0,0 0,${r("tl")}`;
    }
    if (cut("bl")) {
      d += ` L 0,${h - bevel} Q 0,${h - bevel * BEV.k} ${bevel * BEV.c},${h - bevel * BEV.e} L ${bevel * BEV.e},${h - bevel * BEV.c} Q ${bevel * BEV.k},${h} ${bevel},${h}`;
    } else {
      d += ` L 0,${h - r("bl")} Q 0,${h} ${r("bl")},${h}`;
    }
    if (cut("br")) {
      d += ` L ${w - bevel},${h} Q ${w - bevel * BEV.k},${h} ${w - bevel * BEV.e},${h - bevel * BEV.c} L ${w - bevel * BEV.c},${h - bevel * BEV.e} Q ${w},${h - bevel * BEV.k} ${w},${h - bevel}`;
    } else {
      d += ` L ${w - r("br")},${h} Q ${w},${h} ${w},${h - r("br")}`;
    }
    if (cut("tr")) {
      d += ` L ${w},${bevel} Q ${w},${bevel * BEV.k} ${w - bevel * BEV.e},${bevel * BEV.c} L ${w - bevel * BEV.c},${bevel * BEV.e} Q ${w - bevel * BEV.k},0 ${w - bevel},0`;
    } else {
      d += ` L ${w},${r("tr")} Q ${w},0 ${w - r("tr")},0`;
    }
    return d + " Z";
  }

  /* clip + optional border for one element */
  function bevelElement(el, opts) {
    opts = opts || {};
    const clipEl = opts.clipEl || el;
    const border = opts.border !== false;
    const borderColor = opts.borderColor || App.colors.hairline;
    const borderWidth = opts.borderWidth != null ? opts.borderWidth : 2;
    let w = 0,
      h = 0,
      pathStr = "",
      svg = null,
      pathEl = null,
      ro = null;

    if (border && el.querySelector(":scope > .bevel-border-svg")) {
      svg = el.querySelector(":scope > .bevel-border-svg");
      pathEl = svg.querySelector("path");
    }

    function apply() {
      const rect = el.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      if (!w || !h) return;
      pathStr = bevelPath(w, h, opts);
      if (!pathStr) return;
      /* clip-path with a px path() — crisp, no svg defs juggling */
      clipEl.style.clipPath = `path("${pathStr}")`;
      if (svg) {
        svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
        pathEl.setAttribute("d", pathStr);
        pathEl.setAttribute("stroke", borderColor);
        pathEl.setAttribute("stroke-width", String(borderWidth));
      }
    }

    if (border && !svg) {
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "bevel-border-svg");
      svg.setAttribute("preserveAspectRatio", "none");
      svg.setAttribute("fill", "none");
      pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
      pathEl.setAttribute("fill", "none");
      svg.appendChild(pathEl);
      el.appendChild(svg);
    }

    apply();
    if ("ResizeObserver" in window) {
      ro = new ResizeObserver(apply);
      ro.observe(el);
    }
    return { apply, destroy: () => ro && ro.disconnect() };
  }
  App.bevelElement = bevelElement;
  App.bevelPath = bevelPath;

  /* ------------------------------------------------------------
     pixel icons — column / grid / cross
     the squares swap homes while you watch. ported by hand from
     the motion spec: two .5s power2.inOut moves, settle, reset.
     ------------------------------------------------------------ */
  function makePixelIcon(root) {
    const kind = root.dataset.icon || "column";
    const sq = (n) => root.querySelector(`[data-sq="${n}"]`);
    let tl = null;

    function animate() {
      if (App.isTouch) return;
      const g = gsap.utils;
      const S = {};
      for (let i = 1; i <= 6; i++) {
        const el = sq(i);
        if (el) S[i] = el;
      }
      if (!S[1]) return;
      const pos = {};
      Object.keys(S).forEach((k) => {
        pos[k] = S[k].getBoundingClientRect();
      });
      if (tl) tl.kill();
      tl = gsap.timeline({
        onComplete: () => gsap.set(Object.values(S), { x: 0, y: 0 }),
      });
      if (kind === "column") {
        const s = Object.values(S).map((el) => el);
        gsap.set([S[1], S[4], S[5]], { x: 0, y: 0 });
        /* TL→TR→CR / CR→BR→BL / BL→CL→TL — one rolling loop */
        tl.to(
          S[1],
          {
            x: pos[2].left - pos[1].left,
            y: pos[2].top - pos[1].top,
            duration: 0.5,
            ease: "power2.inOut",
          },
          0,
        )
          .to(
            S[4],
            {
              x: pos[6].left - pos[4].left,
              y: pos[6].top - pos[4].top,
              duration: 0.5,
              ease: "power2.inOut",
            },
            0,
          )
          .to(
            S[5],
            {
              x: pos[3].left - pos[5].left,
              y: pos[3].top - pos[5].top,
              duration: 0.5,
              ease: "power2.inOut",
            },
            0,
          )
          .to(
            S[1],
            {
              x: pos[4].left - pos[1].left,
              y: pos[4].top - pos[1].top,
              duration: 0.5,
              ease: "power2.inOut",
            },
            0.505,
          )
          .to(
            S[4],
            {
              x: pos[5].left - pos[4].left,
              y: pos[5].top - pos[4].top,
              duration: 0.5,
              ease: "power2.inOut",
            },
            0.505,
          )
          .to(
            S[5],
            {
              x: pos[1].left - pos[5].left,
              y: pos[1].top - pos[5].top,
              duration: 0.5,
              ease: "power2.inOut",
            },
            0.505,
          );
      } else {
        /* grid + cross: corners breathe toward the middle and back */
        const dx = pos[2].left - pos[1].left;
        const dy = pos[3].top - pos[1].top;
        gsap.set([S[1], S[2], S[3], S[4]], { x: 0, y: 0 });
        tl.to(
          S[1],
          {
            x: dx,
            y: 0,
            duration: 0.5,
            ease: "power2.inOut",
            repeat: 1,
            repeatDelay: 0.005,
          },
          0,
        )
          .to(
            S[2],
            {
              x: 0,
              y: dy,
              duration: 0.5,
              ease: "power2.inOut",
              repeat: 1,
              repeatDelay: 0.005,
            },
            0,
          )
          .to(
            S[3],
            {
              x: 0,
              y: -dy,
              duration: 0.5,
              ease: "power2.inOut",
              repeat: 1,
              repeatDelay: 0.005,
            },
            0,
          )
          .to(
            S[4],
            {
              x: -dx,
              y: 0,
              duration: 0.5,
              ease: "power2.inOut",
              repeat: 1,
              repeatDelay: 0.005,
            },
            0,
          );
      }
    }
    return { animate };
  }

  /* ------------------------------------------------------------
     scramble text — chars decode in, settle left to right
     (thin wrapper around gsap's ScrambleTextPlugin so the rest
     of the codebase has one door to knock on)
     ------------------------------------------------------------ */
  function scramble(el, opts) {
    opts = opts || {};
    return gsap.to(el, {
      duration: opts.duration != null ? opts.duration : 1,
      delay: opts.delay || 0,
      scrambleText: {
        text: opts.text != null ? opts.text : el.textContent,
        chars: opts.chars || "upperCase",
        speed: opts.speed != null ? opts.speed : 1,
      },
      ease: "none",
      onComplete: opts.onComplete,
    });
  }
  App.scramble = scramble;

  /* elements carrying [data-scramble] reveal themselves on scroll */
  function initScrambleOnScroll(scope) {
    (scope || document).querySelectorAll("[data-scramble]").forEach((el) => {
      if (el.__scrambleBound) return;
      el.__scrambleBound = true;
      const text = el.textContent;
      el.textContent = text;
      gsap.set(el, { opacity: 1 });
      ScrollTrigger.create({
        trigger: el,
        start: "top 95%",
        once: true,
        onEnter: () => scramble(el, { text, duration: 1 }),
      });
    });
  }
  App.initScrambleOnScroll = initScrambleOnScroll;

  /* ------------------------------------------------------------
     technical reveal — text wiped clean by a sliding block
     (loader status lines, marker counts)
     ------------------------------------------------------------ */
  function technicalReveal(el) {
    const block = el.querySelector(".block");
    if (!block) return;
    gsap.set(block, { scaleX: 1, transformOrigin: "100% 50%" });
    return gsap
      .timeline()
      .to(block, {
        scaleX: 0,
        transformOrigin: "0 50%",
        duration: 0.5,
        ease: "power2.inOut",
      });
  }
  App.technicalReveal = technicalReveal;

  /* ------------------------------------------------------------
     the brand as load-bearing pixels — shared by every loader
     ------------------------------------------------------------ */
  const LETTERS = [
    {
      n: "S",
      strokes: ["M4.5 0.5 L0.5 0.5 L0.5 2.5 L4.5 2.5 L4.5 4.5 L0.5 4.5"],
      anchors: [0, 4],
    },
    {
      n: "K",
      cols: [0],
      strokes: ["M4.5 0.5 L0.5 2.5 L4.5 4.5"],
      anchors: [0, 4],
    },
    {
      n: "Y",
      strokes: ["M0.5 0.5 L2.5 2.5 L4.5 0.5", "M2.5 2.5 L2.5 4.5"],
      anchors: [2, 2],
    },
    {
      n: "M",
      cols: [0, 4],
      strokes: ["M0.5 0.5 L2.5 3.5 L4.5 0.5"],
      anchors: [0, 4],
    },
    {
      n: "A",
      strokes: ["M0.5 4.5 L2.5 0.5 L4.5 4.5", "M1 3.5 L4 3.5"],
      anchors: [1, 3],
    },
    {
      n: "R",
      cols: [0],
      strokes: ["M0.5 0.5 L3.5 0.5 L3.5 2.5 L0.5 2.5", "M2.5 2.5 L4.5 4.5"],
      anchors: [0, 3],
    },
    {
      n: "K",
      cols: [0],
      strokes: ["M4.5 0.5 L0.5 2.5 L4.5 4.5"],
      anchors: [0, 4],
    },
  ];

  function buildBrandSVG() {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 352 40");
    svg.classList.add("brand-svg");

    const drifts = [
      0, 3.3, -5.3, -2, -10.7, -7.3, 0, 7.3, 10.7, 2, 5.3, -3.3, 0, -4,
    ];
    LETTERS.forEach((L, li) => {
      L.anchors.forEach((cell, ai) => {
        const g = document.createElementNS(NS, "g");
        g.setAttribute("class", "intro-sq");
        const dx = drifts[(li * 2 + ai) % drifts.length];
        const finalX = li * 52 + cell * 8;
        const r = document.createElementNS(NS, "rect");
        r.setAttribute("x", String(finalX - dx));
        r.setAttribute("y", "16");
        r.setAttribute("width", "8");
        r.setAttribute("height", "8");
        g.appendChild(r);
        g.style.setProperty("--dx", dx + "px");
        svg.appendChild(g);
      });
    });

    const letters = document.createElementNS(NS, "g");
    letters.setAttribute("class", "letters");
    LETTERS.forEach((L, li) => {
      const g = document.createElementNS(NS, "g");
      g.setAttribute("transform", `translate(${li * 52},0) scale(8)`);
      (L.cols || []).forEach((cx) => {
        const r = document.createElementNS(NS, "rect");
        r.setAttribute("class", "cell col");
        r.setAttribute("x", String(cx));
        r.setAttribute("y", "2");
        r.setAttribute("width", "1");
        r.setAttribute("height", "1");
        g.appendChild(r);
      });
      (L.strokes || []).forEach((d) => {
        const p = document.createElementNS(NS, "path");
        p.setAttribute("class", "stroke");
        p.setAttribute("d", d);
        p.setAttribute("pathLength", "1");
        g.appendChild(p);
      });
      letters.appendChild(g);
    });
    svg.appendChild(letters);
    return svg;
  }
  App.buildBrandSVG = buildBrandSVG;

  /* interior pages get the short version of the loader — letters
     draw, one status line, gone. */
  App.quickLoader = function () {
    const el = document.querySelector(".loader");
    if (!el) {
      App.hideLoaderDone();
      return;
    }
    const center = el.querySelector(".loader-center");
    const holder = el.querySelector(".logo-holder");
    const brand = buildBrandSVG();
    holder.insertBefore(brand, holder.firstChild);
    const status = el.querySelector(".status-lines");

    const introSqs = Array.from(el.querySelectorAll(".intro-sq"));
    introSqs.forEach((sq) =>
      gsap.set(sq, { x: sq.style.getPropertyValue("--dx"), opacity: 0.2 }),
    );

    gsap.set(center, { opacity: 1 });
    let played = false;
    const play = () => {
      if (played) return;
      played = true;
      center.classList.add("letters-animating");
      if (status)
        gsap.to(status, {
          y: 0,
          duration: 0.6,
          delay: 0.5,
          ease: "power3.out",
        });
      const blocks = el.querySelectorAll(".status-lines .block");
      blocks.forEach((b, i) =>
        gsap.fromTo(
          b,
          { scaleX: 1, transformOrigin: "100% 50%" },
          {
            scaleX: 0,
            transformOrigin: "0 50%",
            duration: 0.5,
            delay: 0.7 + i * 0.12,
            ease: "power2.inOut",
          },
        ),
      );
      setTimeout(() => {
        gsap.to(el, {
          autoAlpha: 0,
          duration: 0.5,
          onComplete: () => {
            el.style.display = "none";
            App.hideLoaderDone();
          },
        });
      }, 1500);
    };
    if (document.fonts && document.fonts.status !== "loaded") {
      document.fonts.ready.then(() => setTimeout(play, 150));
    } else {
      setTimeout(play, 150);
    }
  };

  /* ------------------------------------------------------------
     sound — everything synthesised, nothing recorded
     ------------------------------------------------------------ */
  const Sound = (App.sound = {
    ctx: null,
    master: null,
    enabled: false,
    ambient: null,
    _hoverCooldown: 0,

    ensure() {
      if (this.ctx) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.0;
      this.master.connect(this.ctx.destination);
      return true;
    },

    _env(gain, t0, peak, attack, release) {
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(peak, t0 + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + release);
    },

    blip(freq, dur, type, vol) {
      if (!this.enabled || !this.ctx) return;
      const t0 = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type || "sine";
      osc.frequency.setValueAtTime(freq, t0);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.6, t0 + dur);
      this._env(g, t0, vol || 0.05, 0.005, dur);
      osc.connect(g).connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    },

    noise(dur, vol, filterFreq) {
      if (!this.enabled || !this.ctx) return;
      const t0 = this.ctx.currentTime;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++)
        data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = filterFreq || 1800;
      const g = this.ctx.createGain();
      g.gain.value = vol || 0.08;
      src.connect(f).connect(g).connect(this.master);
      src.start(t0);
    },

    playHover() {
      const now = performance.now();
      if (now - this._hoverCooldown < 70) return;
      this._hoverCooldown = now;
      this.blip(1240, 0.06, "sine", 0.035);
    },
    playSecondaryHover() {
      this.blip(830, 0.07, "sine", 0.028);
    },
    playClick() {
      this.blip(520, 0.09, "triangle", 0.07);
      this.noise(0.05, 0.05, 2400);
    },
    playModalOpen() {
      if (!this.enabled || !this.ctx) return;
      const t0 = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(160, t0);
      osc.frequency.exponentialRampToValueAtTime(640, t0 + 0.28);
      this._env(g, t0, 0.05, 0.02, 0.3);
      osc.connect(g).connect(this.master);
      osc.start(t0);
      osc.stop(t0 + 0.4);
    },
    playTransition() {
      this.blip(210, 0.4, "sine", 0.05);
      this.noise(0.35, 0.03, 700);
    },

    startAmbient() {
      if (!this.enabled || !this.ctx || this.ambient) return;
      const ctx = this.ctx;
      const t0 = ctx.currentTime;
      const bus = ctx.createGain();
      bus.gain.value = 0.0;
      bus.gain.linearRampToValueAtTime(0.16, t0 + 3);
      bus.connect(this.master);

      /* two detuned low voices + a slow filtered wash = "the site hums" */
      [55, 55.6, 110.3].forEach((f, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = f;
        g.gain.value = i === 2 ? 0.18 : 0.4;
        osc.connect(g).connect(bus);
        osc.start();
      });
      const washLen = ctx.sampleRate * 4;
      const wash = ctx.createBuffer(1, washLen, ctx.sampleRate);
      const wd = wash.getChannelData(0);
      let last = 0;
      for (let i = 0; i < washLen; i++) {
        last = 0.98 * last + 0.02 * (Math.random() * 2 - 1);
        wd[i] = last * 3;
      }
      const src = ctx.createBufferSource();
      src.buffer = wash;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 420;
      const wg = ctx.createGain();
      wg.gain.value = 0.22;
      const lfo = ctx.createOscillator();
      const lfoG = ctx.createGain();
      lfo.frequency.value = 0.05;
      lfoG.gain.value = 160;
      lfo.connect(lfoG).connect(f.frequency);
      lfo.start();
      src.connect(f).connect(wg).connect(bus);
      src.start();

      this.ambient = { bus, nodes: [src, lfo] };
    },

    setEnabled(on) {
      if (!this.ensure()) return;
      this.enabled = on;
      if (this.ctx.state === "suspended") this.ctx.resume();
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(
        on ? 1 : 0,
        this.ctx.currentTime + 0.4,
      );
      if (on) this.startAmbient();
      document.dispatchEvent(
        new CustomEvent("sound:change", { detail: { on } }),
      );
    },
  });

  /* ------------------------------------------------------------
     buttons
     ------------------------------------------------------------ */
  function initButtons(scope) {
    (scope || document).querySelectorAll(".btn").forEach((btn) => {
      if (btn.__btnInit) return;
      btn.__btnInit = true;

      const theme = btn.dataset.theme || "transparent";
      const corners = btn.dataset.corners || "tr-bl";
      const bevelSize = parseInt(btn.dataset.bevel || "20", 10);
      const hasBorder = btn.dataset.border === "true";
      const borderColor = btn.dataset.borderColor || App.colors.hairline;
      const trailLength = parseInt(btn.dataset.trail || "40", 10);
      const box = btn.querySelector(".btn-box");
      const content = btn.querySelector(".btn-content");
      const iconRoot = btn.querySelector("[data-icon]");
      const icon = iconRoot ? makePixelIcon(iconRoot) : null;
      const label = btn.querySelector(".btn-label");
      const flash = btn.querySelector(".btn-bg");

      /* bevel the box + draw its resting border */
      bevelElement(box, {
        corners,
        bevelSize,
        border: hasBorder,
        borderColor,
        borderWidth: 2,
        clipEl: content,
      });

      /* hover trail: two dashes race around the outline from top-centre */
      let trailSvg = null,
        pathA = null,
        pathB = null,
        outline = 0,
        hoverTl = null;

      function buildTrail() {
        const rect = box.getBoundingClientRect();
        const w = rect.width,
          h = rect.height;
        if (!w || !h) return;
        const o = 0.5; /* hoverStrokeWidth 1 → inset .5 */
        const iw = w - o * 2,
          ih = h - o * 2;
        let bevel = Math.min(bevelSize, iw * 0.4, ih * 0.4);
        const cutTR = corners.indexOf("tr") !== -1 || corners === "all";
        const cutBL = corners.indexOf("bl") !== -1 || corners === "all";
        const cutBR = corners.indexOf("br") !== -1 || corners === "all";
        const cutTL = corners.indexOf("tl") !== -1 || corners === "all";
        const r = 4;
        let d = `M ${iw / 2},${o}`;
        if (cutTR) {
          d += ` L ${iw - bevel + o},${o} Q ${iw - bevel * BEV.k + o},${o} ${iw - bevel * BEV.e + o},${bevel * BEV.c + o} L ${iw - bevel * BEV.c + o},${bevel * BEV.e + o} Q ${iw + o},${bevel * BEV.k + o} ${iw + o},${bevel + o}`;
        } else {
          d += ` L ${iw - r + o},${o} Q ${iw + o},${o} ${iw + o},${r + o}`;
        }
        if (cutBR) {
          d += ` L ${iw + o},${ih - bevel + o} Q ${iw + o},${ih - bevel * BEV.k + o} ${iw - bevel * BEV.e + o},${ih - bevel * BEV.c + o} L ${iw - bevel * BEV.c + o},${ih - bevel * BEV.e + o} Q ${iw - bevel * BEV.k + o},${ih + o} ${iw - bevel + o},${ih + o}`;
        } else {
          d += ` L ${iw + o},${ih - r + o} Q ${iw + o},${ih + o} ${iw - r + o},${ih + o}`;
        }
        if (cutBL) {
          d += ` L ${bevel + o},${ih + o} Q ${bevel * BEV.k + o},${ih + o} ${bevel * BEV.e + o},${ih - bevel * BEV.c + o} L ${bevel * BEV.c + o},${ih - bevel * BEV.e + o} Q ${o},${ih - bevel * BEV.k + o} ${o},${ih - bevel + o}`;
        } else {
          d += ` L ${r + o},${ih + o} Q ${o},${ih + o} ${o},${ih - r + o}`;
        }
        if (cutTL) {
          d += ` L ${o},${bevel + o} Q ${o},${bevel * BEV.k + o} ${bevel * BEV.c + o},${bevel * BEV.e + o} L ${bevel * BEV.e + o},${bevel * BEV.c + o} Q ${bevel * BEV.k + o},${o} ${bevel + o},${o}`;
        } else {
          d += ` L ${o},${r + o} Q ${o},${o} ${r + o},${o}`;
        }
        d += ` L ${iw / 2},${o}`;

        if (!trailSvg) {
          trailSvg = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "svg",
          );
          trailSvg.setAttribute("class", "btn-trail");
          trailSvg.setAttribute("fill", "none");
          trailSvg.setAttribute("preserveAspectRatio", "none");
          pathA = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "path",
          );
          pathB = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "path",
          );
          [pathA, pathB].forEach((p) => {
            p.setAttribute("stroke", App.colors.off);
            p.setAttribute("stroke-width", "1");
            p.setAttribute("stroke-linecap", "butt");
            p.setAttribute("stroke-linejoin", "round");
            p.setAttribute("opacity", "0.15");
            trailSvg.appendChild(p);
          });
          box.appendChild(trailSvg);
        }
        trailSvg.setAttribute("viewBox", `0 0 ${w} ${h}`);
        pathA.setAttribute("d", d);
        pathB.setAttribute("d", d);
        outline = pathA.getTotalLength();
        const half = outline / 2;
        const gap = half - trailLength;
        gsap.set(pathA, {
          strokeDasharray: `${trailLength} ${gap}`,
          strokeDashoffset: 0,
        });
        gsap.set(pathB, {
          strokeDasharray: `${trailLength} ${gap}`,
          strokeDashoffset: -half,
        });
      }

      function playTrail() {
        buildTrail();
        if (!outline) return;
        if (hoverTl) hoverTl.kill();
        const half = outline / 2;
        const race = (p, start) => {
          const st = { progress: 0 };
          return gsap.to(st, {
            progress: 1,
            duration: 1,
            ease: "power2.inOut",
            onUpdate: () => {
              const len = trailLength * Math.sin(Math.PI * st.progress);
              const off = start - half * st.progress;
              const gap = half - len;
              p.style.strokeDasharray = `${len} ${gap}`;
              p.style.strokeDashoffset = String(off);
            },
          });
        };
        hoverTl = gsap.timeline({ onComplete: () => (btn.__hovering = false) });
        hoverTl.add(race(pathA, 0), 0).add(race(pathB, -half), 0);
        if (flash) {
          hoverTl
            .to(flash, { opacity: 0.1, duration: 0.2, ease: "power2.out" }, 0)
            .to(flash, { opacity: 0, duration: 0.25, ease: "power2.in" }, 0.2);
        }
      }

      btn.addEventListener("mouseenter", () => {
        btn.__hovering = true;
        btn.classList.add("is-hovering");
        if (icon) icon.animate();
        if (label) scramble(label, { duration: 1.33, speed: 2 });
        Sound.playHover();
        playTrail();
      });
      btn.addEventListener("mouseleave", () => {
        btn.classList.remove("is-hovering");
      });
      btn.addEventListener("click", () => Sound.playClick());

      /* one-shot intro used when a section reveals its CTA */
      btn.__hoverOnce = () => {
        if (icon) icon.animate();
        playTrail();
      };

      if (btn.dataset.animateOnMount === "true") {
        requestAnimationFrame(() => {
          buildTrail();
          if (icon) icon.animate();
        });
      }
    });
  }
  App.initButtons = initButtons;

  /* ------------------------------------------------------------
     header + menu
     ------------------------------------------------------------ */
  function initChrome() {
    /* bevel the page frame */
    const frame = document.querySelector(".frame");
    if (frame) {
      const clip = frame.querySelector(".bevel-clip");
      if (clip)
        bevelElement(frame, { corners: "all", clipEl: clip, border: true });
    }

    /* mono nav links decode on load */
    document.querySelectorAll(".header-nav a").forEach((a, i) => {
      const span = a.querySelector("span:not(.sr-only)") || a;
      gsap.set(a, { opacity: 0 });
      App.onLoaderHidden(() => {
        gsap.to(a, { opacity: 1, duration: 0.4, delay: 0.1 + i * 0.06 });
        scramble(span, { duration: 1, delay: 0.1 + i * 0.06 });
      });
    });

    initButtons(document);

    /* menu overlay */
    const menu = document.querySelector(".menu-overlay");
    if (menu) {
      const holder = menu.querySelector(".menu-panel-holder");
      const backdrop = menu.querySelector(".menu-backdrop");
      const closeBtn = menu.querySelector(".menu-close");
      const links = Array.from(menu.querySelectorAll(".menu-links a"));
      const footLinks = Array.from(menu.querySelectorAll(".menu-footer a"));
      const explore = menu.querySelector(".menu-explore .lbl");
      let openState = false;
      let busy = false;

      if (holder) {
        bevelElement(holder.querySelector(".menu-panel"), {
          corners: "all",
          bevelSize: 20,
          border: false,
        });
      }

      function openMenu() {
        if (openState || busy) return;
        busy = true;
        openState = true;
        menu.classList.add("is-open");
        Sound.playModalOpen();
        gsap.set(holder, { xPercent: 110 });
        gsap.to(holder, { xPercent: 0, duration: 0.8, ease: "power2.out" });
        gsap.to(backdrop, { opacity: 1, duration: 0.5, delay: 0.3 });
        setTimeout(() => {
          if (explore && !explore.__done) {
            explore.__done = true;
            scramble(explore, { duration: 1 });
          }
          links.forEach((a, i) => {
            const span = a.querySelector(".lbl") || a;
            gsap.fromTo(
              a,
              { x: 20, opacity: 0 },
              {
                x: 0,
                opacity: 1,
                duration: 0.4,
                delay: i * 0.04,
                ease: "power2.out",
              },
            );
            scramble(span, { duration: 1, delay: i * 0.04 });
          });
          footLinks.forEach((a, i) => {
            gsap.fromTo(
              a,
              { opacity: 0 },
              { opacity: 0.4, duration: 0.66, delay: i * 0.1 },
            );
          });
          busy = false;
        }, 300);
        /* hovering one link dims the rest */
        links.forEach((a) => {
          a.addEventListener("mouseenter", () => {
            links.forEach((b) => {
              if (b !== a)
                gsap.to(b, { opacity: 0.1, duration: 0.33, overwrite: "auto" });
            });
            Sound.playSecondaryHover();
          });
          a.addEventListener("mouseleave", () => {
            links.forEach((b) =>
              gsap.to(b, { opacity: 1, duration: 0.33, overwrite: "auto" }),
            );
          });
        });
      }

      function closeMenu(instant) {
        if (!openState || busy) return;
        openState = false;
        gsap.to(backdrop, { opacity: 0, duration: 0.4 });
        gsap.to(holder, {
          xPercent: 110,
          duration: instant ? 0.3 : 0.5,
          ease: "power2.in",
          onComplete: () => menu.classList.remove("is-open"),
        });
      }

      document.querySelectorAll("[data-menu-toggle]").forEach((b) => {
        b.addEventListener("click", () =>
          openState ? closeMenu() : openMenu(),
        );
      });
      if (closeBtn) closeBtn.addEventListener("click", () => closeMenu());
      if (backdrop) backdrop.addEventListener("click", () => closeMenu());
      menu.closeMenu = closeMenu;
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeMenu();
      });
      App.closeMenu = closeMenu;
    }

    /* sound toggle */
    document.querySelectorAll("[data-sound-toggle]").forEach((btn) => {
      const lbl = btn.querySelector(".lbl");
      const set = (on) => {
        if (lbl) lbl.textContent = on ? "Sound On" : "Sound Off";
      };
      btn.addEventListener("click", () => {
        Sound.setEnabled(!Sound.enabled);
        set(Sound.enabled);
      });
      document.addEventListener("sound:change", (e) => set(e.detail.on));
    });

    /* page transitions on internal links */
    const curtain = document.querySelector(".page-transition");
    if (curtain) {
      document.addEventListener("click", (e) => {
        const a = e.target.closest("a[href]");
        if (!a) return;
        const href = a.getAttribute("href");
        if (
          !href ||
          href.startsWith("#") ||
          a.target === "_blank" ||
          a.dataset.noTransition
        )
          return;
        if (href.startsWith("http") && href.indexOf(location.hostname) === -1)
          return;
        e.preventDefault();
        Sound.playTransition();
        gsap.to(curtain, {
          opacity: 1,
          duration: 0.45,
          ease: "power2.in",
          onComplete: () => (location.href = href),
        });
      });
      /* first paint of every page: lift the curtain */
      gsap.set(curtain, { opacity: 1 });
      requestAnimationFrame(() => {
        gsap.to(curtain, {
          opacity: 0,
          duration: 0.7,
          ease: "power2.out",
          delay: 0.1,
        });
      });
    }

    initScrambleOnScroll(document);
  }

  /* loader handshake — pages fire this when the intro is done */
  const loaderWaiters = [];
  App.onLoaderHidden = (fn) => {
    if (App.loaderHidden) {
      fn();
    } else {
      loaderWaiters.push(fn);
    }
  };
  App.hideLoaderDone = () => {
    App.loaderHidden = true;
    loaderWaiters.forEach((fn) => fn());
    loaderWaiters.length = 0;
  };

  /* ------------------------------------------------------------
     audio prompt — a shy chip that trails the cursor until the
     first click unlocks WebAudio
     ------------------------------------------------------------ */
  function initAudioPrompt() {
    const chip = document.querySelector(".audio-prompt");
    if (!chip || App.isTouch) return;
    let x = -100,
      y = -100,
      tx = x,
      ty = y,
      alive = false,
      dismissed = false;

    function loop() {
      x += (tx - x) * 0.1;
      y += (ty - y) * 0.1;
      chip.style.transform = `translate(${x + 18}px, ${y + 18}px)`;
      if (alive || Math.abs(tx - x) > 0.5) requestAnimationFrame(loop);
    }

    window.addEventListener("mousemove", (e) => {
      tx = e.clientX;
      ty = e.clientY;
      if (!alive && !dismissed) {
        alive = true;
        chip.classList.add("is-on");
        const ico = chip.querySelector(".a-ico");
        if (ico)
          gsap.fromTo(
            ico,
            { opacity: 0 },
            { opacity: 1, duration: 0.1, repeat: 8, yoyo: true },
          );
        const lbl = chip.querySelector(".lbl");
        if (lbl) scramble(lbl, { text: "Click for sound", duration: 1 });
        requestAnimationFrame(loop);
      }
    });

    window.addEventListener(
      "click",
      (e) => {
        if (dismissed) return;
        dismissed = true;
        /* let the sound toggle speak for itself */
        if (!(e.target.closest && e.target.closest("[data-sound-toggle]"))) {
          Sound.setEnabled(true);
        }
        setTimeout(() => {
          alive = false;
          gsap.to(chip, {
            opacity: 0,
            duration: 0.3,
            onComplete: () => chip.classList.remove("is-on"),
          });
        }, 400);
      },
      { capture: true },
    );
  }

  /* boot */
  document.addEventListener("DOMContentLoaded", () => {
    initChrome();
    initAudioPrompt();
    App.ready = true;
    document.dispatchEvent(new CustomEvent("app:ready"));
  });

  window.SKY = App;
})();
