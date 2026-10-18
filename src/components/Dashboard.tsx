"use client";
// The main dashboard. Runs in the browser: it holds the address you typed,
// calls our own /api/commute endpoint, and renders the results + map.
import { useCallback, useEffect, useState } from "react";
import { APIProvider } from "@vis.gl/react-google-maps";
import AddressInput from "./AddressInput";
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

  const page = (
    <div className="page">
      <header className="dash-header">
        <div>
          <h1 className="dash-title">
            <span className="logo">▲</span> Ski Commute
          </h1>
          <div className="dash-subtitle">Live drive times to 10 Colorado resorts</div>
        </div>
        <div className="header-actions">
          {data && (
            <span className="updated">
              <span className="live-dot" /> Updated {timeAgo(data.fetchedAt, now)}
            </span>
          )}
          <button
            className="btn btn-secondary"
            onClick={() => fetchCommutes(address)}
            disabled={!canRefresh}
            title={cooldownLeft ? `Available in ${cooldownLeft}s` : "Get updated drive times"}
          >
            <span className={loading ? "spin" : ""}>↻</span>
            {loading ? "Refreshing" : cooldownLeft ? `Refresh (${cooldownLeft}s)` : "Refresh"}
          </button>
        </div>
      </header>

      <main className="dash-body">
        <form className="card address-card" onSubmit={onSubmit}>
          <label className="section-label" htmlFor="address">
            Starting point
          </label>
          <div className="address-row">
            <AddressInput value={input} onChange={setInput} onPick={fetchCommutes} hasBrowserKey={!!BROWSER_KEY} />
            <button className="btn btn-primary" type="submit" disabled={loading || !input.trim()}>
              Get drive times
            </button>
          </div>
          {data && !data.demo && <div className="caption">Routing from {data.origin.address}</div>}
        </form>

        {data?.demo && (
          <div className="banner banner-amber">
            <strong>Demo data.</strong> No <code>GOOGLE_MAPS_API_KEY</code> is set, so these are sample times from
            downtown Denver. Add your key to see live traffic (see README).
          </div>
        )}
        {error && <div className="banner banner-red">{error}</div>}

        {routed.length > 0 && <KpiRow results={routed} />}

        <div className="content-grid">
          <section className="card map-card">
            <ResortMap
              origin={data?.origin}
              resorts={mapPoints}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </section>

          <section className="list">
            <div className="section-label">Fastest first</div>
            {!data && loading && <SkeletonList />}
            {!data && !loading && (
              <div className="card empty">
                <div className="empty-icon">🏔️</div>
                <p>Enter your address to see drive times.</p>
              </div>
            )}
            {results.map((r, i) => (
              <ResortCard
                key={r.id}
                resort={r}
                rank={i + 1}
                origin={data!.origin}
                selected={r.id === selectedId}
                dim={loading}
                onSelect={() => setSelectedId(r.id)}
              />
            ))}
          </section>
        </div>

        <footer className="caption footer">
          Drive times from Google Routes API with live traffic. Each refresh = 10 route lookups.
        </footer>
      </main>
    </div>
  );

  // APIProvider loads Google's map script once, for both the map and the address suggestions.
  return BROWSER_KEY ? <APIProvider apiKey={BROWSER_KEY}>{page}</APIProvider> : page;
}

function KpiRow({ results }: { results: ResortCommute[] }) {
  const fastest = results[0];
  const avgDelay = results.reduce((s, r) => s + r.delaySec, 0) / results.length;
  const worst = results.reduce((a, b) => (b.delaySec > a.delaySec ? b : a));
  return (
    <div className="kpi-row">
      <div className="card kpi-card">
        <div className="kpi-label">Fastest right now</div>
        <div className="kpi-value">{formatDuration(fastest.durationSec)}</div>
        <div className="kpi-sub">{fastest.name}</div>
      </div>
      <div className="card kpi-card">
        <div className="kpi-label">Avg traffic delay</div>
        <div className={`kpi-value tone-${delayLevel(avgDelay).tone}`}>+{formatDuration(avgDelay)}</div>
        <div className="kpi-sub">across {results.length} resorts</div>
      </div>
      <div className="card kpi-card">
        <div className="kpi-label">Worst traffic</div>
        <div className={`kpi-value tone-${delayLevel(worst.delaySec).tone}`}>+{formatDuration(worst.delaySec)}</div>
        <div className="kpi-sub">{worst.delaySec >= 60 ? worst.name : "No delays right now"}</div>
      </div>
    </div>
  );
}

function ResortCard({
  resort: r,
  rank,
  origin,
  selected,
  dim,
  onSelect,
}: {
  resort: ResortCommute;
  rank: number;
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
          <div className="caption">No driving route found</div>
        </div>
      </div>
    );
  }

  const level = delayLevel(r.delaySec);
  return (
    <div
      className={`card resort-card ${selected ? "selected" : ""} ${dim ? "dim" : ""}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
    >
      <div className="rank">{rank}</div>
      <div className="resort-main">
        <div className="resort-name">{r.name}</div>
        <div className="resort-meta">
          {r.region} · {formatMiles(r.distanceMeters)}
        </div>
        <div className="resort-stats">
          <span>
            Normal <span className="mono">{formatDuration(r.staticDurationSec)}</span>
          </span>
          <span className={`badge ${level.tone}`}>
            +{formatDuration(r.delaySec)} {level.label}
          </span>
        </div>
      </div>
      <div className="resort-time">
        <div className="mono time">{formatDuration(r.durationSec)}</div>
        <a className="link" href={directionsUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
          Directions ↗
        </a>
      </div>
    </div>
  );
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
