import "dotenv/config";

import { getMongoDb } from "../src/lib/mongo";
import { refreshAnalyticsRollups } from "../src/lib/analytics/rollups";

function resolveLookback(): number {
  const raw = process.env.ANALYTICS_CRON_LOOKBACK_DAYS;
  if (!raw) return 3;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 3;
  return Math.min(30, Math.floor(parsed));
}

async function main() {
  const db = await getMongoDb();
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - resolveLookback());

  await refreshAnalyticsRollups(db, { from, to });

  console.log(
    `Analytics rollups atualizados de ${from.toISOString()} até ${to.toISOString()}.`
  );
}

main().catch((error) => {
  console.error("Falha ao atualizar rollups:", error);
  process.exitCode = 1;
});
