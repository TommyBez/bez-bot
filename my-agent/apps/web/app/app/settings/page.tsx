"use client";

import { KeyRoundIcon, Loader2Icon, LockIcon, MonitorIcon, PlusIcon, ShieldCheckIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { useAppState } from "@/components/app/app-state";
import { AppHeader, AppPage, buttonPrimary, buttonSecondary, Card, inputClass } from "@/components/app/page-header";
import { ActivityList, type ComputerResponse } from "@/components/app/chat/computer-peek";
import { api, timeAgo, usePoll } from "@/lib/client";
import { cn } from "@/lib/utils";
import type { AutoReviewSettings, VaultEntry } from "@shared/store/types";

type PublicVaultEntry = Omit<VaultEntry, "secret">;

function General() {
  const { state, refresh } = useAppState();
  const detected = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
  const [name, setName] = useState(state.user.name);
  const [timezone, setTimezone] = useState(state.user.timezone ?? detected);
  const [saving, setSaving] = useState(false);
  const zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [timezone];
  return (
    <Card className="space-y-4 p-5">
      <div className="text-[14.5px] text-white">General</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-[13px] text-neutral-400">Name</span>
          <input className={inputClass} onChange={(e) => setName(e.target.value)} value={name} />
        </label>
        <label className="space-y-1.5">
          <span className="text-[13px] text-neutral-400">Bot · Timezone (routines use it for schedules)</span>
          <select className={inputClass} onChange={(e) => setTimezone(e.target.value)} value={timezone}>
            <option value={detected}>Auto-detect ({detected})</option>
            {zones
              .filter((z) => z !== detected)
              .map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
          </select>
        </label>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] text-neutral-500">{state.user.email}</span>
        <button
          className={buttonPrimary}
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            await api("/api/me", { method: "PATCH", json: { name, timezone } });
            await refresh();
            setSaving(false);
          }}
          type="button"
        >
          {saving ? <Loader2Icon className="size-4 animate-spin" /> : null} Save
        </button>
      </div>
    </Card>
  );
}

const TOOLS = [
  { id: "bash", label: "Shell commands" },
  { id: "use_login", label: "Saved logins" },
  { id: "computer", label: "Computer use" },
  { id: "create_bot", label: "Creating Bots" },
  { id: "delete_routine", label: "Deleting routines" },
];

