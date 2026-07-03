import { access, readFile } from "node:fs/promises";
import path from "node:path";
import type { ProcurementSource } from "@/lib/gov-types";

const SOURCE_HEADERS: Array<keyof ProcurementSource> = [
  "level",
  "state",
  "source_name",
  "source_type",
  "url",
  "registration_required",
  "alert_available",
  "notes",
  "status",
];

export async function getProcurementSources() {
  const csvPath = await findProcurementSourcesCsv();
  const csv = await readFile(csvPath, "utf8");
  const rows = parseCsv(csv);
  return rows.slice(1).map((row) => {
    return SOURCE_HEADERS.reduce((source, header, index) => {
      source[header] = row[index] ?? "";
      return source;
    }, {} as ProcurementSource);
  });
}

async function findProcurementSourcesCsv() {
  const candidates = [
    path.resolve(process.cwd(), "data/procurement_sources.csv"),
    path.resolve(process.cwd(), "gov-contracts/procurement_sources.csv"),
    path.resolve(process.cwd(), "../gov-contracts/procurement_sources.csv"),
    path.resolve(process.cwd(), "../../gov-contracts/procurement_sources.csv"),
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next likely workspace root.
    }
  }

  return candidates[0];
}

function parseCsv(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (char === "\"" && quoted && next === "\"") {
      value += "\"";
      index += 1;
      continue;
    }

    if (char === "\"") {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(value);
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}
