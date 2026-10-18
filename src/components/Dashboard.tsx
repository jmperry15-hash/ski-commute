"use client";
// The main dashboard. Runs in the browser: it holds the address you typed,
// calls our own /api/commute endpoint, and renders the results + map.
import { useCallback, useEffect, useState } from "react";
import { APIProvider } from "@vis.gl/react-google-maps";
import AddressInput from "./AddressInput";
import Mountains from "./Mountains";
import ResortMap from "./ResortMap";
import { BROWSER_KEY } from "@/lib/config";
import { RESORTS } from "@/lib/resorts";
import type { CommuteResponse, ResortCommute } from "@/lib/types";
import { delayLevel, formatDuration, formatMiles, timeAgo } from "@/lib/format";

const ADDRESS_KEY = "skiCommute.address";
const LAST_RESULT_KEY = "skiCommute.lastResult";
const REUSE_SAVED_MS = 10 * 60 * 1000; // on page load, reuse results younger than 10 min
const REFRESH_COOLDOWN_MS = 30 * 1000; // stop accidental rapid-fire refresh clicks

// localStorage can throw (private browsing, blocked storage), so wrap it.
function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export default function Dashboard() {
  const [input, setInput] = useState("");
  const [address, setAddress] = useState(""); // the address the current results are for
  const [data, setData] = useState<CommuteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lastFetchAt, setLastFetchAt] = useState(0);
  const [now, setNow] = useState(0); // current time; set in the browser (the server pre-renders without a clock)

  // Tick once a second so "updated 3 min ago" and the cooldown stay current.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchCommutes = useCallback(async (addr: string) => {
    setLoading(true);
    setError(null);
    const startedAt = Date.now();
    setLastFetchAt(startedAt);
    setNow(startedAt);
    try {
      const res = await fetch("/api/commute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addr }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Request failed");
      setNow(Date.now());
      setData(json);
      setAddress(addr);
      save(ADDRESS_KEY, addr);
      save(LAST_RESULT_KEY, { address: addr, data: json });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, []);

  // On first load: restore your saved address. If the saved results are fresh,
  // show them without calling Google at all; otherwise fetch once.
  useEffect(() => {
    const savedAddress = load<string>(ADDRESS_KEY);
    if (!savedAddress) return;
    // localStorage only exists in the browser, so this one-time restore has to run
    // after the first render (doing it earlier would mismatch the server HTML).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInput(savedAddress);
    const last = load<{ address: string; data: CommuteResponse }>(LAST_RESULT_KEY);
    const fresh = last && last.address === savedAddress && Date.now() - new Date(last.data.fetchedAt).getTime() < REUSE_SAVED_MS;
    if (fresh) {
      setNow(Date.now());
      setData(last.data);
      setAddress(savedAddress);
    } else {
      fetchCommutes(savedAddress);
    }
  }, [fetchCommutes]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const addr = input.trim();
    if (addr) fetchCommutes(addr);
  };

  const cooldownLeft = lastFetchAt ? Math.max(0, Math.ceil((lastFetchAt + REFRESH_COOLDOWN_MS - now) / 1000)) : 0;
  const canRefresh = !!address && !loading && cooldownLeft === 0;

  const results = data?.results ?? [];
  const routed = results.filter((r) => r.ok);
  const mapPoints = results.length
    ? results.map((r, i) => ({ ...r, rank: r.ok ? i + 1 : undefined }))
    : RESORTS;

  const maxDuration = Math.max(1, ...routed.map((r) => r.durationSec));

  const page = (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <LogoMark />
          <div>
            <div className="brand-name">Ski Commute</div>
            <div className="brand-sub">Colorado · 10 resorts</div>
          </div>
        </div>
        <div className="header-actions">
          {data && (
            <span className="updated">
              <span className="live-dot" />
              <span className="updated-text">Updated {timeAgo(data.fetchedAt, now)}</span>
            </span>
          )}
          <button
            className="btn btn-ghost"
            onClick={() => fetchCommutes(address)}
            disabled={!canRefresh}
            title={cooldownLeft ? `Available in ${cooldownLeft}s` : "Get updated drive times"}
          >
            <span className={loading ? "spin" : ""}>↻</span>
            {loading ? "Refreshing" : cooldownLeft ? `${cooldownLeft}s` : "Refresh"}
          </button>
        </div>
      </header>

      <section className="hero">
        <Mountains />
        <div className="hero-inner">
          <p className="eyebrow">
            Live traffic<span className="eyebrow-extra"> · Front Range to High Country</span>
          </p>
          <h1 className="hero-title">
            Which mountain is <span className="hero-accent">closest</span> right now?
          </h1>
          <p className="hero-sub">Real-time drive times from your door to 10 Colorado ski resorts.</p>

          <form className="search" onSubmit={onSubmit}>
            <label className="search-label" htmlFor="address">
              Starting point
            </label>
            <div className="address-row">
              <AddressInput value={input} onChange={setInput} onPick={fetchCommutes} hasBrowserKey={!!BROWSER_KEY} />
              <button className="btn btn-primary" type="submit" disabled={loading || !input.trim()}>
                Get drive times
              </button>
            </div>
            {data && !data.demo && (
              <div className="search-caption">
                <span className="home-chip">⌂</span> Routing from {data.origin.address}
              </div>
            )}
          </form>
        </div>
      </section>

      <main className="dash-body">
        {data?.demo && (
          <div className="banner banner-amber">
            <strong>Demo data.</strong> No <code>GOOGLE_MAPS_API_KEY</code> is set, so these are sample times from
            downtown Denver. Add your key to see live traffic (see README).
          </div>
        )}
        {error && <div className="banner banner-red">{error}</div>}

        {routed.length > 0 && <KpiRow results={routed} />}

        <div className="content-grid">
          <section className="card map-card" aria-label="Map of resorts">
            <ResortMap
              origin={data?.origin}
              resorts={mapPoints}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </section>

          <section className="list" aria-label="Resorts sorted by drive time">
            <div className="list-head">
              <h2 className="section-title">Fastest first</h2>
              <TrailLegend />
            </div>
            {!data && loading && <SkeletonList />}
            {!data && !loading && (
              <div className="card empty">
                <svg className="empty-icon" viewBox="0 0 64 40" aria-hidden>
                  <path d="M2 38 L22 10 L30 20 L40 4 L62 38 Z" fill="currentColor" opacity="0.35" />
                  <path d="M36 10 L40 4 L44 10 L41 9 L39 11 Z M18 16 L22 10 L26 16 L23 15 L21 17 Z" fill="currentColor" />
                </svg>
                <p>Enter your address to see who&apos;s closest.</p>
              </div>
            )}
            {results.map((r, i) => (
              <ResortCard
                key={r.id}
                resort={r}
                rank={i + 1}
                maxDuration={maxDuration}
                origin={data!.origin}
                selected={r.id === selectedId}
                dim={loading}
                onSelect={() => setSelectedId(r.id)}
              />
            ))}
          </section>
        </div>

        <footer className="footer">
          Drive times from Google Routes API with live traffic · each refresh checks all 10 resorts
        </footer>
      </main>
    </div>
  );

  // APIProvider loads Google's map script once, for both the map and the address suggestions.
  return BROWSER_KEY ? <APIProvider apiKey={BROWSER_KEY}>{page}</APIProvider> : page;
}

