import { NextRequest, NextResponse } from "next/server";
import { buildCandles, type Candle } from "@/lib/instruments";

const toCsv = (rows: Candle[]) => {
  const header = "timestamp,open,high,low,close,volume\n";
  const body = rows
    .map((row) => `${row.timestamp},${row.open},${row.high},${row.low},${row.close},${row.volume}`)
    .join("\n");
  return `${header}${body}`;
};

const toJson = (rows: Candle[]) => JSON.stringify(rows);

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { instrumentToken, exchangeToken, interval, fromDate, toDate, format } = body;

  const rows = buildCandles({ fromDate, toDate, interval, maxPoints: 4000 });

  const filename = `dataset_${instrumentToken}_${exchangeToken}_${fromDate}_${toDate}.${format}`;

  const serialized =
    format === "json"
      ? toJson(rows)
      : format === "parquet"
        ? toJson(rows)
        : toCsv(rows);

  const stream = new ReadableStream({
    start(controller) {
      const chunkSize = 64 * 1024;
      for (let i = 0; i < serialized.length; i += chunkSize) {
        controller.enqueue(new TextEncoder().encode(serialized.slice(i, i + chunkSize)));
      }
      controller.close();
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type":
        format === "json"
          ? "application/json"
          : format === "parquet"
            ? "application/octet-stream"
            : "text/csv",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
      "X-Dataset-Timezone": "UTC",
    },
  });
}
