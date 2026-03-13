"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Candle, Exchange, Instrument, InstrumentType, Segment } from "@/lib/instruments";

type FilterState = {
  exchange: "" | Exchange;
  segment: "" | Segment;
  instrumentType: "" | InstrumentType;
};

const EXCHANGES: Exchange[] = ["NSE", "BSE", "NFO", "MCX", "CDS"];
const SEGMENTS: Segment[] = ["Equity", "Futures", "Options", "Index", "Currency", "Commodity"];
const TYPES: InstrumentType[] = ["EQ", "FUT", "OPT"];
const INTERVALS = [
  { label: "1 minute", value: "1m" },
  { label: "5 minute", value: "5m" },
  { label: "15 minute", value: "15m" },
  { label: "1 hour", value: "1h" },
  { label: "1 day", value: "1d" },
] as const;

const formatDateInput = (date: Date) => date.toISOString().split("T")[0];

const TODAY = new Date();
const DEFAULT_TO_DATE = formatDateInput(TODAY);
const DEFAULT_FROM_DATE = formatDateInput(new Date(TODAY.getTime() - 1000 * 60 * 60 * 24 * 30));

const highlightMatch = (text: string, q: string) => {
  if (!q) return text;
  const ix = text.toLowerCase().indexOf(q.toLowerCase());
  if (ix === -1) return text;
  return (
    <>
      {text.slice(0, ix)}
      <span className="rounded bg-sky-500/20 px-0.5 text-sky-700 dark:text-sky-300">{text.slice(ix, ix + q.length)}</span>
      {text.slice(ix + q.length)}
    </>
  );
};

