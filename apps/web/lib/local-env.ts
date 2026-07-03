import { existsSync, readFileSync } from "fs";
import path from "path";

export function projectRoot() {
  const fromWeb = path.resolve(process.cwd(), "../..");
  return fromWeb.endsWith("New project") ? fromWeb : process.cwd();
}

export function readLocalEnv(root = projectRoot()) {
  const envPath = path.join(root, ".env.local");
  if (!existsSync(envPath)) {
    return {};
  }

  const values: Record<string, string> = {};
  const contents = readFileSync(envPath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) {
      continue;
    }
    values[match[1]] = unquote(match[2]);
  }
  return values;
}

function unquote(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}
