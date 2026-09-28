import { defineAgent } from "eve";
import { agentModel, agentModelWindow } from "./lib/model";

export default defineAgent({
  model: agentModel,
  ...agentModelWindow,
  description: "A Bez Bot teammate that owns a job end to end on its own computer.",
  // Bots delegate to named teammates with `message_bot`, not anonymous root copies.
  tool: false,
  compaction: { thresholdPercent: 0.8 },
  limits: {
    sessionTimeoutMs: 90 * 24 * 60 * 60 * 1000,
  },
});