function AutoReview() {
  const { data, refresh } = usePoll<{ autoReview: AutoReviewSettings }>("/api/autoreview", 0);
  const settings = data?.autoReview;
  const [rule, setRule] = useState({ kind: "ask" as "ask" | "allow", tool: "bash", match: "" });
  const [adding, setAdding] = useState(false);
  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[14.5px] text-white">
            <ShieldCheckIcon className="size-4 text-neutral-500" /> Auto-review
          </div>
          <p className="mt-1 max-w-xl text-[12.5px] text-neutral-500">
            Bez Bot checks each risky action before it runs and asks you first when needed. With it off, you're asked before every risky action.
          </p>
        </div>
        <button
          aria-checked={settings?.enabled ?? true}
          className={cn("relative mt-1 h-5 w-9 shrink-0 rounded-full transition-colors", settings?.enabled === false ? "bg-white/15" : "bg-emerald-500")}
          onClick={async () => {
            await api("/api/autoreview", { method: "PUT", json: { enabled: !(settings?.enabled ?? true) } });
            await refresh();
          }}
          role="switch"
          type="button"
        >
          <span className={cn("absolute top-0.5 size-4 rounded-full bg-white transition-all", settings?.enabled === false ? "left-0.5" : "left-[18px]")} />
        </button>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[12.5px] text-neutral-400">Auto-review rules · Ask first wins when rules conflict</span>
          <button className={buttonSecondary} onClick={() => setAdding((v) => !v)} type="button">
            <PlusIcon className="size-4" /> Add rule
          </button>
        </div>
        {adding ? (
          <form
            className="grid grid-cols-1 gap-2 rounded-2xl border border-white/[0.06] p-3 sm:grid-cols-[140px_170px_minmax(0,1fr)_auto]"
            onSubmit={async (e) => {
              e.preventDefault();
              await api("/api/autoreview", { method: "POST", json: rule });
              setRule({ kind: "ask", tool: "bash", match: "" });
              setAdding(false);
              await refresh();
            }}
          >
            <select className={inputClass} onChange={(e) => setRule({ ...rule, kind: e.target.value as "ask" | "allow" })} value={rule.kind}>
              <option value="ask">Ask first</option>
              <option value="allow">Allow automatically</option>
            </select>
            <select className={inputClass} onChange={(e) => setRule({ ...rule, tool: e.target.value })} value={rule.tool}>
              {TOOLS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <input className={inputClass} onChange={(e) => setRule({ ...rule, match: e.target.value })} placeholder="Matching text (e.g. git push); empty matches all" value={rule.match} />
            <button className={buttonPrimary} type="submit">
              Save
            </button>
          </form>
        ) : null}
        {settings?.rules.length ? (
          <ul className="divide-y divide-white/[0.05]">
            {settings.rules.map((r) => (
              <li className="flex items-center gap-3 py-2" key={r.id}>
                <span className={cn("rounded-full px-2 py-0.5 text-[11px]", r.kind === "ask" ? "bg-amber-400/10 text-amber-300" : "bg-emerald-400/10 text-emerald-300")}>
                  {r.kind === "ask" ? "Ask first" : "Allow automatically"}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-300">
                  {TOOLS.find((t) => t.id === r.tool)?.label ?? r.tool}
                  {r.match ? <span className="font-mono text-[12px] text-neutral-500"> · {r.match}</span> : null}
                </span>
                <button
                  aria-label="Delete rule"
                  className="rounded-lg p-1.5 text-neutral-500 hover:text-red-300"
                  onClick={async () => {
                    await api(`/api/autoreview?rule=${encodeURIComponent(r.id)}`, { method: "DELETE" });
                    await refresh();
                  }}
                  type="button"
                >
                  <Trash2Icon className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12.5px] text-neutral-500">No rules yet. “Always allow” on an approval card adds one here.</p>
        )}
      </div>
    </Card>
  );
}

function Computer() {
  const { data } = usePoll<ComputerResponse>("/api/computer", 5000);
  const computer = data?.computer;
  return (
    <Card className="space-y-4 p-5" id="computer">
      <div>
        <div className="flex items-center gap-2 text-[14.5px] text-white">
          <MonitorIcon className="size-4 text-neutral-500" /> Bez Bot's Computer
        </div>
        <p className="mt-1 max-w-xl text-[12.5px] text-neutral-500">
          One cloud computer for your account. Every Bot shares its files, browser sessions, and sign-ins, and gets its own screen.
          {computer ? ` ${computer.sandboxKind === "vercel" ? "Running on Vercel Sandbox" : "Running locally"}.` : ""}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 text-[12px] text-neutral-500">/workspace/shared · {computer?.files.length ?? 0} files</div>
          <ul className="scrollbar-thin max-h-56 space-y-1 overflow-y-auto">
            {(computer?.files ?? []).map((f) => (
              <li className="flex items-center gap-2" key={f.path}>
                <a className="min-w-0 flex-1 truncate font-mono text-[12px] text-neutral-400 hover:text-white" href={`/api/computer/file?path=${encodeURIComponent(f.path)}`} rel="noreferrer" target="_blank">
                  {f.path}
                </a>
                <span className="shrink-0 text-[11px] text-neutral-600">{Math.max(1, Math.round(f.size / 1024))} KB</span>
              </li>
            ))}
            {computer && computer.files.length === 0 ? <li className="text-[12.5px] text-neutral-500">Empty so far.</li> : null}
          </ul>
        </div>
        <div>
          <div className="mb-2 text-[12px] text-neutral-500">Activity</div>
          <ActivityList items={computer?.activity ?? []} limit={10} />
        </div>
      </div>
    </Card>
  );
}

function Logins() {
  const { data, refresh } = usePoll<{ entries: PublicVaultEntry[] }>("/api/vault", 0);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ label: "", site: "", username: "", password: "", notes: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[14.5px] text-white">
            <KeyRoundIcon className="size-4 text-neutral-500" /> Logins
          </div>
          <p className="mt-1 max-w-xl text-[12.5px] text-neutral-500">
            Log Bez Bot in once. Bots type these into the computer when a site asks them to sign in. Passwords are encrypted and never shown to the model.
          </p>
        </div>
        <button className={buttonSecondary} onClick={() => setAdding((v) => !v)} type="button">
          <PlusIcon className="size-4" /> Add login
        </button>
      </div>
      {adding ? (
        <form
          className="grid gap-3 rounded-2xl border border-white/[0.06] p-4 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            setError(undefined);
            try {
              await api("/api/vault", { method: "POST", json: { ...form, notes: form.notes || undefined } });
              setForm({ label: "", site: "", username: "", password: "", notes: "" });
              setAdding(false);
              await refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not save.");
            } finally {
              setPending(false);
            }
          }}
        >
          <input className={inputClass} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Label (e.g. Zendesk)" required value={form.label} />
          <input className={inputClass} onChange={(e) => setForm({ ...form, site: e.target.value })} placeholder="Site (e.g. acme.zendesk.com)" required value={form.site} />
          <input autoComplete="off" className={inputClass} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="Username or email" required value={form.username} />
          <input autoComplete="new-password" className={inputClass} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Password" required type="password" value={form.password} />
          <input className={`${inputClass} sm:col-span-2`} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes for the bots (optional, e.g. 'use SSO button')" value={form.notes} />
          {error ? <p className="text-[12.5px] text-red-400 sm:col-span-2">{error}</p> : null}
          <div className="flex items-center gap-2 sm:col-span-2">
            <button className={buttonPrimary} disabled={pending} type="submit">
              {pending ? <Loader2Icon className="size-4 animate-spin" /> : <LockIcon className="size-4" />} Save login
            </button>
          </div>
        </form>
      ) : null}
      {data?.entries.length ? (
        <ul className="divide-y divide-white/[0.05]">
          {data.entries.map((entry) => (
            <li className="flex items-center gap-3 py-2.5" key={entry.id}>
              <span className="flex size-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03]">
                <LockIcon className="size-3.5 text-neutral-400" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] text-white">{entry.label}</div>
                <div className="truncate text-[12px] text-neutral-500">
                  {entry.username} · {entry.site} · added {timeAgo(entry.createdAt)}
                </div>
              </div>
              <button
                aria-label="Delete login"
                className="rounded-lg p-1.5 text-neutral-500 hover:text-red-300"
                onClick={async () => {
                  await api(`/api/vault?id=${encodeURIComponent(entry.id)}`, { method: "DELETE" });
                  await refresh();
                }}
                type="button"
              >
                <Trash2Icon className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : !adding ? (
        <p className="text-[13px] text-neutral-500">No saved logins yet.</p>
      ) : null}
    </Card>
  );
}

export default function SettingsPage() {
  return (
    <AppPage>
      <AppHeader body="How Bez Bot works for you: your timezone, Auto-review, and the computer your Bots share." title="Settings" />
      <div className="space-y-4">
        <General />
        <AutoReview />
        <Computer />
        <Logins />
        <Card className="space-y-2 p-5 text-[13px] text-neutral-400">
          <div className="text-[14.5px] text-white">Under the hood</div>
          <p>
            Bez Bot runs on <a className="text-white underline underline-offset-2" href="https://eve.dev/docs">eve</a>: each Bot keeps one durable
            session as its conversation, messages between Bots and routine runs are delivered into those sessions, and every Bot works on the
            same sandboxed computer.
          </p>
        </Card>
      </div>
    </AppPage>
  );
}
