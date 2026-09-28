import { defineAgent } from "eve";
import { agentModel, agentModelWindow } from "../../../../lib/model";

export default defineAgent({
  description:
    "A teammate bot working on a request from another bot. The first line of the message names the teammate; its persona, memory, and tools load from that.",
  model: agentModel,
  ...agentModelWindow,
  // Reached through the `message_bot` workflow tool, never as a raw subagent tool.
  tool: false,
});
