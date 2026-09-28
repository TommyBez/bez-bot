import type { MockModelRequest, MockModelResponse } from "eve/evals";
import { stripTeammateEnvelope } from "../../lib/protocol";

/**
 * Offline demo brain, used when `BEZBOT_DEMO_MODEL=1`.
 *
 * It lets you run Bez Bot end to end with no model credentials: bots read
 * their persona (teammates, routines) from the system prompt and exercise
 * the real tools, including autonomous bot-to-bot messaging, memory,
 * routines, the shared computer, and notifications. Replies are scripted,
 * so this is for demos and tests, not real work.
 */

interface Teammate {
  name: string;
  id: string;
}

/** System prompt plus any persona a teammate handoff carried in its first message. */
function systemText(request: MockModelRequest): string {
  const system = request.messages.filter((m) => m.role === "system").map((m) => m.text);
  const handoff = request.messages
    .filter((m) => m.role === "user")
    .map((m) => /<bezbot-persona>([\s\S]*?)<\/bezbot-persona>/.exec(m.text)?.[1] ?? "")
    .filter(Boolean)
    .slice(-1);
  return [...handoff, ...system].join("\n");
}

function botName(system: string): string {
  return /# You are (.+)/.exec(system)?.[1]?.trim() ?? "Bez Bot";
}

function teammates(system: string): Teammate[] {
  const section = system.split("## Your teammates")[1]?.split("\n## ")[0] ?? "";
  return [...section.matchAll(/- \S+ (.+?) \(id: (bot_[a-z0-9]+)\)/g)].map((m) => ({ name: m[1]!.trim(), id: m[2]! }));
}

function hasTool(request: MockModelRequest, name: string): boolean {
  return request.tools.some((t) => t.name === name);
}

/** Tool results produced after the latest user message (i.e. in this turn). */
function resultsThisTurn(request: MockModelRequest) {
  const lastUser = request.messages.map((m) => m.role).lastIndexOf("user");
  const after = request.messages.slice(lastUser + 1).filter((m) => m.role === "tool").length;
  return after > 0 ? request.toolResults.slice(-after) : [];
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "note";
}

function stripEnvelope(text: string): string {
  return stripTeammateEnvelope(text).replace(/<bezbot-[^>]*\/>\s*/g, "").trim();
}

/** Parses eve's "Background task … is completed. Result: {json}" notice. */
function taskResult(message: string): Record<string, unknown> | null {
  const match = /Background task \S+ \((\w+)\) is (completed|failed|cancelled)[\s\S]*?Result:\s*(\{[\s\S]*\})\s*$/.exec(message);
  if (!match) return null;
  try {
    return { tool: match[1], status: match[2], ...(JSON.parse(match[3]!) as Record<string, unknown>) };
  } catch {
    return { tool: match[1], status: match[2] };
  }
}