function LogoMark() {
  return (
    <svg className="logo" viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="url(#logo-bg)" />
      <defs>
        <linearGradient id="logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <path d="M4 25 L13 11 L17 17 L21 9 L28 25 Z" fill="#0b1426" opacity="0.55" />
      <path d="M19 12.5 L21 9 L23.2 13 L21.6 12.2 L20.4 13.4 Z M11.4 13.6 L13 11 L14.6 13.6 L13.2 13 Z" fill="#fff" />
    </svg>
  );
}

// Ski-trail difficulty shapes, reused for traffic levels.
function TrailIcon({ tone }: { tone: "green" | "blue" | "black" }) {
  return <span className={`trail trail-${tone}`} aria-hidden />;
}

function TrailLegend() {
  return (
    <div className="legend" aria-label="Traffic legend">
      <span>
        <TrailIcon tone="green" /> Light
      </span>
      <span>
        <TrailIcon tone="blue" /> Moderate
      </span>
      <span>
        <TrailIcon tone="black" /> Heavy
      </span>
    </div>
  );
}

function KpiRow({ results }: { results: ResortCommute[] }) {
  const fastest = results[0];
  const avgDelay = results.reduce((s, r) => s + r.delaySec, 0) / results.length;
  const worst = results.reduce((a, b) => (b.delaySec > a.delaySec ? b : a));
  const avgLevel = delayLevel(avgDelay);
  const worstLevel = delayLevel(worst.delaySec);
  return (
    <div className="kpi-row">
      <div className="ticket ticket-hero">
        <div className="kpi-label">Fastest right now</div>
        <div className="kpi-value">{formatDuration(fastest.durationSec)}</div>
        <div className="kpi-sub">
          <span className="kpi-strong">{fastest.name}</span> · {formatMiles(fastest.distanceMeters)}
        </div>
      </div>
      <div className="ticket">
        <div className="kpi-label">Avg traffic delay</div>
        <div className="kpi-value">
          +{formatDuration(avgDelay)} <TrailIcon tone={avgLevel.tone} />
        </div>
        <div className="kpi-sub">{avgLevel.label} across {results.length} resorts</div>
      </div>
      <div className="ticket">
        <div className="kpi-label">Worst traffic</div>
        <div className="kpi-value">
          +{formatDuration(worst.delaySec)} <TrailIcon tone={worstLevel.tone} />
        </div>
        <div className="kpi-sub">{worst.delaySec >= 60 ? worst.name : "No delays right now"}</div>
      </div>
    </div>
  );
}

