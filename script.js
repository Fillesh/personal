const byid = (id) => document.getElementById(id);

const app = byid("app");
const nav = byid("nav");
const main = byid("main");
const art = byid("art");
const pfp = byid("pfp");
const namebox = byid("name");
const canvas = byid("bg");
const ctx = canvas.getContext("2d", { alpha: false });

namebox.textContent = data.name;
const bio = byid("bio");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarse = matchMedia("(pointer: coarse)").matches;
const ridgestep = coarse ? 8 : 5;

const typebio = () => {
  const total = data.bio.length;
  let started = -1;

  bio.classList.add("typing");

  const step = (ms) => {
    if (started < 0) {
      started = ms;
    }

    const n = Math.min(total, Math.floor((ms - started) / 18) + 1);

    bio.textContent = data.bio.slice(0, n);

    if (n < total) {
      requestAnimationFrame(step);
    } else {
      bio.classList.remove("typing");
    }
  };

  requestAnimationFrame(step);
};

if (reduced) {
  bio.textContent = data.bio;
} else {
  typebio();
}

pfp.src = data.icon;
pfp.onerror = () => pfp.classList.add("noimg");

const make = (tag, cls, txt) => {
  const el = document.createElement(tag);

  if (cls) {
    el.className = cls;
  }

  if (txt) {
    el.textContent = txt;
  }

  return el;
};

const kinds = ["heading", "text", "items"];

const place = (entry) => {
  Object.keys(entry).forEach((key) => {
    if (!kinds.includes(key)) {
      return;
    }

    const val = [].concat(entry[key]);

    if (key === "items") {
      const list = make("ul");

      val.forEach((item) => list.append(make("li", "", item)));
      art.append(list);
    } else {
      val.forEach((line) => art.append(make(key === "heading" ? "h3" : "p", "", line)));
    }
  });
};

const imgext = /\.(png|jpe?g|gif|webp|avif|svg|bmp)$/i;
const numsort = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

const nicename = (file) =>
  file
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const safedecode = (str) => {
  try {
    return decodeURIComponent(str);
  } catch (e) {
    return str;
  }
};

// local
const fromlisting = async (sec, folder) => {
  if (location.protocol === "file:") {
    throw new Error("cannot fetch from file://");
  }

  const res = await fetch(`${folder}/`, { cache: "no-cache" });

  if (!res.ok) {
    throw new Error("no listing");
  }

  const doc = new DOMParser().parseFromString(await res.text(), "text/html");

  return [...doc.querySelectorAll("a[href]")]
    .map((a) => safedecode(a.getAttribute("href").split(/[?#]/)[0].split("/").pop()))
    .filter((name) => imgext.test(name));
};

// all
const frommanifest = (sec, folder) =>
  new Promise((done, fail) => {
    const tag = document.createElement("script");

    delete window.galleryFiles;
    tag.src = `${folder}/gallery.js?v=${Date.now()}`;
    tag.onload = () => {
      tag.remove();
      done(Array.isArray(window.galleryFiles) ? window.galleryFiles.filter((n) => imgext.test(n)) : []);
    };
    tag.onerror = () => {
      tag.remove();
      fail(new Error("no manifest"));
    };
    document.head.append(tag);
  });

// GithubApi
const fromgithub = async (sec, folder, viagit) => {
  if (!viagit) {
    throw new Error("not on github");
  }

  const dirs = location.pathname.split("/").filter(Boolean);

  if (dirs.length && dirs[dirs.length - 1].includes(".")) {
    dirs.pop();
  }

  const owner = location.hostname.split(".")[0];
  const tries = [];

  if (sec.repo) {
    tries.push({ repo: sec.repo, path: folder });
  } else {
    if (dirs.length) {
      tries.push({ repo: `${owner}/${dirs[0]}`, path: [...dirs.slice(1), folder].join("/") });
    }

    tries.push({ repo: `${owner}/${owner}.github.io`, path: [...dirs, folder].join("/") });
  }

  for (const t of tries) {
    try {
      const res = await fetch(`https://api.github.com/repos/${t.repo}/contents/${t.path}`);

      if (!res.ok) {
        continue;
      }

      const names = (await res.json())
        .filter((f) => f.type === "file" && imgext.test(f.name))
        .map((f) => f.name);

      if (names.length) {
        return names;
      }
    } catch (e) {
      
    }
  }

  throw new Error("github failed");
};

const findart = async (sec, folder) => {
  const key = `gallery:${location.pathname}:${folder}`;

  try {
    const hit = JSON.parse(sessionStorage.getItem(key));

    if (hit && Date.now() - hit.t < 60000) {
      return hit.names;
    }
  } catch (e) {
    // no cache
  }

  const viagit = Boolean(sec.repo) || location.hostname.endsWith(".github.io");
  const local = location.protocol === "file:";
  const order = local ? [frommanifest] : viagit ? [fromgithub, fromlisting, frommanifest] : [fromlisting, frommanifest, fromgithub];

  for (const find of order) {
    try {
      const names = await find(sec, folder, viagit);

      if (names.length) {
        names.sort(numsort.compare);

        try {
          sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), names }));
        } catch (e) {
          // storage full
        }

        return names;
      }
    } catch (e) {
      
    }
  }

  return [];
};

