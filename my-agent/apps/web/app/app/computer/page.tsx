"use client";

import { DownloadIcon, FileIcon, FolderIcon } from "lucide-react";
import { ActivityList, Screen, type ComputerResponse } from "@/components/app/chat/computer-peek";
import { AppHeader, AppPage, Card } from "@/components/app/page-header";
import { StatusDot } from "@/components/bez/bot-avatar";
import { timeAgo, usePoll } from "@/lib/client";

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function ComputerPage() {
  const { data } = usePoll<ComputerResponse>("/api/computer", 4000);
  const computer = data?.computer;
  const working = computer?.activity[0] && Date.now() - new Date(computer.activity[0].at).getTime() < 60_000;
  const folders = new Map<string, { path: string; size: number }[]>();
  for (const f of computer?.files ?? []) {
    const dir = f.path.includes("/") ? f.path.slice(0, f.path.lastIndexOf("/")) : ".";
    folders.set(dir, [...(folders.get(dir) ?? []), f]);
  }

  return (
    <AppPage wide>
      <AppHeader
        body={
          <span className="flex items-center gap-2">
            <StatusDot className="size-2 ring-0" status={working ? "working" : "idle"} />
            {working ? "A bot is using the computer" : "Idle"} · Every bot shares this machine&apos;s drive, browser profile, and saved logins.
          </span>
        }
        title="Computer"
      />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between text-[13px]">
              <span className="text-white">Desktop</span>
              <span className="text-neutral-500">{computer?.lastScreenshotAt ? `Updated ${timeAgo(computer.lastScreenshotAt)}` : data?.desktop ? "Ready" : "Terminal only"}</span>
            </div>
            <Screen at={computer?.lastScreenshotAt} desktop={data?.desktop ?? false} />
          </Card>
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between text-[13px]">
              <span className="text-white">Shared drive</span>
              <span className="text-neutral-500">
                {computer?.files.length ?? 0} files · {formatBytes(computer?.snapshotBytes ?? 0)} · /workspace/shared
              </span>
            </div>
            {computer && computer.files.length > 0 ? (
              <div className="space-y-4">
                {[...folders.entries()].map(([dir, files]) => (
                  <div key={dir}>
                    <div className="mb-1.5 flex items-center gap-2 text-[12.5px] text-neutral-400">
                      <FolderIcon className="size-3.5" /> {dir === "." ? "shared" : dir}
                    </div>
                    <ul className="divide-y divide-white/[0.04] rounded-xl border border-white/[0.06]">
                      {files.map((f) => (
                        <li className="flex items-center gap-2.5 px-3 py-2" key={f.path}>
                          <FileIcon className="size-3.5 text-neutral-500" />
                          <a
                            className="min-w-0 flex-1 truncate font-mono text-[12px] text-neutral-300 hover:text-white"
                            href={`/api/computer/file?path=${encodeURIComponent(f.path)}`}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {f.path.split("/").pop()}
                          </a>
                          <span className="text-[11.5px] text-neutral-600">{formatBytes(f.size)}</span>
                          <a aria-label="Download" className="text-neutral-500 hover:text-white" download href={`/api/computer/file?path=${encodeURIComponent(f.path)}`}>
                            <DownloadIcon className="size-3.5" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-neutral-500">
                Files your bots save under <span className="font-mono text-neutral-400">/workspace/shared</span> persist across tasks and are visible to every bot. They show up here.
              </p>
            )}
          </Card>
        </div>
        <Card className="p-4">
          <div className="mb-3 text-[13px] text-white">Activity</div>
          <ActivityList items={computer?.activity ?? []} limit={60} />
        </Card>
      </div>
    </AppPage>
  );
}
