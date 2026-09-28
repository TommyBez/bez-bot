"use client";

import { CircleStopIcon, Loader2Icon, MonitorUpIcon, PlayIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BotAvatar } from "@/components/bez/bot-avatar";
import type { Bot } from "@shared/store/types";

export interface TeachCapture {
  frames: { dataUrl: string; atMs: number }[];
  notes: string;
  durationMs: number;
}

const FRAME_INTERVAL_MS = 2500;
const MAX_FRAMES = 16;
const FRAME_WIDTH = 1280;

/**
 * "Show a Bot how it's done": records the user's screen while they complete a
 * workflow, samples frames, and hands them (with the user's narration) to the
 * bot so it can write the routine.
 */
export function TeachRecorder({
  bot,
  onComplete,
  onCancel,
}: {
  readonly bot: Bot;
  readonly onComplete: (capture: TeachCapture) => void | Promise<void>;
  readonly onCancel: () => void;
}) {
  const [phase, setPhase] = useState<"idle" | "recording" | "sending">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string>();
  const [frameCount, setFrameCount] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const framesRef = useRef<{ dataUrl: string; atMs: number }[]>([]);
  const startedAt = useRef(0);

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  useEffect(() => {
    if (phase !== "recording") return;
    const tick = window.setInterval(() => setElapsed(Date.now() - startedAt.current), 250);
    const sample = window.setInterval(() => grabFrame(), FRAME_INTERVAL_MS);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(sample);
    };
  }, [phase]);

  function grabFrame() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const scale = Math.min(1, FRAME_WIDTH / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    framesRef.current.push({ dataUrl: canvas.toDataURL("image/jpeg", 0.6), atMs: Date.now() - startedAt.current });
    setFrameCount(framesRef.current.length);
  }

  async function start() {
    setError(undefined);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 5 }, audio: false });
      streamRef.current = stream;
      stream.getVideoTracks()[0]?.addEventListener("ended", () => void stop());
      const video = document.createElement("video");
      video.muted = true;
      video.srcObject = stream;
      await video.play();
      videoRef.current = video;
      framesRef.current = [];
      startedAt.current = Date.now();
      setElapsed(0);
      setFrameCount(0);
      setPhase("recording");
      window.setTimeout(grabFrame, 400);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Screen recording was blocked.");
    }
  }

  async function stop() {
    if (phase === "sending") return;
    grabFrame();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const all = framesRef.current;
    // Evenly sample so long demos still fit the model's image budget.
    const step = Math.max(1, Math.ceil(all.length / MAX_FRAMES));
    const frames = all.filter((_, i) => i % step === 0).slice(0, MAX_FRAMES);
    setPhase("sending");
    await onComplete({ frames, notes, durationMs: Date.now() - startedAt.current });
  }

  const seconds = Math.floor(elapsed / 1000);
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0c0c0e] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BotAvatar color={bot.color} emoji={bot.emoji} size="sm" />
          <div>
            <div className="text-[13.5px] text-white">{bot.name}</div>
            <div className={phase === "recording" ? "shimmer-text text-[12px]" : "text-[12px] text-neutral-500"}>
              {phase === "recording" ? "is watching and learning" : phase === "sending" ? "is studying your recording" : "will follow along as you work"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {phase === "recording" ? (
            <span className="flex items-center gap-2 font-mono text-[12.5px] text-red-300">
              <span className="size-2 animate-pulse-dot rounded-full bg-red-500" />
              {clock} · {frameCount} frames
            </span>
          ) : null}
          <button aria-label="Close" className="text-neutral-500 hover:text-white" onClick={onCancel} type="button">
            <XIcon className="size-4" />
          </button>
        </div>
      </div>
      <textarea
        className="min-h-16 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-white outline-none placeholder:text-neutral-600 focus:border-white/25"
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Narrate as you go: what you're doing and why (e.g. “every Monday I export last week's signups from Looker…”)."
        value={notes}
      />
      {error ? <p className="text-[12.5px] text-red-400">{error}</p> : null}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11.5px] text-neutral-600">Frames stay in this conversation. Don&apos;t record passwords or private data.</p>
        {phase === "idle" ? (
          <button className="inline-flex h-9 items-center gap-2 rounded-full bg-white px-4 text-[13px] font-medium text-black hover:bg-neutral-200" onClick={start} type="button">
            <MonitorUpIcon className="size-4" /> Start recording
          </button>
        ) : phase === "recording" ? (
          <button className="inline-flex h-9 items-center gap-2 rounded-full bg-red-500 px-4 text-[13px] font-medium text-white hover:bg-red-400" onClick={() => void stop()} type="button">
            <CircleStopIcon className="size-4" /> Done, save as routine
          </button>
        ) : (
          <span className="inline-flex h-9 items-center gap-2 text-[13px] text-neutral-400">
            <Loader2Icon className="size-4 animate-spin" /> Sending
          </span>
        )}
      </div>
      {phase === "idle" ? (
        <button
          className="inline-flex items-center gap-1.5 text-[12px] text-neutral-500 hover:text-white"
          onClick={() => void onComplete({ frames: [], notes, durationMs: 0 })}
          type="button"
        >
          <PlayIcon className="size-3" /> Or just describe the steps in the box and send
        </button>
      ) : null}
    </div>
  );
}