let box;
let boxbg;
let boximg;
let boxcap;
let boxnum;
let boxclose;
let boxitems = [];
let boxat = 0;
let boxopener = null;

const showbox = (i) => {
  const it = boxitems[i];

  boxat = i;
  boximg.classList.remove("in");
  boximg.onload = () => boximg.classList.add("in");
  boximg.onerror = () => boximg.classList.add("in");
  boximg.alt = it.name;
  boximg.src = it.src;
  boxbg.style.backgroundImage = `url("${it.src}")`;
  boxcap.textContent = it.name;
  boxnum.textContent = `${i + 1} / ${boxitems.length}`;

  const next = boxitems[(i + 1) % boxitems.length];

  if (next) {
    new Image().src = next.src;
  }
};

const stepbox = (dir) => {
  let i = boxat;

  for (let n = 0; n < boxitems.length; n++) {
    i = (i + dir + boxitems.length) % boxitems.length;

    if (!boxitems[i].bad) {
      showbox(i);

      return;
    }
  }
};

const closebox = () => {
  box.classList.remove("show");

  if (boxopener) {
    boxopener.focus({ preventScroll: true });
  }
};

const makebox = () => {
  box = make("div", "lightbox");
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.setAttribute("aria-label", "Art viewer");

  boxbg = make("div", "lb-bg");
  boximg = make("img", "lb-img");
  boxcap = make("span", "lb-cap");
  boxnum = make("span", "lb-num");
  boxclose = make("button", "lb-btn lb-close", "×");
  boxclose.type = "button";
  boxclose.setAttribute("aria-label", "Close");

  const prev = make("button", "lb-btn lb-prev", "‹");
  const next = make("button", "lb-btn lb-next", "›");
  const stage = make("div", "lb-stage");
  const foot = make("div", "lb-foot");

  prev.type = "button";
  next.type = "button";
  prev.setAttribute("aria-label", "Previous");
  next.setAttribute("aria-label", "Next");

  stage.append(boximg);
  foot.append(boxcap, boxnum);
  box.append(boxbg, stage, foot, boxclose, prev, next);
  document.body.append(box);

  boxclose.onclick = closebox;
  prev.onclick = () => stepbox(-1);
  next.onclick = () => stepbox(1);

  box.addEventListener("click", (e) => {
    if (e.target === box || e.target === stage) {
      closebox();
    }
  });

  box.addEventListener("pointerdown", (e) => e.stopPropagation());

  let tx = 0;

  box.addEventListener(
    "touchstart",
    (e) => {
      tx = e.touches[0].clientX;
    },
    { passive: true }
  );

  box.addEventListener(
    "touchend",
    (e) => {
      const dx = e.changedTouches[0].clientX - tx;

      if (Math.abs(dx) > 50) {
        stepbox(dx < 0 ? 1 : -1);
      }
    },
    { passive: true }
  );

  document.addEventListener("keydown", (e) => {
    if (!box.classList.contains("show")) {
      return;
    }

    if (e.key === "Escape") {
      closebox();
    } else if (e.key === "ArrowRight") {
      stepbox(1);
    } else if (e.key === "ArrowLeft") {
      stepbox(-1);
    }
  });
};

const openbox = (items, i, opener) => {
  if (!box) {
    makebox();
  }

  boxitems = items;
  boxopener = opener;
  showbox(i);
  void box.offsetWidth;
  box.classList.add("show");
  boxclose.focus({ preventScroll: true });
};

