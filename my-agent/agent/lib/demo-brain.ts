import type { MockModelRequest, MockModelResponse } from "eve/evals";
import { NO_REPLY, parseGroupHeader, parseRoutineHeader, parseTeammateHeader } from "../../lib/protocol";

/**
 * Offline demo brain, used when `BEZBOT_DEMO_MODEL=1`.
 *
 * It lets you run Bez Bot end to end with no model credentials. Bots read
 * their persona (teammates, routines, group) from the system prompt and use
 * the real tools: Bot-to-Bot messages that land in each other's chats, group
 * chats, memory, routines, skills, and the shared computer. Replies are
 * scripted, so this is for demos and tests, not real work.
 */

interface Teammate {
  name: string;
  id: string;
}

type ToolCall = { name: string; input: unknown };

function systemText(request: MockModelRequest): string {
  return request.messages
    .filter((m) => m.role === "system")
    .map((m) => m.text)
    .join("\n");
}

function botName(system: string): string {
  return /# You are (.+)/.exec(system)?.[1]?.trim() ?? "Bez Bot";
}

function teammates(system: string): Teammate[] {
  const section = system.split("## Your teammates")[1]?.split("\n## ")[0] ?? "";
  return [...section.matchAll(/- \S+ (.+?) \(id: (bot_[a-z0-9]+)\)/g)].map((m) => ({ name: m[1]!.trim(), id: m[2]! }));
}

function groupMembers(system: string): string[] {
  const line = /You're in a group chat with .+? and (.+)\./.exec(system)?.[1] ?? "";
  return line.split(/,\s*/).map((s) => s.trim()).filter(Boolean);
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

function shellSafe(text: string): string {
  return text.replace(/['%\\]/g, "").replace(/\n/g, " ");
}

function writeFile(path: string, title: string, body: string): ToolCall {
  const dir = path.slice(0, path.lastIndexOf("/"));
  return {
    name: "bash",
    input: { command: `mkdir -p '${dir}' && printf '# ${shellSafe(title)}\\n\\n${shellSafe(body)}\\n' > '${path}' && echo saved ${path}` },
  };
}

function outputOf<T = Record<string, unknown>>(result: { output?: unknown }): T {
  return (result.output && typeof result.output === "object" ? result.output : {}) as T;
}

function mentioned(message: string, team: Teammate[]): Teammate[] {
  const lower = message.toLowerCase();
  if (/(^|\s)@everyone\b|\b(every bot|all bots|the whole team)\b/.test(lower)) return team;
  return team.filter((t) => {
    const n = t.name.toLowerCase();
    const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return lower.includes(`@${n}`) || new RegExp(`\\b(ask|loop in|ping|message|check with|send (?:it )?to)\\s+(?:the\\s+)?${escaped}\\b`).test(lower);
  });
}

function scheduleFrom(message: string): { at?: string; days?: number[]; everyMinutes?: number } {
  const lower = message.toLowerCase();
  const time = /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/.exec(lower);
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const days = dayNames.map((d, i) => (lower.includes(d) ? i : -1)).filter((i) => i >= 0);
  if (lower.includes("weekday")) days.push(1, 2, 3, 4, 5);
  const every = /every\s+(\d+)\s*(minutes?|hours?)/.exec(lower);
  if (every) return { everyMinutes: Math.max(15, Number(every[1]) * (every[2]!.startsWith("hour") ? 60 : 1)) };
  if (/\bevery hour|hourly\b/.test(lower)) return { everyMinutes: 60 };
  let at = "09:00";
  if (time) {
    let hour = Number(time[1]);
    if (time[3] === "pm" && hour < 12) hour += 12;
    if (time[3] === "am" && hour === 12) hour = 0;
    at = `${String(hour).padStart(2, "0")}:${time[2] ?? "00"}`;
  }
  return { at, ...(days.length > 0 ? { days } : {}) };
}

// --- A teammate asked this Bot for something ----------------------------------

function answerTeammate(request: MockModelRequest, me: string, header: NonNullable<ReturnType<typeof parseTeammateHeader>>) {
  const done = resultsThisTurn(request);
  const ask = header.body.trim();
  const file = `/workspace/shared/handoffs/${slug(me)}-${slug(ask)}.md`;
  const findings = [
    `Here's what I found for "${ask.slice(0, 120)}":`,
    "- Ranked the three most relevant items",
    "- Flagged two risks worth a look",
    `- Details are in ${file}`,
  ].join("\n");
  if (done.length === 0 && hasTool(request, "bash")) {
    return { text: `On it, ${header.fromName}.`, toolCalls: [writeFile(file, `${me} for ${header.fromName}`, findings)] };
  }
  if (!done.some((d) => d.name === "message_bot") && hasTool(request, "message_bot")) {
    return {
      toolCalls: [{ name: "message_bot", input: { to: header.fromName, conversationId: header.exchangeId, message: findings } }],
    };
  }
  return `Sent my findings back to ${header.fromName}. The details are in \`${file}\`.`;
}

// --- A group chat message -------------------------------------------------------

function answerGroup(request: MockModelRequest, system: string, me: string, header: NonNullable<ReturnType<typeof parseGroupHeader>>) {
  const done = resultsThisTurn(request);
  const lines = [...header.body.matchAll(/\*\*(.+?):\*\* ([\s\S]*?)(?=\n\n\*\*|$)/g)].map((m) => ({ author: m[1]!, text: m[2]!.trim() }));
  const latest = lines.at(-1)?.text ?? header.body;
  const members = groupMembers(system);
  const everyoneAtOnce = [me, ...members].sort();
  const coordinator = everyoneAtOnce[0] === me;

  if (header.respond === "maybe") {
    if (!coordinator) return NO_REPLY;
    const others = members.slice(0, 3);
    if (others.length === 0) return `I'll take this one: ${latest.slice(0, 160)}`;
    return [
      "I'll coordinate this.",
      ...others.map((name, i) => `@${name} ${["can you take the research piece?", "please draft the announcement.", "can you own the logistics?"][i]}`),
      "I'll pull it together once you've posted.",
    ].join("\n");
  }

  if (done.length === 0 && hasTool(request, "bash")) {
    const file = `/workspace/shared/groups/${slug(header.groupName)}/${slug(me)}.md`;
    return { text: "On it.", toolCalls: [writeFile(file, `${me} in ${header.groupName}`, `Request: ${latest.slice(0, 200)}. Draft ready.`)] };
  }
  const file = /saved (\S+)/.exec(String(outputOf<{ stdout?: string }>(done.at(-1) ?? {}).stdout ?? ""))?.[1];
  return `Done: my part is ready${file ? ` in \`${file}\`` : ""}. Short version: prioritized the top items and flagged one open question.`;
}

// --- A routine run ------------------------------------------------------------

function runRoutine(request: MockModelRequest, me: string, team: Teammate[], header: NonNullable<ReturnType<typeof parseRoutineHeader>>) {
  const done = resultsThisTurn(request);
  if (done.length === 0) {
    const calls: ToolCall[] = [];
    if (hasTool(request, "bash")) {
      calls.push(writeFile(`/workspace/shared/runs/${slug(header.name)}.md`, header.name, `Run ${header.runId} by ${me}.`));
    }
    if (/message every other bot|collect updates|every bot|each bot/i.test(header.body) && hasTool(request, "message_bot")) {
      for (const t of team.slice(0, 3)) {
        calls.push({ name: "message_bot", input: { to: t.name, message: `Quick update for "${header.name}": what did you ship, what's blocked?` } });
      }
    }
    return { text: `Running “${header.name}”.`, toolCalls: calls };
  }
  const asked = done.filter((d) => d.name === "message_bot").map((d) => String(outputOf<{ to?: string }>(d).to ?? "")).filter(Boolean);
  return asked.length > 0
    ? `“${header.name}” is underway. I asked ${asked.join(", ")} for updates; I'll post the brief here when they reply.`
    : `“${header.name}” is done. The run log is in \`/workspace/shared/runs/${slug(header.name)}.md\`.`;
}

