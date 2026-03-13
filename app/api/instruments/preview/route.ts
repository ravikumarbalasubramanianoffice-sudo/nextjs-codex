import { NextRequest, NextResponse } from "next/server";
import { buildCandles } from "@/lib/instruments";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { fromDate, toDate, interval } = body;

  const candles = buildCandles({ fromDate, toDate, interval, maxPoints: 500 });
  return NextResponse.json({ data: candles });
}