const buildgallery = async (sec) => {
  const folder = sec.folder || "artgallery";
  const wrap = make("div", "gallery");
  const status = make("p", "gal-status", "Loading art...");

  wrap.append(status);
  art.append(wrap);

  const names = await findart(sec, folder);

  if (!wrap.isConnected) {
    return;
  }

  if (!names.length) {
    status.textContent = `No art found. Add images to the "${folder}" folder${
      location.protocol === "file:" ? " and run update-gallery.bat" : ""
    }.`;

    return;
  }

  const all = names.map((name) => ({
    src: `${folder}/${encodeURIComponent(name)}`,
    name: nicename(name)
  }));

  const load = async (it) => {
    const img = new Image();

    img.decoding = "async";
    img.src = it.src;

    try {
      await img.decode();
    } catch (e) {
      return false;
    }

    const nw = img.naturalWidth || 1;
    const nh = img.naturalHeight || 1;
    const k = Math.min(1, 520 / nh, 1400 / nw);
    const thumb = make("canvas");

    thumb.width = Math.max(1, Math.round(nw * k));
    thumb.height = Math.max(1, Math.round(nh * k));
    thumb.setAttribute("role", "img");
    thumb.setAttribute("aria-label", it.name);

    const g = thumb.getContext("2d");

    g.imageSmoothingQuality = "high";
    g.drawImage(img, 0, 0, thumb.width, thumb.height);

    it.ratio = nw / nh;
    it.thumb = thumb;

    return true;
  };

  const ok = [];
  let cursor = 0;

  const worker = async () => {
    while (cursor < all.length) {
      const i = cursor++;

      ok[i] = await load(all[i]);
    }
  };

  await Promise.all([worker(), worker(), worker(), worker()]);

  if (!wrap.isConnected) {
    return;
  }

  const items = all.filter((it, i) => ok[i]);

  if (!items.length) {
    status.textContent = `Could not load the images in "${folder}".`;

    return;
  }

  status.textContent = `${items.length} piece${items.length === 1 ? "" : "s"}`;

  const grid = make("div", "gal-grid");
  const tiles = items.map((it, i) => {
    const tile = make("button", "gal-tile");

    tile.type = "button";
    tile.style.setProperty("--d", `${Math.min(i, 10) * 0.05}s`);
    tile.setAttribute("aria-label", `View ${it.name}`);
    tile.onanimationend = () => {
      tile.style.animation = "none";
    };
    tile.append(it.thumb, make("span", "gal-cap", it.name));
    tile.onclick = () => openbox(items, i, tile);

    return tile;
  });

  let lastw = 0;

  const layoutrows = () => {
    const w = grid.clientWidth;

    if (!w) {
      return;
    }

    lastw = w;

    const gap = w < 520 ? 8 : 12;
    const target = w < 520 ? 130 : w < 800 ? 190 : 240;
    const rows = [];
    let row = [];
    let sum = 0;

    const emit = (last) => {
      let h = (w - gap * (row.length - 1)) / sum;

      if (last && h > target * 1.25) {
        h = target;
      }

      const box = make("div", "gal-row");

      row.forEach((i) => {
        tiles[i].style.width = `${items[i].ratio * h}px`;
        tiles[i].style.height = `${h}px`;
        box.append(tiles[i]);
      });
      rows.push(box);
      row = [];
      sum = 0;
    };

    items.forEach((it, i) => {
      row.push(i);
      sum += it.ratio;

      if (sum * target + gap * (row.length - 1) >= w) {
        emit(false);
      }
    });

    if (row.length) {
      emit(true);
    }

    grid.style.setProperty("--galgap", `${gap}px`);
    grid.replaceChildren(...rows);
  };

  wrap.append(grid);
  layoutrows();

  const watch = new ResizeObserver(() => {
    if (!grid.isConnected) {
      watch.disconnect();

      return;
    }

    if (grid.clientWidth !== lastw) {
      layoutrows();
    }
  });

  watch.observe(grid);
};

const centertab = (idx) => {
  const btn = nav.children[idx];

  if (!btn || nav.scrollWidth <= nav.clientWidth) {
    return;
  }

  nav.scrollTo({ left: btn.offsetLeft - (nav.clientWidth - btn.offsetWidth) / 2, behavior: "smooth" });
};

const opensec = (idx) => {
  const sec = data.sections[idx];

  app.className = "open";
  [...nav.children].forEach((btn, j) => btn.classList.toggle("active", j === idx));

  art.innerHTML = "";
  art.classList.toggle("wide", Boolean(sec.gallery));
  art.append(make("h2", "", sec.title));

  place(sec);

  if (sec.content) {
    sec.content.forEach(place);
  }

  if (sec.gallery) {
    buildgallery(sec);
  }

  main.scrollTop = 0;
  art.classList.remove("fade");
  void art.offsetWidth;
  art.classList.add("fade");

  centertab(idx);
  setTimeout(() => centertab(idx), 750);
};