function mentioned(message: string, team: Teammate[]): Teammate[] {
  const lower = message.toLowerCase();
  if (/\b(everyone|every bot|all bots|the team)\b/.test(lower)) return team;
  return team.filter((t) => {
    const n = t.name.toLowerCase();
    return lower.includes(`@${n}`) || new RegExp(`\\b(ask|loop in|ping|message|check with|get|send (?:it )?to)\\s+(?:the\\s+)?${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(lower);
  });
}

function scheduleFrom(message: string): { at?: string; days?: number[]; everyMinutes?: number } | undefined {
  const lower = message.toLowerCase();
  const time = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/.exec(lower);
  let at: string | undefined;
  if (time && /\bat\b/.test(lower)) {
    let hour = Number(time[1]);
    if (time[3] === "pm" && hour < 12) hour += 12;
    if (time[3] === "am" && hour === 12) hour = 0;
    at = `${String(hour).padStart(2, "0")}:${time[2] ?? "00"}`;
  }
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const days = dayNames.map((d, i) => (lower.includes(d) ? i : -1)).filter((i) => i >= 0);
  if (lower.includes("weekday")) days.push(1, 2, 3, 4, 5);
  if (at) return { at, ...(days.length > 0 ? { days } : {}) };
  if (/\bevery hour|hourly\b/.test(lower)) return { everyMinutes: 60 };
  if (/\bevery day|daily|each day\b/.test(lower)) return { at: "09:00" };
  if (days.length > 0) return { at: "09:00", days };
  return undefined;
}

function teammateReply(request: MockModelRequest, system: string, me: string): MockModelResponse | string {
  const message = request.lastUserMessage ?? "";
  const from = /Message from your teammate ([^:\n]+):/.exec(message)?.[1] ?? "my teammate";
  const ask = stripEnvelope(message);
  const done = resultsThisTurn(request);
  if (done.length === 0 && hasTool(request, "bash")) {
    const file = `/workspace/shared/handoffs/${slug(me)}-${slug(ask)}.md`;
    const body = `# ${me.replace(/['%]/g, "")} for ${from.replace(/['%]/g, "")}\\n\\nRequest: ${ask.replace(/['%\\]/g, "")}\\n\\n- Finding 1: prioritized the most relevant items\\n- Finding 2: flagged two risks worth a look\\n- Finding 3: recommended next step\\n`;
    return {
      text: `On it, ${from}.`,
      toolCalls: [{ name: "bash", input: { command: `mkdir -p /workspace/shared/handoffs && printf '${body}' > '${file}' && echo saved ${file}` } }],
    };
  }
  void system;
  return [
    `Here's what I found for you, ${from}:`,
    "",
    `- Took your request: “${ask.slice(0, 160)}”`,
    "- Pulled together the three most relevant findings and ranked them",
    "- Saved the details to the shared drive under `handoffs/` so you can reuse them",
    "",
    "Let me know if you want me to go deeper on any of it.",
  ].join("\n");
}

export function demoBrain(request: MockModelRequest): MockModelResponse | string {
  const system = systemText(request);
  const me = botName(system);
  const team = teammates(system);
  const message = request.lastUserMessage ?? "";
  const done = resultsThisTurn(request);

  // Working for another bot.
  if (message.includes("<bezbot-teammate")) return teammateReply(request, system, me);

  // A teammate's reply arrived as a background task result.
  const result = taskResult(message);
  if (result) {
    if (typeof result.reply === "string") {
      return [`${String(result.from ?? "My teammate")} got back to me. Here's the combined result:`, "", result.reply, "", "That wraps it up. Anything else you want me to take on?"].join("\n");
    }
    return `A background task ${String(result.status)}${result.error ? `: ${String(result.error)}` : "."}`;
  }
  // eve's runtime note that background work was accepted.
  if (/^Background task reporting|\[Task state\]/m.test(message)) {
    return "I've handed that off to my teammates. They're working in parallel on the shared computer, and I'll pull their answers together as soon as they reply.";
  }

  // Scheduled routine run.
  if (message.includes("<bezbot-routine")) {
    if (done.length === 0) {
      const calls: { name: string; input: unknown }[] = [];
      if (hasTool(request, "bash")) {
        calls.push({ name: "bash", input: { command: `mkdir -p /workspace/shared/runs && date -u > /workspace/shared/runs/${slug(me)}-last-run.txt && echo ok` } });
      }
      const others = team.slice(0, 2);
      if (/message every other bot|collect updates|every bot/i.test(message) && hasTool(request, "message_bot")) {
        for (const t of others) calls.push({ name: "message_bot", input: { to: t.name, message: "Quick status update for the routine report: what did you ship, what's blocked?" } });
      }
      if (hasTool(request, "notify_user")) {
        calls.push({ name: "notify_user", input: { title: `${me} finished a scheduled run`, body: "Report saved to the shared drive under runs/." } });
      }
      return { text: "Running the routine now.", toolCalls: calls };
    }
    return `Routine complete. I saved the run log to \`/workspace/shared/runs/\` and sent you a summary in your inbox.`;
  }

  if (done.length > 0) {
    const names = done.map((d) => d.name);
    if (names.includes("message_bot")) {
      const who = done
        .filter((d) => d.name === "message_bot")
        .map((d) => {
          const out = d.output as { error?: string } | null;
          return out && typeof out === "object" && out.error ? `(couldn't reach: ${out.error})` : "";
        })
        .filter(Boolean);
      return who.length > 0
        ? `I tried to loop in a teammate but hit a snag ${who.join(" ")}.`
        : "I've handed that off to my teammates. They're working in parallel on the shared computer, and I'll pull their answers together as soon as they reply.";
    }
    if (names.includes("remember")) return "Noted for next time. I saved that to memory so I (and the team, if it's shared) won't need to ask again.";
    if (names.includes("save_routine")) return "Saved as a routine. You can see it under Routines, adjust the steps or schedule, and I'll run it on my own from now on.";
    if (names.includes("delete_routine")) return "Done, the routine is deleted.";
    if (names.includes("bash")) return "Done. I wrote the result to the shared drive so every bot on the team can use it.";
    return "Done.";
  }

  const lower = message.toLowerCase();
  const targets = mentioned(message, team);
  if (targets.length > 0 && hasTool(request, "message_bot")) {
    return {
      text: `Looping in ${targets.map((t) => t.name).join(" and ")}.`,
      toolCalls: targets.map((t) => ({ name: "message_bot", input: { to: t.name, message: stripEnvelope(message) } })),
    };
  }

  if (/\b(remember|note that|keep in mind|for next time)\b/.test(lower) && hasTool(request, "remember")) {
    const text = message.replace(/^\s*(please\s+)?(remember( that)?|note that|keep in mind( that)?)[:,]?\s*/i, "").trim();
    return { toolCalls: [{ name: "remember", input: { text: text || message, scope: /\bteam\b/.test(lower) ? "team" : "self" } }] };
  }

  if (/\bdelete\b.*\broutine\b/.test(lower) && hasTool(request, "delete_routine")) {
    const id = /(rtn_[a-z0-9]+)/.exec(system)?.[1];
    if (id) return { text: "This one needs your approval first.", toolCalls: [{ name: "delete_routine", input: { id } }] };
  }

  if ((/\b(routine|every (day|week|monday|morning)|recording|teach)\b/.test(lower) || /frames over/.test(lower)) && hasTool(request, "save_routine")) {
    const numbered = message.split("\n").filter((l) => /^\s*\d+[.)]/.test(l));
    const steps =
      numbered.length >= 2
        ? numbered.join("\n")
        : "1. Open the tools used in the recording\n2. Collect the inputs shown on screen\n3. Produce the output the same way\n4. Save it to the shared drive and report back";
    const schedule = scheduleFrom(message);
    return {
      text: "Got it. Here's the routine I'll follow:",
      toolCalls: [
        {
          name: "save_routine",
          input: {
            name: /weekly|report/i.test(message) ? "Weekly reporting" : `${me} routine`,
            description: stripEnvelope(message).split("\n")[0]!.slice(0, 200),
            steps,
            ...(schedule ? { schedule } : {}),
            source: /frames over|recording|teach/i.test(message) ? "taught" : "bot",
          },
        },
      ],
    };
  }

  if (/\b(file|save|write|draft|run|report|list)\b/.test(lower) && hasTool(request, "bash")) {
    const file = `/workspace/shared/${slug(me)}/${slug(message)}.md`;
    return {
      text: "Working on it on my computer.",
      toolCalls: [
        {
          name: "bash",
          input: { command: `mkdir -p '/workspace/shared/${slug(me)}' && printf '# ${me.replace(/['%]/g, "")}\\n\\nTask: ${message.replace(/['%\\]/g, "").slice(0, 200)}\\n\\nDraft ready for review.\\n' > '${file}' && echo wrote ${file}` },
        },
      ],
    };
  }

  const teamLine = team.length > 0 ? ` I can also loop in ${team.map((t) => t.name).slice(0, 3).join(", ")} when it helps — just mention them.` : "";
  return `Hi! I'm ${me}, running in offline demo mode. Ask me to save a file, remember something, set up a routine, or message a teammate.${teamLine}`;
}
