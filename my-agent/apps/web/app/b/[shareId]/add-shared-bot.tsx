"use client";

import { Loader2Icon } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/client";
import type { Bot } from "@shared/store/types";

export function AddSharedBot({ shareId, signedIn }: { readonly shareId: string; readonly signedIn: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <div className="space-y-2">
      <button
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-[15px] font-medium text-black hover:bg-neutral-200 disabled:opacity-60"
        disabled={pending}
        onClick={async () => {
          if (!signedIn) {
            window.location.assign(`/login?next=${encodeURIComponent(`/b/${shareId}`)}`);
            return;
          }
          setPending(true);
          try {
            const { bot } = await api<{ bot: Bot }>(`/api/shared/${shareId}`, { method: "POST" });
            window.location.assign(`/app/bots/${bot.id}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not add this bot.");
            setPending(false);
          }
        }}
        type="button"
      >
        {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
        Add to Bez Bot
      </button>
      {error ? <p className="text-[13px] text-red-400">{error}</p> : null}
    </div>
  );
}