const gohome = () => {
  app.className = "home";
  [...nav.children].forEach((btn) => btn.classList.remove("active"));
};

data.sections.forEach((sec, idx) => {
  const btn = make("button", "", sec.title);

  btn.style.setProperty("--i", idx);
  btn.onclick = () => opensec(idx);
  nav.append(btn);
});

pfp.onclick = gohome;
namebox.onclick = gohome;

const nearz = 0.5;
const farz = 26;
const gap = 0.8;
const caps = [1.5, 1, 0.75];
const tints = ["255, 240, 255", "255, 170, 240", "170, 240, 255"];
const palette = ["255, 43, 214", "45, 226, 230", "255, 240, 255"];

const ridges = [
  {
    amp: 0.1,
    shift: 0.03,
    scale: 1,
    phase: [1.3, 4.1, 2.2],
    fill: ["#2a0a62", "#12032e"],
    rgb: "255, 90, 220"
  },
  {
    amp: 0.16,
    shift: 0.07,
    scale: 1.6,
    phase: [5.2, 0.7, 3.4],
    fill: ["#160440", "#07011a"],
    rgb: "45, 226, 230"
  }
];

const pics = {};
const files = ["back", "sun", "refl", "spot", "glow"];

const stars = [];
const ripples = [];
const sparks = [];
const rings = [];
const streaks = [];

let cw;
let ch;
let dpr;
let horizon;
let vanish;
let focal;
let sunr;
let backbuf;
let sunbuf;
let reflbuf;
let spotbuf;
let glowbuf;
let soft;
let crisp;
let rails;
let railkey = "";
let pending = 0;
let time = 0;
let clock = 0;
let frames = 0;
let tier = 0;
let avg = 0.016;
let lastadapt = 0;
let nextstreak = 2;
let lastwake = 0;
let smoothx = 0.5;
let smoothy = 0.5;
let mousex = 0.5;
let mousey = 0.5;
let pointerx = -1000;
let pointery = -1000;
let wakex = -1000;
let wakey = -1000;
let px = 0;
let py = 0;
let ph = 0;

const intro = { sky: 1, stars: 1, sun: 1, glow: 1, line: 1, ridge: 1, floor: 1 };

const ramp = (t, start, dur) => {
  const p = Math.min(1, Math.max(0, (t - start) / dur));

  return 1 - (1 - p) ** 3;
};

const setintro = (t) => {
  intro.sky = ramp(t, 0, 0.8);
  intro.stars = ramp(t, 0.3, 1);
  intro.sun = ramp(t, 0.5, 1.4);
  intro.glow = ramp(t, 0.6, 1.4);
  intro.ridge = ramp(t, 0.8, 1.1);
  intro.line = ramp(t, 0.9, 0.8);
  intro.floor = ramp(t, 1, 1.3);
};

const put = (buf, x, y, w = buf.lw, h = buf.lh) => {
  if (buf.naturalWidth === 0) {
    return;
  }

  ctx.drawImage(buf, x, y, w, h);
};

const layout = () => {
  vanish = cw * (0.5 + (smoothx - 0.5) * 0.25);
};

