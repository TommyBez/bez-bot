import { mockModel } from "eve/evals";
import { demoBrain } from "./demo-brain";

/**
 * Bez Bot runs on Grok through the Vercel AI Gateway. Set
 * `BEZBOT_DEMO_MODEL=1` to swap in a scripted offline model that still drives
 * the real tools (useful for demos and tests without model credentials).
 */
export const agentModel =
  process.env.BEZBOT_DEMO_MODEL === "1"
    ? mockModel({ modelId: "bezbot-demo", provider: "bezbot", respond: demoBrain })
    : "spacexai/grok-4.7";

/** The scripted model has no AI Gateway catalog entry, so give compaction a window size. */
export const agentModelWindow = process.env.BEZBOT_DEMO_MODEL === "1" ? { modelContextWindowTokens: 256_000 } : {};