// --- After tools ran in a normal turn -----------------------------------------------

function summarize(done: ReturnType<typeof resultsThisTurn>): string {
  const names = done.map((d) => d.name);
  if (names.includes("message_bot")) {
    const sent = done.filter((d) => d.name === "message_bot").map((d) => outputOf<{ sent?: boolean; to?: string; error?: string }>(d));
    const ok = sent.filter((s) => s.sent).map((s) => s.to);
    const failed = sent.filter((s) => !s.sent).map((s) => s.error);
    if (ok.length === 0) return `I couldn't reach them: ${failed.join(" ")}`;
    return `I asked ${ok.join(" and ")}. Their ${ok.length > 1 ? "replies" : "reply"} will land here, and I'll pick it up from there.`;
  }
  if (names.includes("remember")) return "Noted for next time.";
  if (names.includes("save_routine")) {
    const r = outputOf<{ name?: string; schedule?: string }>(done.find((d) => d.name === "save_routine")!);
    return `Created the routine “${r.name}” (${r.schedule}). Each run posts its result here. You can pause, test, or edit it under Tasks.`;
  }
  if (names.includes("save_skill")) {
    const s = outputOf<{ slug?: string; draft?: boolean }>(done.find((d) => d.name === "save_skill")!);
    return s.draft
      ? `I wrote that up as a draft skill, ${s.slug}. Review it under Skills, then test it before you schedule it.`
      : `Saved ${s.slug} to your skills. Any Bot can use it with ${s.slug}.`;
  }
  if (names.includes("create_bot")) {
    const b = outputOf<{ name?: string }>(done.find((d) => d.name === "create_bot")!);
    return `Created ${b.name}. They're in your sidebar with their own conversation.`;
  }
  if (names.includes("use_skill")) return "Followed the skill. Everything's in the shared drive.";
  if (names.includes("delete_routine")) return "Done, the routine is deleted.";
  if (names.includes("bash")) return "Done. I wrote the result to the shared drive so every Bot can use it.";
  return "Done.";
}