const setsize = () => {
  dpr = Math.min(devicePixelRatio || 1, caps[tier]);
  cw = canvas.clientWidth || innerWidth;
  ch = canvas.clientHeight || innerHeight;
  canvas.width = Math.ceil(cw * dpr);
  canvas.height = Math.ceil(ch * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  horizon = Math.round(ch * 0.55);
  focal = ch - horizon;
  sunr = Math.min(cw, ch) * (cw < ch ? 0.3 : 0.2);
  railkey = "";
  layout();

  const halor = sunr * 2.8;

  backbuf = pics.back;
  backbuf.lw = cw;
  backbuf.lh = ch;

  sunbuf = pics.sun;
  sunbuf.lw = halor * 2;
  sunbuf.lh = halor * 2;

  reflbuf = pics.refl;
  reflbuf.lw = sunr * 3.4;
  reflbuf.lh = sunr * 0.6;

  spotbuf = pics.spot;
  spotbuf.lw = 128;
  spotbuf.lh = 128;

  glowbuf = pics.glow;
  glowbuf.lw = cw;
  glowbuf.lh = ch * 0.24;

  soft = ctx.createLinearGradient(0, horizon, 0, ch);
  soft.addColorStop(0, "rgba(255, 60, 220, 0.05)");
  soft.addColorStop(0.15, "rgba(255, 60, 220, 0.2)");
  soft.addColorStop(1, "rgba(255, 60, 220, 0.3)");

  crisp = ctx.createLinearGradient(0, horizon, 0, ch);
  crisp.addColorStop(0, "rgba(255, 110, 235, 0.2)");
  crisp.addColorStop(0.15, "rgba(255, 110, 235, 0.65)");
  crisp.addColorStop(1, "rgba(255, 110, 235, 1)");

  ridges.forEach((layer) => {
    layer.tall = ch * layer.amp;
    layer.shade = ctx.createLinearGradient(0, horizon - layer.tall, 0, horizon);
    layer.shade.addColorStop(0, layer.fill[0]);
    layer.shade.addColorStop(1, layer.fill[1]);
  });

  stars.length = 0;

  const count = Math.min(180, Math.floor((cw * ch) / 9000));

  for (let i = 0; i < count; i++) {
    const tint = tints[Math.floor(Math.random() * tints.length)];

    stars.push({
      x: Math.random() * cw,
      y: Math.random() * horizon,
      r: Math.random() * 1.3 + 0.4,
      tw: Math.random(),
      depth: Math.random() * 0.8 + 0.2,
      color: `rgb(${tint})`,
      ox: 0,
      oy: 0,
      vx: 0,
      vy: 0
    });
  }
};

const heightat = (wx, z) => {
  let h = 0;

  for (let i = 0; i < ripples.length; i++) {
    const rip = ripples[i];
    const dx = wx - rip.wx;
    const dz = z - rip.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const off = dist - rip.front;

    if (off > 4.5 || off < -4.5) {
      continue;
    }

    h += (rip.gain * Math.cos(off * 2.6) * Math.exp(-off * off * 0.35)) / (1 + dist * 0.12);
  }

  return h;
};

const project = (wx, z) => {
  ph = heightat(wx, z);
  px = vanish + (wx * focal) / z;
  py = horizon + (focal * (1 - ph)) / z;
};

const addripple = (wx, z, amp) => {
  ripples.push({ wx, z, amp, born: time, front: 0, gain: amp });

  if (ripples.length > 8) {
    ripples.shift();
  }
};

const burst = (x, y, count, up) => {
  if (up) {
    rings.push({ x, y, life: 1, rate: 1.6, base: 12, reach: 120, glow: true, rgb: "255, 90, 220" });
    rings.push({ x, y, life: 1, rate: 2.6, base: 6, reach: 60, glow: false, rgb: "45, 226, 230" });
  }

  for (let i = 0; i < count; i++) {
    const angle = up ? -Math.PI * (0.08 + Math.random() * 0.84) : (i / count) * Math.PI * 2 + Math.random() * 0.3;
    const speed = 140 + Math.random() * 320;

    sparks.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      fade: 1.3 + Math.random() * 0.9,
      rgb: palette[Math.floor(Math.random() * palette.length)]
    });
  }

  if (sparks.length > 120) {
    sparks.splice(0, sparks.length - 120);
  }

  if (rings.length > 8) {
    rings.splice(0, rings.length - 8);
  }
};

const peakat = (x, phase) => {
  const a = 1 - Math.abs(Math.sin(x * 0.0045 + phase[0]));
  const b = 1 - Math.abs(Math.sin(x * 0.0123 + phase[1]));
  const c = 1 - Math.abs(Math.sin(x * 0.031 + phase[2]));

  return a * 0.55 + b * 0.3 + c * 0.15;
};

