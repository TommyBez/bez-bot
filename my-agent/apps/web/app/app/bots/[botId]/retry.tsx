"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";

export function RetryConversation({ botId, name, message }: { readonly botId: string; readonly name: string; readonly message?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(message);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="text-[15px] text-white">Couldn't open {name}'s conversation</div>
      <p className="max-w-md text-[13px] text-neutral-500">{error ?? "The agent runtime isn't reachable yet."}</p>
      <button
        className="inline-flex h-9 items-center gap-2 rounded-full bg-white px-4 text-[13px] font-medium text-black disabled:opacity-50"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api(`/api/bots/${botId}/session`, { method: "POST" });
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Still unreachable.");
          } finally {
            setBusy(false);
          }
        }}
        type="button"
      >
        {busy ? <Loader2Icon className="size-4 animate-spin" /> : null} Try again
      </button>
    </div>
  );
}