export function demoBrain(request: MockModelRequest): MockModelResponse | string {
  const system = systemText(request);
  const me = botName(system);
  const team = teammates(system);
  const message = request.lastUserMessage ?? "";
  const done = resultsThisTurn(request);

  const teammate = parseTeammateHeader(message);
  if (teammate?.kind === "request") return answerTeammate(request, me, teammate);
  if (teammate?.kind === "reply") {
    return [`${teammate.fromName} got back to me:`, "", teammate.body.trim(), "", "That covers it. Want me to take the next step?"].join("\n");
  }
  const group = parseGroupHeader(message);
  if (group) return answerGroup(request, system, me, group);
  const routine = parseRoutineHeader(message);
  if (routine) return runRoutine(request, me, team, routine);

  if (done.length > 0) return summarize(done);

  const lower = message.toLowerCase();
  const targets = mentioned(message, team);
  if (targets.length > 0 && hasTool(request, "message_bot")) {
    return {
      text: `Looping in ${targets.map((t) => t.name).join(" and ")}.`,
      toolCalls: targets.map((t) => ({ name: "message_bot", input: { to: t.name, message } })),
    };
  }

  if (/\b(remember|note that|keep in mind|for next time)\b/.test(lower) && hasTool(request, "remember")) {
    const text = message.replace(/^\s*(please\s+)?(remember( that)?|note that|keep in mind( that)?)[:,]?\s*/i, "").trim();
    return { toolCalls: [{ name: "remember", input: { text: text || message } }] };
  }

  if (/\bdelete\b.*\broutine\b/.test(lower) && hasTool(request, "delete_routine")) {
    const id = /(rtn_[a-z0-9]+)/.exec(system)?.[1];
    if (id) return { text: "That needs your approval first.", toolCalls: [{ name: "delete_routine", input: { id } }] };
  }

  if (/^teach a task|frames over|recorded my screen/i.test(message) && hasTool(request, "save_skill")) {
    const numbered = message.split("\n").filter((l) => /^\s*\d+[.)]/.test(l));
    const title = /^teach a task:\s*(.+)$/im.exec(message)?.[1]?.slice(0, 60) ?? "Taught workflow";
    return {
      text: "Thanks for showing me. Here's the draft I'll follow:",
      toolCalls: [
        {
          name: "save_skill",
          input: {
            name: title,
            description: `Repeat the workflow ${me} was shown.`,
            body: numbered.length >= 2 ? numbered.join("\n") : "1. Open the app from the recording\n2. Apply the same filters\n3. Export the result\n4. Save it to the shared drive",
            draft: true,
          },
        },
      ],
    };
  }

  if (/\b(save|turn) (this|that|it|the process)? ?(as|into) a skill\b|\bskill called\b/.test(lower) && hasTool(request, "save_skill")) {
    const name = /skill called\s+["“]?([^"”\n.]+)/i.exec(message)?.[1]?.trim() ?? `${me} process`;
    return {
      toolCalls: [
        {
          name: "save_skill",
          input: { name, description: "Reusable steps from our last task.", body: "1. Gather the inputs\n2. Do the work the same way as last time\n3. Check the result\n4. Post it with file paths" },
        },
      ],
    };
  }

  if (/\b(every (day|weekday|morning|week|monday|tuesday|wednesday|thursday|friday|\d+ (minutes?|hours?))|daily|hourly|each (morning|day)|routine)\b/.test(lower) && hasTool(request, "save_routine")) {
    const name = /routine called\s+["“]?([^"”\n.]+)/i.exec(message)?.[1]?.trim() ?? (/brief|report|digest/i.test(message) ? "Morning brief" : `${me} check-in`);
    return {
      toolCalls: [{ name: "save_routine", input: { name, instruction: message.replace(/\s+/g, " ").trim(), schedule: scheduleFrom(message) } }],
    };
  }

  if (/\b(create|make|spin up|add) (a |another )?(new )?bot\b/.test(lower) && hasTool(request, "create_bot")) {
    const name = /called\s+["“]?([^"”\n.,]+)/i.exec(message)?.[1]?.trim() ?? "Helper";
    return {
      text: "Good idea to give that its own owner.",
      toolCalls: [{ name: "create_bot", input: { name, label: "Helps with a focused job", description: message } }],
    };
  }

  if (/\b(file|save|write|draft|run|report|list|build|research)\b/.test(lower) && hasTool(request, "bash")) {
    return {
      text: "Working on it on the computer.",
      toolCalls: [writeFile(`/workspace/shared/${slug(me)}/${slug(message)}.md`, me, `Task: ${message.slice(0, 200)}. Draft ready for review.`)],
    };
  }

  const teamLine = team.length > 0 ? ` I can also message ${team.map((t) => t.name).slice(0, 3).join(", ")} when it helps.` : "";
  return `Hi, I'm ${me}, running in offline demo mode. Ask me to write a file, remember something, set up a routine, save a skill, or ask a teammate.${teamLine}`;
}