const drawstars = (dt) => {
  const k = dt * 60;

  stars.forEach((star) => {
    const sx = star.x + (smoothx - 0.5) * 40 * star.depth + star.ox;
    const sy = star.y + (smoothy - 0.5) * 16 * star.depth + star.oy;
    const dx = sx - pointerx;
    const dy = sy - pointery;
    const dist = Math.hypot(dx, dy) || 1;

    if (dist < 130) {
      const push = (1 - dist / 130) * 1.6 * k;

      star.vx += (dx / dist) * push;
      star.vy += (dy / dist) * push;
    }

    star.vx -= star.ox * 0.03 * k;
    star.vy -= star.oy * 0.03 * k;
    star.vx *= 0.9 ** k;
    star.vy *= 0.9 ** k;
    star.ox += star.vx * k;
    star.oy += star.vy * k;

    if (sy > horizon) {
      return;
    }

    const glow = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * (1.2 + star.tw * 2) + star.tw * 40));

    ctx.fillStyle = star.color;
    ctx.globalAlpha = glow * intro.stars;
    ctx.beginPath();
    ctx.arc(sx, sy, star.r, 0, Math.PI * 2);
    ctx.fill();

    if (star.r > 1.3) {
      ctx.globalAlpha = glow * 0.14 * intro.stars;
      ctx.beginPath();
      ctx.arc(sx, sy, star.r * 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  ctx.globalAlpha = 1;
};

const drawstreaks = (dt) => {
  if (time > nextstreak) {
    const dir = Math.random() < 0.5 ? 1 : -1;

    streaks.push({
      x: Math.random() * cw,
      y: Math.random() * horizon * 0.5,
      vx: dir * (500 + Math.random() * 400),
      vy: 180 + Math.random() * 160,
      life: 1
    });
    nextstreak = time + 3 + Math.random() * 6;
  }

  if (!streaks.length) {
    return;
  }

  ctx.globalCompositeOperation = "lighter";
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";

  for (let i = streaks.length - 1; i >= 0; i--) {
    const s = streaks[i];

    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.life -= dt * 0.9;

    if (s.life <= 0) {
      streaks.splice(i, 1);
      continue;
    }

    const tailx = s.x - s.vx * 0.14;
    const taily = s.y - s.vy * 0.14;
    const trail = ctx.createLinearGradient(s.x, s.y, tailx, taily);

    trail.addColorStop(0, `rgba(255, 255, 255, ${s.life})`);
    trail.addColorStop(1, "rgba(120, 200, 255, 0)");
    ctx.strokeStyle = trail;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(tailx, taily);
    ctx.stroke();
  }

  ctx.globalCompositeOperation = "source-over";
};

const drawsun = () => {
  const suny = horizon - sunr * 0.5 + (1 - intro.sun) * sunr * 1.7;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, cw, horizon);
  ctx.clip();
  ctx.globalAlpha = Math.min(1, intro.sun * 1.5);
  put(sunbuf, vanish - sunbuf.lw / 2, suny - sunbuf.lh / 2);
  ctx.restore();
};

const drawridges = () => {
  ridges.forEach((layer) => {
    const shift = (smoothx - 0.5) * cw * layer.shift;
    const spread = cw < 700 ? 1.8 : 1;
    const body = new Path2D();
    const edge = new Path2D();

    body.moveTo(0, horizon + 2);

    for (let x = 0; x <= cw + 5; x += ridgestep) {
      const v = Math.min(1, Math.abs(x - vanish) / (cw * 0.3));
      const y = horizon - layer.tall * intro.ridge * peakat(x * layer.scale * spread + shift, layer.phase) * (0.1 + 0.9 * v * v);

      body.lineTo(x, y);

      if (x === 0) {
        edge.moveTo(x, y);
      } else {
        edge.lineTo(x, y);
      }
    }

    body.lineTo(cw + 5, horizon + 2);
    body.closePath();

    ctx.fillStyle = layer.shade;
    ctx.fill(body);

    ctx.lineJoin = "round";
    ctx.lineWidth = 6;
    ctx.strokeStyle = `rgba(${layer.rgb}, 0.18)`;
    ctx.stroke(edge);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = `rgba(${layer.rgb}, 0.8)`;
    ctx.stroke(edge);
  });
};

const drawfloor = () => {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, horizon - 4, cw, (ch - horizon) * intro.floor + 4);
  ctx.clip();

  ctx.globalCompositeOperation = "lighter";
  put(reflbuf, vanish - reflbuf.lw / 2, horizon - reflbuf.lh / 2);

  if (pointery > horizon) {
    const rad = 60 + ((pointery - horizon) / focal) * 160;

    put(spotbuf, pointerx - rad, pointery - rad * 0.3, rad * 2, rad * 0.6);
  }

  const grid = new Path2D();
  const hot = new Path2D();
  const live = ripples.length > 0;
  const lit = 0.06;
  const steps = 16;
  const cols = 28;
  const extent = Math.max(vanish, cw - vanish) + 60;
  const span = Math.ceil((farz * extent) / focal / gap) + 1;

  if (live) {
    for (let i = -span; i <= span; i++) {
      const wx = i * gap;
      const first = Math.max(nearz, (Math.abs(wx) * focal * 0.9) / extent);

      if (first >= farz) {
        continue;
      }

      let ox = 0;
      let oy = 0;
      let oh = 0;
      let cur = null;

      for (let j = 0; j <= steps; j++) {
        const z = first * (farz / first) ** (j / steps);

        project(wx, z);

        if (j > 0) {
          const target = Math.abs(ph) + Math.abs(oh) > lit ? hot : grid;

          if (target !== cur) {
            target.moveTo(ox, oy);
            cur = target;
          }

          target.lineTo(px, py);
        }

        ox = px;
        oy = py;
        oh = ph;
      }
    }
  } else {
    const key = `${Math.round(vanish * 2)}|${cw}|${ch}`;

    if (key !== railkey) {
      rails = new Path2D();

      for (let i = -span; i <= span; i++) {
        const wx = i * gap;
        const first = Math.max(nearz, (Math.abs(wx) * focal * 0.9) / extent);

        if (first >= farz) {
          continue;
        }

        rails.moveTo(vanish + (wx * focal) / first, horizon + focal / first);
        rails.lineTo(vanish + (wx * focal) / farz, horizon + focal / farz);
      }

      railkey = key;
    }

    grid.addPath(rails);
  }

  const scroll = (time * 1.6) % 1;

  for (let k = 0; ; k++) {
    const z = nearz + k + 1 - scroll;

    if (z > 16) {
      break;
    }

    if (!live) {
      const y = horizon + focal / z;

      grid.moveTo(-40, y);
      grid.lineTo(cw + 40, y);
      continue;
    }

    let ox = 0;
    let oy = 0;
    let oh = 0;
    let cur = null;

    for (let c = 0; c <= cols; c++) {
      const sx = (c / cols) * (cw + 80) - 40;

      project(((sx - vanish) * z) / focal, z);

      if (c > 0) {
        const target = Math.abs(ph) + Math.abs(oh) > lit ? hot : grid;

        if (target !== cur) {
          target.moveTo(ox, oy);
          cur = target;
        }

        target.lineTo(px, py);
      }

      ox = px;
      oy = py;
      oh = ph;
    }
  }

  ctx.lineCap = "butt";

  if (tier < 2) {
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = soft;
    ctx.stroke(grid);
  }

  ctx.lineWidth = 1.3;
  ctx.strokeStyle = crisp;
  ctx.stroke(grid);

  if (live) {
    if (tier < 2) {
      ctx.lineWidth = 5;
      ctx.strokeStyle = "rgba(45, 226, 230, 0.35)";
      ctx.stroke(hot);
    }

    ctx.lineWidth = 1.6;
    ctx.strokeStyle = "rgba(200, 255, 255, 0.95)";
    ctx.stroke(hot);
  }

  ctx.beginPath();
  ctx.moveTo(cw / 2 - (cw / 2) * intro.line, horizon);
  ctx.lineTo(cw / 2 + (cw / 2) * intro.line, horizon);
  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(45, 226, 230, 0.3)";
  ctx.stroke();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = "rgba(45, 226, 230, 0.95)";
  ctx.stroke();

  ctx.restore();
};

