import { defineAgent } from "eve";
import { agentModel, agentModelWindow } from "./lib/model";

export default defineAgent({
  model: agentModel,
  ...agentModelWindow,
  description: "A Bez Bot teammate that owns a job end to end on its own computer.",
  // Bots hand work to named teammates with `message_bot`, not anonymous copies of themselves.
  tool: false,
  // Each Bot keeps one conversation for life; compaction keeps it within the context window.
  compaction: { thresholdPercent: 0.8 },
  limits: { sessionTimeoutMs: false },
});
