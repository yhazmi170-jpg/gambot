const database = require("../db");

async function main() {
  console.log("[TEST] Starting database");

  await database.init();

  console.log("[TEST] Database initialized");

  // Test listing tables
  const tables = database.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  console.log("[TEST] Tables:", tables[0]?.values?.map(v => v[0]) || "none");

  // Test users table columns
  const cols = database.exec("PRAGMA table_info(users)");
  console.log("[TEST] Users table columns:", cols[0]?.values?.map(v => v[1]) || "none");

  // Test ensureUser
  const user = database.ensureUser("test123");
  console.log("[TEST] ensureUser result:", user);

  console.log("[TEST] PASS");
}

main().catch(error => {
  console.error("[TEST] FAIL", error);
  process.exit(1);
});