const drawsparks = (dt) => {
  if (!sparks.length && !rings.length) {
    return;
  }

  const k = dt * 60;

  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";

  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];

    r.life -= dt * r.rate;

    if (r.life <= 0) {
      rings.splice(i, 1);
      continue;
    }

    const e = 1 - r.life ** 3;
    const rad = r.base + e * r.reach;
    const squash = 0.32;

    if (r.glow) {
      const g = 70 + e * 40;

      ctx.globalAlpha = r.life * r.life;
      put(spotbuf, r.x - g, r.y - g * squash, g * 2, g * 2 * squash);
      ctx.globalAlpha = 1;
    }

    ctx.beginPath();
    ctx.ellipse(r.x, r.y, rad, rad * squash, 0, 0, Math.PI * 2);
    ctx.lineWidth = 2 + 7 * r.life;
    ctx.strokeStyle = `rgba(${r.rgb}, ${0.25 * r.life})`;
    ctx.stroke();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = `rgba(255, 245, 255, ${0.9 * r.life})`;
    ctx.stroke();
  }

  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];

    s.vy += 360 * dt;
    s.vx *= 0.94 ** k;
    s.vy *= 0.94 ** k;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.life -= dt * s.fade;

    if (s.life <= 0) {
      sparks.splice(i, 1);
      continue;
    }

    ctx.beginPath();
    ctx.moveTo(s.x - s.vx * 0.05, s.y - s.vy * 0.05);
    ctx.lineTo(s.x, s.y);
    ctx.lineWidth = 0.8 + 2.4 * s.life;
    ctx.strokeStyle = `rgba(${s.rgb}, ${s.life})`;
    ctx.stroke();
  }

  ctx.globalCompositeOperation = "source-over";
};