function ResortCard({
  resort: r,
  rank,
  maxDuration,
  origin,
  selected,
  dim,
  onSelect,
}: {
  resort: ResortCommute;
  rank: number;
  maxDuration: number;
  origin: { lat: number; lng: number };
  selected: boolean;
  dim: boolean;
  onSelect: () => void;
}) {
  // Opening Google Maps directions via a link is free — no API call.
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${r.lat},${r.lng}&travelmode=driving`;

  if (!r.ok) {
    return (
      <div className="card resort-card unavailable">
        <div className="rank">–</div>
        <div className="resort-main">
          <div className="resort-name">{r.name}</div>
          <div className="resort-meta">No driving route found</div>
        </div>
      </div>
    );
  }

  const level = delayLevel(r.delaySec);
  const summitFt = r.summitFt ?? RESORTS.find((x) => x.id === r.id)?.summitFt ?? 0;
  // Bar = normal drive time (ice blue) + traffic delay (orange), scaled to the longest drive.
  const normalPct = (Math.min(r.staticDurationSec, r.durationSec) / maxDuration) * 100;
  const delayPct = (r.delaySec / maxDuration) * 100;
  return (
    <div
      className={`card resort-card ${rank === 1 ? "first" : ""} ${selected ? "selected" : ""} ${dim ? "dim" : ""}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
    >
      <div className="rank">{String(rank).padStart(2, "0")}</div>
      <div className="resort-main">
        <div className="resort-name">
          {r.name}
          {rank === 1 && <span className="tag">Fastest</span>}
        </div>
        <div className="resort-stats">
          <span>{summitFt.toLocaleString()} ft</span>
          <span>{formatMiles(r.distanceMeters)}</span>
          <span className="meta-normal">
            Normal <strong>{formatDuration(r.staticDurationSec)}</strong>
          </span>
          <span className={`traffic traffic-${level.tone}`}>
            <TrailIcon tone={level.tone} /> {trafficText(r)}
          </span>
        </div>
        <div className="drive-bar" aria-hidden>
          <span className="drive-normal" style={{ width: `${normalPct}%` }} />
          <span className="drive-delay" style={{ width: `${delayPct}%` }} />
        </div>
      </div>
      <div className="resort-time">
        <div className="time">{formatDuration(r.durationSec)}</div>
        <a className="link" href={directionsUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
          Directions ↗
        </a>
      </div>
    </div>
  );
}

// Plain-English traffic summary for a card.
function trafficText(r: ResortCommute) {
  const diffMin = Math.round((r.durationSec - r.staticDurationSec) / 60);
  if (diffMin <= -2) return `${-diffMin}m faster than usual`;
  if (diffMin < 1) return "Clear roads";
  return `+${formatDuration(r.delaySec)} ${delayLevel(r.delaySec).label.toLowerCase()} traffic`;
}

function SkeletonList() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="card resort-card skeleton" />
      ))}
    </>
  );
}
