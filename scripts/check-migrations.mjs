import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "supabase", "migrations");
const files = readdirSync(dir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.error("No SQL migrations found in supabase/migrations.");
  process.exit(1);
}

const stamps = new Map();
let failed = false;

for (const name of files) {
  const stamp = name.slice(0, 14);
  if (!/^\d{14}$/.test(stamp)) {
    console.error(`Migration filename must start with YYYYMMDDHHMMSS: ${name}`);
    failed = true;
  } else if (stamps.has(stamp)) {
    console.error(`Duplicate migration timestamp ${stamp}: ${stamps.get(stamp)} and ${name}`);
    failed = true;
  } else {
    stamps.set(stamp, name);
  }

  const path = join(dir, name);
  if (statSync(path).size === 0) {
    console.error(`Empty migration: ${name}`);
    failed = true;
  }

  const sql = readFileSync(path, "utf8");
  if (!sql.trim()) {
    console.error(`Whitespace-only migration: ${name}`);
    failed = true;
  }
}

if (failed) process.exit(1);

console.log(`OK: ${files.length} migrations`);