const scene = (dt) => {
  if (intro.sky < 1 || backbuf.naturalWidth === 0) {
    ctx.fillStyle = "#03010c";
    ctx.fillRect(0, 0, cw, ch);
  }

  ctx.globalAlpha = intro.sky;
  put(backbuf, 0, 0);
  ctx.globalAlpha = 1;

  const scany = horizon + (ch - horizon) * intro.floor;

  if (intro.floor < 1) {
    ctx.fillStyle = "#05010f";
    ctx.fillRect(0, scany, cw, ch);
  }

  drawstars(dt);
  drawstreaks(dt);
  drawsun();
  drawridges();
  drawfloor();

  if (intro.floor < 1 && intro.floor > 0) {
    ctx.globalCompositeOperation = "lighter";
    ctx.beginPath();
    ctx.moveTo(0, scany);
    ctx.lineTo(cw, scany);
    ctx.lineWidth = 10;
    ctx.strokeStyle = "rgba(45, 226, 230, 0.25)";
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(200, 255, 255, 0.9)";
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  }

  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = intro.glow;
  put(glowbuf, 0, horizon - ch * 0.2);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";

  drawsparks(dt);
};

const calm = () => app.className === "open" && art.classList.contains("wide");

const draw = (ms) => {
  const now = ms / 1000;

  if (frames > 0 && ((box && box.classList.contains("show")) || (calm() && now - time < 0.03))) {
    requestAnimationFrame(draw);

    return;
  }

  const raw = now - time;
  const dt = Math.min(0.04, Math.max(0, raw));

  time = now;
  smoothx += (mousex - smoothx) * 0.06;
  smoothy += (mousey - smoothy) * 0.06;
  layout();

  for (let i = ripples.length - 1; i >= 0; i--) {
    if (ripples[i].amp * Math.exp(-(time - ripples[i].born) * 0.55) < 0.004) {
      ripples.splice(i, 1);
    }
  }

  ripples.forEach((rip) => {
    const age = time - rip.born;

    rip.front = age * 7;
    rip.gain = rip.amp * Math.exp(-age * 0.55);
  });

  if (frames === 0) {
    setintro(99);
    scene(0);
    ctx.fillStyle = "#03010c";
    ctx.fillRect(0, 0, cw, ch);
    frames = 1;
    requestAnimationFrame(draw);

    return;
  }

  clock += dt;

  if (clock > 3 && tier < caps.length - 1 && !calm()) {
    avg += (Math.min(raw, 0.1) - avg) * 0.04;

    if (avg > 0.024 && time - lastadapt > 2) {
      tier++;
      avg = 0.016;
      lastadapt = time;
      setsize();
    }
  }

  setintro(reduced ? 99 : clock);
  scene(dt);

  requestAnimationFrame(draw);
};

addEventListener("resize", () => {
  cancelAnimationFrame(pending);
  pending = requestAnimationFrame(() => {
    if (canvas.clientWidth === cw && (canvas.clientHeight || innerHeight) === ch) {
      return;
    }

    setsize();
  });
});

addEventListener("pointermove", (e) => {
  pointerx = e.clientX;
  pointery = e.clientY;
  mousex = pointerx / cw;
  mousey = pointery / ch;

  if (pointery > horizon + 8 && time - lastwake > 0.2 && Math.hypot(pointerx - wakex, pointery - wakey) > 110) {
    const z = focal / (pointery - horizon);

    lastwake = time;
    wakex = pointerx;
    wakey = pointery;
    addripple(((pointerx - vanish) * z) / focal, z, 0.05 + z * 0.004);
  }
});

const release = (e) => {
  if (e.pointerType === "mouse") {
    return;
  }

  setTimeout(() => {
    pointerx = -1000;
    pointery = -1000;
  }, 350);
};

addEventListener("pointerup", release);
addEventListener("pointercancel", release);

document.documentElement.addEventListener("pointerleave", () => {
  pointerx = -1000;
  pointery = -1000;
});

addEventListener("pointerdown", (e) => {
  if (e.target.closest("#side, #art")) {
    return;
  }

  if (e.pointerType !== "mouse" && e.target.closest("#main")) {
    return;
  }

  pointerx = e.clientX;
  pointery = e.clientY;
  mousex = pointerx / cw;
  mousey = pointery / ch;

  if (e.clientY > horizon + 4) {
    const z = focal / (e.clientY - horizon);

    addripple(((e.clientX - vanish) * z) / focal, z, 0.14 + z * 0.012);
    burst(e.clientX, e.clientY, 10, true);
  } else {
    burst(e.clientX, e.clientY, 14, false);
  }
});

Promise.all(
  files.map(
    (name) =>
      new Promise((done) => {
        const img = new Image();

        pics[name] = img;
        img.src = `bgstuff/${name}.png`;
        img.decode().then(done, done);
      })
  )
).then(() => {
  setsize();
  requestAnimationFrame(draw);
});