function CandlestickChart({ candles }: { candles: Candle[] }) {
  const [zoom, setZoom] = useState(160);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const view = candles.slice(-zoom);

  const stats = useMemo(() => {
    const highs = view.map((x) => x.high);
    const lows = view.map((x) => x.low);
    const vols = view.map((x) => x.volume);
    return {
      maxHigh: Math.max(...highs),
      minLow: Math.min(...lows),
      maxVol: Math.max(...vols),
    };
  }, [view]);

  if (!candles.length) {
    return <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-sm text-zinc-500 dark:border-zinc-700">No preview data yet.</div>;
  }

  const width = 920;
  const height = 280;
  const volumeHeight = 90;
  const chartHeight = height - volumeHeight;
  const spacing = width / view.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs text-zinc-500">
        <span>Zoom</span>
        <input type="range" min={60} max={500} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-48" />
        <span>{Math.min(zoom, candles.length)} candles</span>
      </div>
      <div className="relative overflow-x-auto rounded-xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
        <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[900px]">
          {view.map((candle, idx) => {
            const x = idx * spacing + spacing / 2;
            const y = ((stats.maxHigh - candle.high) / (stats.maxHigh - stats.minLow || 1)) * (chartHeight - 10) + 5;
            const yLow = ((stats.maxHigh - candle.low) / (stats.maxHigh - stats.minLow || 1)) * (chartHeight - 10) + 5;
            const yOpen = ((stats.maxHigh - candle.open) / (stats.maxHigh - stats.minLow || 1)) * (chartHeight - 10) + 5;
            const yClose = ((stats.maxHigh - candle.close) / (stats.maxHigh - stats.minLow || 1)) * (chartHeight - 10) + 5;
            const up = candle.close >= candle.open;
            const volHeight = (candle.volume / (stats.maxVol || 1)) * (volumeHeight - 10);
            const hover = hoverIndex === idx;

            return (
              <g key={candle.timestamp} onMouseEnter={() => setHoverIndex(idx)}>
                <line x1={x} x2={x} y1={y} y2={yLow} stroke={up ? "#22c55e" : "#ef4444"} strokeWidth={1.4} />
                <rect x={x - spacing * 0.3} y={Math.min(yOpen, yClose)} width={spacing * 0.6} height={Math.max(2, Math.abs(yOpen - yClose))} fill={up ? "#22c55e" : "#ef4444"} opacity={hover ? 0.85 : 0.65} />
                <rect x={x - spacing * 0.3} y={chartHeight + (volumeHeight - volHeight)} width={spacing * 0.6} height={volHeight} fill={up ? "#16a34a" : "#dc2626"} opacity={0.35} />
              </g>
            );
          })}
        </svg>
        {hoverIndex !== null && view[hoverIndex] ? (
          <div className="pointer-events-none absolute right-3 top-3 rounded-lg border border-zinc-200 bg-white/90 px-3 py-2 text-xs shadow-sm dark:border-zinc-700 dark:bg-zinc-900/90">
            <div>{new Date(view[hoverIndex].timestamp).toUTCString()}</div>
            <div>O: {view[hoverIndex].open}</div>
            <div>H: {view[hoverIndex].high}</div>
            <div>L: {view[hoverIndex].low}</div>
            <div>C: {view[hoverIndex].close}</div>
            <div>V: {view[hoverIndex].volume}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function FindPage() {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Instrument | null>(null);
  const [filters, setFilters] = useState<FilterState>({ exchange: "", segment: "", instrumentType: "" });
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    const cached = window.localStorage.getItem("recentInstrumentSearches");
    return cached ? JSON.parse(cached) : [];
  });
  const [interval, setInterval] = useState("1d");
  const [fromDate, setFromDate] = useState(DEFAULT_FROM_DATE);
  const [toDate, setToDate] = useState(DEFAULT_TO_DATE);
  const [previewData, setPreviewData] = useState<Candle[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [format, setFormat] = useState("csv");
  const [downloadLoading, setDownloadLoading] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  const suggestions = results.slice(0, 8);
  const dateError = new Date(fromDate) >= new Date(toDate);

  useEffect(() => {
    const dark = window.localStorage.getItem("find-dark-mode") === "1";
    document.documentElement.classList.toggle("dark", dark);
  }, []);

  useEffect(() => {
    const onSlash = (e: KeyboardEvent) => {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onSlash);
    return () => window.removeEventListener("keydown", onSlash);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams({ q: search });
      if (filters.exchange) params.set("exchange", filters.exchange);
      if (filters.segment) params.set("segment", filters.segment);
      if (filters.instrumentType) params.set("instrumentType", filters.instrumentType);
      const response = await fetch(`/api/instruments/search?${params.toString()}`);
      const payload = await response.json();
      setResults(payload.data ?? []);
      setLoading(false);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [search, filters]);

  const saveRecent = (term: string) => {
    if (!term.trim()) return;
    const next = [term, ...recentSearches.filter((r) => r !== term)].slice(0, 6);
    setRecentSearches(next);
    window.localStorage.setItem("recentInstrumentSearches", JSON.stringify(next));
  };

  const onPreview = async () => {
    if (!selected || dateError) return;
    setPreviewLoading(true);
    const response = await fetch("/api/instruments/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instrumentToken: selected.instrumentToken,
        exchangeToken: selected.exchangeToken,
        interval,
        fromDate,
        toDate,
      }),
    });
    const payload = await response.json();
    setPreviewData(payload.data ?? []);
    setPreviewLoading(false);
  };

  const onDownload = async () => {
    if (!selected || dateError) return;
    setDownloadLoading(true);
    const response = await fetch("/api/instruments/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instrumentToken: selected.instrumentToken,
        exchangeToken: selected.exchangeToken,
        interval,
        fromDate,
        toDate,
        format,
      }),
    });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dataset-${selected.symbol}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
    setDownloadLoading(false);
  };

  return (
    <main className="min-h-screen bg-zinc-50 p-4 text-zinc-900 transition-colors dark:bg-zinc-950 dark:text-zinc-100 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="sticky top-3 z-20 rounded-2xl border border-zinc-200 bg-white/95 p-4 shadow-sm backdrop-blur transition dark:border-zinc-800 dark:bg-zinc-900/95">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-xl font-semibold">Financial Data Discovery</h1>
            <button
              className="rounded-lg border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              onClick={() => {
                const enabled = !document.documentElement.classList.contains("dark");
                document.documentElement.classList.toggle("dark", enabled);
                window.localStorage.setItem("find-dark-mode", enabled ? "1" : "0");
              }}
            >
              Toggle dark mode
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr]">
            <div className="relative">
              <input
                ref={searchRef}
                value={search}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") setActiveSuggestion((v) => Math.min(v + 1, Math.max(0, suggestions.length - 1)));
                  if (e.key === "ArrowUp") setActiveSuggestion((v) => Math.max(v - 1, 0));
                  if (e.key === "Enter" && suggestions[activeSuggestion]) {
                    const next = suggestions[activeSuggestion].symbol;
                    setSearch(next);
                    saveRecent(next);
                    setShowSuggestions(false);
                  }
                }}
                className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm outline-none ring-sky-500 transition focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
                placeholder="Search symbol (e.g. RELIANCE, NIFTY, BANKNIFTY)"
              />
              {showSuggestions && suggestions.length > 0 ? (
                <div className="absolute mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                  {suggestions.map((row, idx) => (
                    <button
                      key={row.instrumentToken}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                        activeSuggestion === idx ? "bg-sky-100 dark:bg-sky-900/40" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      }`}
                      onClick={() => {
                        setSearch(row.symbol);
                        saveRecent(row.symbol);
                        setShowSuggestions(false);
                      }}
                    >
                      <span>{highlightMatch(row.symbol, search)}</span>
                      <span className="text-xs text-zinc-500">{row.exchange}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <select className="rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-900" value={filters.exchange} onChange={(e) => setFilters((prev) => ({ ...prev, exchange: e.target.value as FilterState["exchange"] }))}>
              <option value="">All Exchanges</option>
              {EXCHANGES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select className="rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-900" value={filters.segment} onChange={(e) => setFilters((prev) => ({ ...prev, segment: e.target.value as FilterState["segment"] }))}>
              <option value="">All Segments</option>
              {SEGMENTS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select className="rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-900" value={filters.instrumentType} onChange={(e) => setFilters((prev) => ({ ...prev, instrumentType: e.target.value as FilterState["instrumentType"] }))}>
              <option value="">All Types</option>
              {TYPES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          {recentSearches.length > 0 ? <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">Recent: {recentSearches.map((item) => <button key={item} className="rounded-full border border-zinc-300 px-2 py-0.5 hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800" onClick={() => setSearch(item)}>{item}</button>)}</div> : null}
        </div>

        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-lg font-semibold">Instrument Results</h2>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />)}</div>
          ) : results.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-zinc-500 dark:border-zinc-700">No instruments found. Adjust filters or search query.</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs text-zinc-500">
                  <tr>
                    {[
                      "Symbol",
                      "Exchange",
                      "Segment",
                      "Instrument Type",
                      "Expiry",
                      "Strike",
                      "Exchange Token",
                      "Instrument Token",
                    ].map((h) => (
                      <th key={h} className="px-3 py-2 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((row) => {
                    const active = selected?.instrumentToken === row.instrumentToken;
                    return (
                      <tr key={row.instrumentToken} onClick={() => { setSelected(row); saveRecent(row.symbol); }} className={`cursor-pointer border-t border-zinc-100 transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60 ${active ? "bg-sky-50 dark:bg-sky-900/30" : ""}`}>
                        <td className="px-3 py-3 font-medium">{row.symbol}</td>
                        <td className="px-3 py-3">{row.exchange}</td>
                        <td className="px-3 py-3">{row.segment}</td>
                        <td className="px-3 py-3">{row.instrumentType}</td>
                        <td className="px-3 py-3">{row.expiry ?? "-"}</td>
                        <td className="px-3 py-3">{row.strike ?? "-"}</td>
                        <td className="px-3 py-3">{row.exchangeToken}</td>
                        <td className="px-3 py-3">{row.instrumentToken}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-lg font-semibold">Selected Instrument</h3>
            {selected ? (
              <div className="space-y-1 text-sm">
                <div><span className="text-zinc-500">Symbol:</span> {selected.symbol}</div>
                <div><span className="text-zinc-500">Exchange:</span> {selected.exchange}</div>
                <div><span className="text-zinc-500">Segment:</span> {selected.segment}</div>
                <div><span className="text-zinc-500">Instrument Token:</span> {selected.instrumentToken}</div>
                <div><span className="text-zinc-500">Exchange Token:</span> {selected.exchangeToken}</div>
              </div>
            ) : (
              <div className="text-sm text-zinc-500">Select a row to continue.</div>
            )}
            <div className="space-y-2 text-sm">
              <label className="block text-xs text-zinc-500">From Date</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950" />
              <label className="block text-xs text-zinc-500">To Date</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950" />
              {dateError ? <p className="text-xs text-red-500">Start date must be earlier than end date.</p> : null}
              <label className="block text-xs text-zinc-500">Interval</label>
              <select value={interval} onChange={(e) => setInterval(e.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950">
                {INTERVALS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
              <button disabled={!selected || dateError || previewLoading} onClick={onPreview} className="mt-2 w-full rounded-xl bg-sky-600 px-3 py-2 font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-zinc-500">{previewLoading ? "Loading preview..." : "Preview Data"}</button>
            </div>
            <div className="space-y-2">
              <label className="block text-xs text-zinc-500">Dataset Format</label>
              <div className="grid grid-cols-3 gap-2">
                {["csv", "parquet", "json"].map((f) => (
                  <button key={f} className={`rounded-lg border px-2 py-2 text-xs uppercase ${format === f ? "border-sky-500 bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" : "border-zinc-300 dark:border-zinc-700"}`} onClick={() => setFormat(f)}>
                    {f}
                  </button>
                ))}
              </div>
              <p className="text-xs text-zinc-500">Schema: timestamp, open, high, low, close, volume (UTC)</p>
              <button disabled={!selected || dateError || downloadLoading} onClick={onDownload} className="w-full rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-500 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300">{downloadLoading ? "Preparing download..." : "Download Dataset"}</button>
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-3 text-lg font-semibold">Data Preview</h3>
            <CandlestickChart candles={previewData} />
          </div>
        </section>
      </div>
    </main>
  );
}
