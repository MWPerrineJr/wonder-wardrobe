import { execFileSync, spawn } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const testsDir = join(process.cwd(), "supabase", "tests");

function dbContainer() {
  let names;
  try {
    names = execFileSync("docker", ["ps", "--format", "{{.Names}}"], { encoding: "utf8" });
  } catch {
    throw new Error("docker is required to run database regression tests.");
  }
  const found = names
    .split("\n")
    .map((name) => name.trim())
    .find((name) => name.startsWith("supabase_db_"));
  if (!found) {
    throw new Error("Local Supabase Postgres is not running. Start it with: supabase db start");
  }
  return found;
}

function psql(container, sql) {
  return execFileSync(
    "docker",
    ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
    { input: sql, encoding: "utf8" },
  );
}

function psqlAsync(container, sql) {
  return new Promise((resolve) => {
    const child = spawn(
      "docker",
      [
        "exec",
        "-i",
        container,
        "psql",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
      ],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => {
      resolve({ ok: code === 0, stdout, stderr });
    });
    child.stdin.end(sql);
  });
}

function bookingInsertSql(customerKey) {
  return `
INSERT INTO public.bookings (
  shop_id, provider_id, service_id, customer_id, starts_at, ends_at, price_cents, status, payment_status
) VALUES (
  tests.uid('shop_a'),
  tests.uid('chair_a'),
  tests.uid('service_a'),
  tests.uid('${customerKey}'),
  '2030-06-01 15:00:00+00',
  '2030-06-01 16:00:00+00',
  5000,
  'pending',
  'not_required'
);
`;
}

const container = dbContainer();
const files = readdirSync(testsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.error("No SQL tests found in supabase/tests.");
  process.exit(1);
}

for (const name of files) {
  const sql = readFileSync(join(testsDir, name), "utf8");
  process.stdout.write(`psql ${name} ... `);
  psql(container, sql);
  console.log("ok");
}

const [first, second] = await Promise.all([
  psqlAsync(container, bookingInsertSql("customer_a")),
  psqlAsync(container, bookingInsertSql("customer_b")),
]);

const successes = [first, second].filter((result) => result.ok).length;
if (successes !== 1) {
  console.error("Expected exactly one of two overlapping inserts to commit.");
  console.error(first.stdout, first.stderr);
  console.error(second.stdout, second.stderr);
  process.exit(1);
}

const occupying = psql(
  container,
  `SELECT count(*) FROM public.bookings
   WHERE shop_id = tests.uid('shop_a')
     AND starts_at = '2030-06-01 15:00:00+00'
     AND public.booking_occupies_slot(status, hold_expires_at);`,
);

if (!occupying.includes("1")) {
  console.error("Expected one occupying booking after the overlap race.");
  console.error(occupying);
  process.exit(1);
}

console.log(`OK: ${files.length} SQL files and overlap race`);
