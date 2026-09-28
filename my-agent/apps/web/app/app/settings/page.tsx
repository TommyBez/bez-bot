"use client";

import { KeyRoundIcon, Loader2Icon, LockIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { useAppState } from "@/components/app/app-state";
import { AppHeader, AppPage, buttonPrimary, buttonSecondary, Card, inputClass } from "@/components/app/page-header";
import { api, timeAgo, usePoll } from "@/lib/client";
import type { VaultEntry } from "@shared/store/types";

type PublicVaultEntry = Omit<VaultEntry, "secret">;

function Profile() {
  const { state, refresh } = useAppState();
  const [name, setName] = useState(state.user.name);
  const [timezone, setTimezone] = useState(state.user.timezone ?? "UTC");
  const [saving, setSaving] = useState(false);
  const zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [timezone];
  return (
    <Card className="space-y-4 p-5">
      <div className="text-[14.5px] text-white">Profile</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-[13px] text-neutral-400">Name</span>
          <input className={inputClass} onChange={(e) => setName(e.target.value)} value={name} />
        </label>
        <label className="space-y-1.5">
          <span className="text-[13px] text-neutral-400">Timezone (routines run on this clock)</span>
          <select className={inputClass} onChange={(e) => setTimezone(e.target.value)} value={timezone}>
            {zones.map((z) => (
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
            Log Bez Bot in once. Bots type these into their computer when a site asks them to sign in. Passwords are encrypted and never shown to the model.
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
      <AppHeader body="Your profile, the logins your bots can use, and how Bez Bot runs." title="Settings" />
      <div className="space-y-4">
        <Profile />
        <Logins />
        <Card className="space-y-2 p-5 text-[13px] text-neutral-400">
          <div className="text-[14.5px] text-white">Under the hood</div>
          <p>
            Bez Bot runs on <a className="text-white underline underline-offset-2" href="https://eve.dev/docs">eve</a>: every conversation is a
            durable session, bot-to-bot messages are durable workflow tool calls, routines are dispatched by an eve schedule every minute, and
            each bot works in its own sandboxed computer.
          </p>
        </Card>
      </div>
    </AppPage>
  );
}
