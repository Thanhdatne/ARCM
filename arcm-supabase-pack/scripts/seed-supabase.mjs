import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function readJson(fileName, fallback) {
  const filePath = path.resolve(process.cwd(), "data", fileName);
  if (!fs.existsSync(filePath)) return fallback;

  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : Object.values(parsed);
}

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) chunks.push(array.slice(i, i + size));
  return chunks;
}

async function upsertChunks(table, rows, onConflict) {
  if (!rows.length) {
    console.log(`${table}: nothing to upsert`);
    return;
  }

  for (const part of chunk(rows, 500)) {
    const { error } = await supabase.from(table).upsert(part, { onConflict });
    if (error) throw error;
  }

  console.log(`${table}: upserted ${rows.length}`);
}

const deployments = readJson("world-cup-deployments.json", []).map((item) => ({
  world_cup_market_id: item.worldCupMarketId,
  fixture_id: item.fixtureId,
  group: item.group,
  question: item.question,
  outcome_type: item.outcomeType,
  market_address: item.marketAddress,
  amm_address: item.ammAddress,
  created_at: item.createdAt ?? null,
  tx_hash: item.txHash ?? null,
  transaction_hash: item.transactionHash ?? null,
  updated_at: new Date().toISOString(),
}));

const results = readJson("world-cup-results.json", []).map((item) => ({
  fixture_id: item.fixtureId,
  home_team: item.homeTeam,
  away_team: item.awayTeam,
  home_score: item.homeScore,
  away_score: item.awayScore,
  status: item.status,
  result: item.result ?? null,
  source: item.source ?? null,
  result_updated_at: item.updatedAt ?? null,
  updated_at: new Date().toISOString(),
}));

await upsertChunks("world_cup_deployments", deployments, "world_cup_market_id");
await upsertChunks("world_cup_results", results, "fixture_id");

console.log("Done");
