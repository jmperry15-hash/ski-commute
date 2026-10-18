// Decorative night-sky mountain scene behind the hero (pure SVG, no images to load).
// Ridgelines are generated with "midpoint displacement" (a classic way to fake natural
// terrain), using a fixed random seed so the server and browser draw the same picture.

const W = 1440;
const H = 340;

type Pt = [number, number];

// Tiny deterministic random number generator (same output every time).
function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

// Build a natural-looking ridgeline: start with a few anchor heights, then repeatedly
// add midpoints nudged up/down by a shrinking random amount.
function ridge(anchors: number[], roughness: number, seed: number, levels = 6): Pt[] {
  const rand = seeded(seed);
  let ys = anchors;
  let amp = roughness;
  for (let l = 0; l < levels; l++) {
    const next: number[] = [];
    for (let i = 0; i < ys.length - 1; i++) {
      next.push(ys[i], (ys[i] + ys[i + 1]) / 2 + (rand() - 0.5) * amp);
    }
    next.push(ys[ys.length - 1]);
    ys = next;
    amp *= 0.52;
  }
  return ys.map((y, i) => [(i / (ys.length - 1)) * W, y]);
}

const toPath = (pts: Pt[]) => `M0 ${H} L${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L")} L${W} ${H} Z`;

// Everything above a wobbly snowline (later clipped to the mountain shape).
function snowField(snowline: number, seed: number) {
  const rand = seeded(seed);
  let d = `M0 0 L${W} 0`;
  for (let x = W; x >= 0; x -= 24) d += ` L${x} ${Math.round(snowline + (rand() - 0.5) * 34)}`;
  return d + " Z";
}

// Pine-tree silhouettes along a gentle hill.
function treeline(baseY: number, seed: number, step = 9) {
  const rand = seeded(seed);
  let d = `M0 ${H} L0 ${baseY}`;
  for (let x = 0; x <= W; x += step) {
    // rounded so the server and browser produce identical numbers
    const hill = Math.round(baseY - 16 * Math.sin(x / 230) - 9 * Math.sin(x / 83 + 1));
    const h = Math.round(8 + rand() * 24);
    d += ` L${x} ${hill} L${x + step / 2} ${hill - h} L${x + step} ${hill}`;
  }
  return d + ` L${W} ${H} Z`;
}

// Anchor heights (smaller = taller). The big massif sits on the right, away from the headline.
const FAR = ridge([175, 130, 150, 100, 125, 45, 95], 70, 3);
const MID = ridge([235, 200, 185, 205, 160, 70, 130, 185], 90, 17);
const MID_LIT = MID.map(([x, y]): Pt => [x, y + 2]); // thin rim-light edge
// A copy of each ridge nudged right/down: where it overlaps the real ridge we paint shadow,
// leaving the left-facing slopes lit by the moon. Gives the peaks a 3D, sculpted look.
const shade = (pts: Pt[], dx: number, dy: number) => pts.map(([x, y]): Pt => [x + dx, y + dy]);

const starRand = seeded(42);
const STARS = Array.from({ length: 140 }, () => ({
  x: starRand() * 100,
  y: starRand() * 70,
  r: starRand() < 0.1 ? 1.5 : 0.5 + starRand() * 0.7,
  o: 0.2 + starRand() * 0.65,
}));

export default function Mountains() {
  return (
    <div className="scene" aria-hidden>
      {/* Stars + moon fill the whole hero */}
      <svg className="sky">
        {STARS.map((s, i) => (
          <circle key={i} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill="#fff" opacity={s.o} />
        ))}
      </svg>
      <div className="moon" />

      {/* Mountains hug the bottom of the hero */}
      <svg className="ridges" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="mt-far" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5f80b3" />
            <stop offset="0.7" stopColor="#1f3557" />
          </linearGradient>
          <linearGradient id="mt-mid" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#36558a" />
            <stop offset="0.5" stopColor="#1b2f52" />
            <stop offset="1" stopColor="#0c1730" />
          </linearGradient>
          <linearGradient id="mt-snow" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.6" stopColor="#d6e4f7" />
            <stop offset="1" stopColor="#8ea8cc" />
          </linearGradient>
          <linearGradient id="valley-mist" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5b86c4" stopOpacity="0" />
            <stop offset="1" stopColor="#5b86c4" stopOpacity="0.22" />
          </linearGradient>
          <clipPath id="clip-far">
            <path d={toPath(FAR)} />
          </clipPath>
          <clipPath id="clip-mid">
            <path d={toPath(MID)} />
          </clipPath>
        </defs>

        <path d={toPath(FAR)} fill="url(#mt-far)" opacity="0.6" />
        <path d={snowField(100, 5)} fill="url(#mt-snow)" opacity="0.5" clipPath="url(#clip-far)" />
        <path d={toPath(shade(FAR, 16, 5))} fill="#0e1b33" opacity="0.4" clipPath="url(#clip-far)" />
        <rect x="0" y="150" width={W} height="120" fill="url(#valley-mist)" />

        <path d={toPath(MID_LIT)} fill="none" stroke="#9cc3ff" strokeOpacity="0.25" strokeWidth="1.5" />
        <path d={toPath(MID)} fill="url(#mt-mid)" />
        <path d={snowField(132, 9)} fill="url(#mt-snow)" opacity="0.95" clipPath="url(#clip-mid)" />
        <path d={toPath(shade(MID, 22, 6))} fill="#0b1630" opacity="0.5" clipPath="url(#clip-mid)" />
        <rect x="0" y="200" width={W} height="100" fill="url(#valley-mist)" />

        <path d={treeline(282, 7)} fill="#0b1426" />
        <path d={treeline(318, 11, 11)} fill="var(--bg-base)" />
      </svg>

      <div className="snow snow-1" />
      <div className="snow snow-2" />
    </div>
  );
}
