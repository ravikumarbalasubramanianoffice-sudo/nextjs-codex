import { NextRequest, NextResponse } from "next/server";
import { searchInstruments } from "@/lib/instruments";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const exchange = searchParams.get("exchange") ?? undefined;
  const segment = searchParams.get("segment") ?? undefined;
  const instrumentType = searchParams.get("instrumentType") ?? undefined;

  const started = performance.now();
  const data = searchInstruments({ q, exchange, segment, instrumentType, limit: 120 });
  const elapsedMs = Number((performance.now() - started).toFixed(2));

  return NextResponse.json({ data, meta: { elapsedMs, total: data.length } });
}
