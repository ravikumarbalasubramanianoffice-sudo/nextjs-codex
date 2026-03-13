export type Exchange = "NSE" | "BSE" | "NFO" | "MCX" | "CDS";
export type Segment =
  | "Equity"
  | "Futures"
  | "Options"
  | "Index"
  | "Currency"
  | "Commodity";
export type InstrumentType = "EQ" | "FUT" | "OPT";

export type Instrument = {
  symbol: string;
  exchange: Exchange;
  segment: Segment;
  instrumentType: InstrumentType;
  expiry: string | null;
  strike: number | null;
  exchangeToken: string;
  instrumentToken: string;
};

export type Candle = {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const EXCHANGES: Exchange[] = ["NSE", "BSE", "NFO", "MCX", "CDS"];
const SEGMENTS: Segment[] = [
  "Equity",
  "Futures",
  "Options",
  "Index",
  "Currency",
  "Commodity",
];
const TYPES: InstrumentType[] = ["EQ", "FUT", "OPT"];
const ROOT_SYMBOLS = [
  "RELIANCE",
  "NIFTY",
  "BANKNIFTY",
  "TCS",
  "INFY",
  "HDFCBANK",
  "SBIN",
  "ICICIBANK",
  "GOLD",
  "CRUDEOIL",
  "USDINR",
];

const pad = (n: number) => String(n).padStart(2, "0");

const makeExpiry = (offset: number) => {
  const d = new Date(Date.UTC(2026, (offset % 12) + 1, 28));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

export const INSTRUMENTS: Instrument[] = Array.from({ length: 2000 }, (_, i) => {
  const root = ROOT_SYMBOLS[i % ROOT_SYMBOLS.length];
  const exchange = EXCHANGES[i % EXCHANGES.length];
  const segment = SEGMENTS[i % SEGMENTS.length];
  const instrumentType = TYPES[i % TYPES.length];
  const suffix = instrumentType === "EQ" ? "EQ" : `${instrumentType}${(i % 12) + 1}`;
  const symbol = `${root}${i % 2 === 0 ? "" : "-"}${suffix}`;

  return {
    symbol,
    exchange,
    segment,
    instrumentType,
    expiry: instrumentType === "EQ" ? null : makeExpiry(i),
    strike: instrumentType === "OPT" ? 15000 + (i % 80) * 50 : null,
    exchangeToken: `${exchange}-${100000 + i}`,
    instrumentToken: `${500000 + i}`,
  };
});

export const searchInstruments = ({
  q,
  exchange,
  segment,
  instrumentType,
  limit = 100,
}: {
  q: string;
  exchange?: string;
  segment?: string;
  instrumentType?: string;
  limit?: number;
}) => {
  const query = q.trim().toLowerCase();
  const filtered = INSTRUMENTS.filter((item) => {
    if (query && !item.symbol.toLowerCase().includes(query)) {
      return false;
    }
    if (exchange && item.exchange !== exchange) {
      return false;
    }
    if (segment && item.segment !== segment) {
      return false;
    }
    if (instrumentType && item.instrumentType !== instrumentType) {
      return false;
    }
    return true;
  });

  return filtered.slice(0, limit);
};

export const buildCandles = ({
  fromDate,
  toDate,
  interval,
  maxPoints = 500,
}: {
  fromDate: string;
  toDate: string;
  interval: string;
  maxPoints?: number;
}): Candle[] => {
  const intervalMinutes =
    interval === "1m"
      ? 1
      : interval === "5m"
        ? 5
        : interval === "15m"
          ? 15
          : interval === "1h"
            ? 60
            : 60 * 24;

  const start = new Date(fromDate).getTime();
  const end = new Date(toDate).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    return [];
  }

  const step = intervalMinutes * 60 * 1000;
  const totalPoints = Math.min(maxPoints, Math.max(1, Math.floor((end - start) / step)));
  const candles: Candle[] = [];
  let price = 20000;

  for (let i = 0; i < totalPoints; i += 1) {
    const ts = new Date(start + i * step);
    const drift = Math.sin(i / 12) * 25 + Math.cos(i / 8) * 9;
    const open = price;
    const close = Math.max(100, open + drift + (i % 2 === 0 ? 6 : -5));
    const high = Math.max(open, close) + 5 + (i % 7);
    const low = Math.min(open, close) - 5 - (i % 5);
    const volume = 1000 + (i % 30) * 120;

    candles.push({
      timestamp: ts.toISOString(),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
    });

    price = close;
  }

  return candles;
};
