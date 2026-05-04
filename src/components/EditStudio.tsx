import { useEffect, useRef, useState } from "react";
import { SkipBack, Play, Pause, SkipForward, Volume2, Maximize2, Scissors, Undo2, Redo2, Film, ZoomIn, ZoomOut, Video, Image as ImageIcon, Layout, ArrowLeft, List, Plus } from "lucide-react";
import { useStudio } from "@/state/studio";
import ChaptersPanel from "@/components/ChaptersPanel";

export default function EditStudio() {
  const { recording, setView } = useStudio();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [chaptersOpen, setChaptersOpen] = useState(false);

  const duration = recording?.duration ?? 0;

  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    const onT = () => setTime(v.currentTime);
    v.addEventListener("timeupdate", onT);
    return () => v.removeEventListener("timeupdate", onT);
  }, []);

  if (!recording) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
        Nenhuma gravação. <button onClick={() => setView("record")} className="ml-2 text-primary underline">Gravar agora</button>
      </div>
    );
  }

  const currentSlide = (() => {
    const m = [...recording.slideMarkers].reverse().find((x) => x.time <= time);
    if (!m) return recording.slides[0];
    return recording.slides.find((s) => s.id === m.slideId);
  })();

  const seek = (t: number) => { if (videoRef.current) { videoRef.current.currentTime = t; setTime(t); } };
  const toggle = () => {
    const v = videoRef.current; if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); } else { v.pause(); setPlaying(false); }
  };

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const pct = duration ? (time / duration) * 100 : 0;
  const ticks = Math.max(10, Math.ceil(duration));

  // build segments per track
  const slideSegments = recording.slideMarkers.map((m, i) => {
    const next = recording.slideMarkers[i + 1]?.time ?? duration;
    return { ...m, end: next, slide: recording.slides.find((s) => s.id === m.slideId) };
  });

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-background">
      {/* top */}
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setView("home")} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
          <button onClick={() => setChaptersOpen(true)} className="flex items-center gap-1.5 rounded-md bg-card px-3 py-1.5 text-sm ring-1 ring-border hover:bg-muted">
            <List className="h-4 w-4" /> Capítulos
          </button>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">Lector</span>
          <span className="font-semibold text-[hsl(var(--rec))]">live</span>
        </div>
      </header>

      {chaptersOpen && <ChaptersPanel onClose={() => setChaptersOpen(false)} segments={slideSegments} onSeek={seek} />}

      {/* preview */}
      <div className="flex flex-1 items-center justify-center gap-6 px-10 pb-4 pt-4">
        <div className="relative h-[260px] w-[340px] overflow-hidden rounded-xl border-2 border-primary shadow-2xl">
          <video ref={videoRef} src={recording.videoUrl} className="h-full w-full object-cover bg-black" />
          <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--rec))] animate-pulse" /> WEBCAM
          </div>
        </div>
        <div className="flex h-[420px] flex-1 max-w-[900px] items-center justify-center rounded-2xl bg-[hsl(var(--slide-bg))] p-4 ring-1 ring-white/5">
          {currentSlide ? (
            <img src={currentSlide.url} alt="slide" className="max-h-full max-w-full rounded-lg object-contain" />
          ) : (
            <div className="text-muted-foreground text-sm">Sem slides</div>
          )}
        </div>
      </div>

      {/* player bar */}
      <div className="px-6">
        <div className="relative h-1 w-full cursor-pointer rounded-full bg-muted" onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          seek(((e.clientX - r.left) / r.width) * duration);
        }}>
          <div className="absolute left-0 top-0 h-1 rounded-full bg-[hsl(var(--rec))]" style={{ width: `${pct}%` }} />
          <div className="absolute -top-1 h-3 w-3 -translate-x-1/2 rounded-full bg-[hsl(var(--rec))]" style={{ left: `${pct}%` }} />
          {recording.slideMarkers.map((m, i) => (
            <div key={i} className="absolute -top-0.5 h-2 w-0.5 bg-emerald-400" style={{ left: `${(m.time / duration) * 100}%` }} />
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button onClick={() => seek(0)} className="rounded-full p-1.5 hover:bg-muted"><SkipBack className="h-4 w-4" /></button>
            <button onClick={toggle} className="rounded-full bg-primary p-1.5 text-primary-foreground hover:bg-primary/90">
              {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
            </button>
            <button onClick={() => seek(duration)} className="rounded-full p-1.5 hover:bg-muted"><SkipForward className="h-4 w-4" /></button>
          </div>
          <div className="text-xs text-muted-foreground">{currentSlide?.name ?? "—"}</div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Volume2 className="h-4 w-4" />
            <Maximize2 className="h-4 w-4" />
            <span className="font-mono tabular-nums">{fmt(time)} / {fmt(duration)}</span>
          </div>
        </div>
      </div>

      {/* timeline */}
      <div className="mt-2 bg-[hsl(var(--timeline-bg))] px-2 pb-2">
        <div className="ml-20 flex select-none border-b border-border/60 text-[10px] text-muted-foreground">
          {Array.from({ length: ticks }).map((_, i) => (
            <div key={i} className="flex-1 border-l border-border/40 px-1 py-1">00:{String(i).padStart(2, "0")}</div>
          ))}
        </div>

        <Track icon={Video} label="Vídeo">
          <div className="absolute inset-y-0.5 left-0 right-0 rounded bg-primary/30 ring-1 ring-primary/50" />
        </Track>
        <Track icon={ImageIcon} label="Slides">
          {slideSegments.map((s, i) => (
            <div key={i} className="absolute inset-y-0.5 rounded bg-emerald-500/30 ring-1 ring-emerald-500/50" style={{ left: `${(s.time / duration) * 100}%`, width: `${((s.end - s.time) / duration) * 100}%` }}>
              <div className="truncate px-1 text-[10px] leading-[26px] text-emerald-100">{s.slide?.name}</div>
            </div>
          ))}
        </Track>
        <Track icon={Volume2} label="Áudio">
          <div className="absolute inset-y-0.5 left-0 right-0 rounded bg-fuchsia-500/20 ring-1 ring-fuchsia-500/40" />
        </Track>
        <Track icon={Layout} label="Layout">
          <div className="absolute inset-y-0.5 left-0 right-0 rounded bg-zinc-700/30" />
        </Track>

        {/* playhead overlay */}
        <div className="pointer-events-none relative -mt-[120px] ml-20 h-[120px]">
          <div className="absolute top-0 h-full w-px bg-[hsl(var(--rec))]" style={{ left: `${pct}%` }} />
        </div>
      </div>

      {/* bottom bar */}
      <div className="flex items-center justify-between border-t border-border bg-[hsl(0_0%_4%)] px-4 py-2">
        <div className="flex items-center gap-1">
          <button onClick={() => setView("record")} className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
            <span className="flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> Nova gravação</span>
          </button>
          <span className="rounded-md bg-primary/15 px-3 py-1.5 text-sm font-medium text-[hsl(var(--rec))] ring-1 ring-[hsl(var(--rec))]/40">Edição</span>
        </div>
        <div className="flex items-center gap-3">
          {[Scissors, Undo2, Redo2, Film, ZoomOut, ZoomIn].map((Icon, i) => (
            <button key={i} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Icon className="h-4 w-4" /></button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Track({ icon: Icon, label, children }: { icon: any; label: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center">
      <div className="flex w-20 items-center gap-1.5 py-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="relative my-1 h-7 flex-1 rounded bg-[hsl(var(--track-bg))] ring-1 ring-border/50">
        {children}
      </div>
    </div>
  );
}
