import { defineHook } from "eve/hooks";
import { kv } from "../../lib/store/kv";
import { getSessionContext, updateExchange } from "../../lib/store/repo";

/**
 * Links each bot-to-bot exchange to the teammate's child session and eve's
 * agent handle, so the app can stream the teammate's work and the sender can
 * continue the same conversation later.
 */
export default defineHook({
  events: {
    async "subagent.called"(event) {
      if (event.data.name !== "teammate") return;
      const { childSessionId, agentId } = event.data;
      await kv().set(`child-agent:${childSessionId}`, agentId ?? null);
      const child = await getSessionContext(childSessionId);
      if (child?.exchangeId) {
        await updateExchange(child.exchangeId, { childSessionId, ...(agentId ? { agentId } : {}) });
      }
    },
  },
});
