import { useEffect, useMemo, useRef, useState } from "react";
import { SkipBack, Play, Pause, SkipForward, Volume2, Maximize2, Scissors, Trash2, Save, Video, Image as ImageIcon, Layout, ArrowLeft, List, Plus, GripVertical } from "lucide-react";
import { useStudio } from "@/state/studio";
import ChaptersPanel from "@/components/ChaptersPanel";
import { toast } from "sonner";

type Segment = {
  id: string;
  track: "video" | "slides" | "audio";
  srcStart: number; // original media time
  srcEnd: number;
  label: string;
  slideUrl?: string;
};

const uid = () => Math.random().toString(36).slice(2, 9);

export default function EditStudio() {
  const { recording, setView } = useStudio();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [time, setTime] = useState(0); // edited timeline time
  const [playing, setPlaying] = useState(false);
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  // initialize segments from recording
  useEffect(() => {
    if (!recording) return;
    const dur = recording.duration;
    const initial: Segment[] = [
      { id: uid(), track: "video", srcStart: 0, srcEnd: dur, label: "Webcam" },
      { id: uid(), track: "audio", srcStart: 0, srcEnd: dur, label: "Áudio" },
      ...recording.slideMarkers.map((m, i) => {
        const next = recording.slideMarkers[i + 1]?.time ?? dur;
        const slide = recording.slides.find((s) => s.id === m.slideId);
        return { id: uid(), track: "slides" as const, srcStart: m.time, srcEnd: next, label: slide?.name ?? `Slide ${i + 1}`, slideUrl: slide?.url };
      }),
    ];
    setSegments(initial);
  }, [recording]);

  const videoSegs = useMemo(() => segments.filter((s) => s.track === "video"), [segments]);
  const slideSegs = useMemo(() => segments.filter((s) => s.track === "slides"), [segments]);
  const audioSegs = useMemo(() => segments.filter((s) => s.track === "audio"), [segments]);

  // edited duration = max track length (video drives it)
  const lengthOf = (segs: Segment[]) => segs.reduce((a, s) => a + (s.srcEnd - s.srcStart), 0);
  const duration = Math.max(lengthOf(videoSegs), lengthOf(slideSegs), lengthOf(audioSegs), 1);

  // map timeline time -> source time on video track
  const mapToSource = (t: number): { srcTime: number; segIdx: number } | null => {
    let acc = 0;
    for (let i = 0; i < videoSegs.length; i++) {
      const len = videoSegs[i].srcEnd - videoSegs[i].srcStart;
      if (t < acc + len) return { srcTime: videoSegs[i].srcStart + (t - acc), segIdx: i };
      acc += len;
    }
    return null;
  };

  // slide visible at edited time
  const currentSlide = useMemo(() => {
    let acc = 0;
    for (const s of slideSegs) {
      const len = s.srcEnd - s.srcStart;
      if (time < acc + len) return s;
      acc += len;
    }
    return slideSegs[slideSegs.length - 1];
  }, [time, slideSegs]);

  // playback loop using rAF, advances timeline time and seeks video to mapped source time
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setTime((prev) => {
        const nt = prev + dt;
        if (nt >= duration) { setPlaying(false); videoRef.current?.pause(); return duration; }
        const m = mapToSource(nt);
        const v = videoRef.current;
        if (v && m && Math.abs(v.currentTime - m.srcTime) > 0.25) v.currentTime = m.srcTime;
        return nt;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, duration, videoSegs]);

  if (!recording) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
        Nenhuma gravação. <button onClick={() => setView("record")} className="ml-2 text-primary underline">Gravar agora</button>
      </div>
    );
  }

  const seek = (t: number) => {
    const nt = Math.max(0, Math.min(duration, t));
    setTime(nt);
    const m = mapToSource(nt);
    if (videoRef.current && m) videoRef.current.currentTime = m.srcTime;
  };

  const toggle = () => {
    const v = videoRef.current; if (!v) return;
    if (!playing) { v.play().catch(() => {}); setPlaying(true); } else { v.pause(); setPlaying(false); }
  };

  // ========= EDIT OPERATIONS =========
  // find local time within segment given edited time
  const localTimeIn = (seg: Segment, t: number): number | null => {
    const ordered = segments.filter((s) => s.track === seg.track);
    let acc = 0;
    for (const s of ordered) {
      const len = s.srcEnd - s.srcStart;
      if (s.id === seg.id) {
        if (t < acc || t > acc + len) return null;
        return t - acc;
      }
      acc += len;
    }
    return null;
  };

  const splitAtPlayhead = () => {
    const sel = segments.find((s) => s.id === selectedId);
    if (!sel) return toast.error("Selecione um segmento");
    const local = localTimeIn(sel, time);
    if (local === null || local <= 0.05 || local >= sel.srcEnd - sel.srcStart - 0.05) {
      return toast.error("Posicione o cursor dentro do segmento");
    }
    const splitSrc = sel.srcStart + local;
    const a: Segment = { ...sel, id: uid(), srcEnd: splitSrc };
    const b: Segment = { ...sel, id: uid(), srcStart: splitSrc };
    setSegments((prev) => prev.flatMap((s) => (s.id === sel.id ? [a, b] : [s])));
    setSelectedId(b.id);
    toast.success("Dividido");
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setSegments((prev) => prev.filter((s) => s.id !== selectedId));
    setSelectedId(null);
  };

  const trimSegment = (id: string, edge: "start" | "end", deltaSrc: number) => {
    setSegments((prev) => prev.map((s) => {
      if (s.id !== id) return s;
      if (edge === "start") {
        const ns = Math.max(0, Math.min(s.srcEnd - 0.1, s.srcStart + deltaSrc));
        return { ...s, srcStart: ns };
      } else {
        const ne = Math.max(s.srcStart + 0.1, s.srcEnd + deltaSrc);
        return { ...s, srcEnd: ne };
      }
    }));
  };

  const moveSegment = (id: string, dir: -1 | 1) => {
    setSegments((prev) => {
      const seg = prev.find((s) => s.id === id); if (!seg) return prev;
      const sameTrack = prev.filter((s) => s.track === seg.track);
      const idx = sameTrack.findIndex((s) => s.id === id);
      const swap = sameTrack[idx + dir]; if (!swap) return prev;
      const order = prev.slice();
      const i1 = order.indexOf(seg), i2 = order.indexOf(swap);
      [order[i1], order[i2]] = [order[i2], order[i1]];
      return order;
    });
  };

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const pct = (time / duration) * 100;
  const ticks = Math.max(10, Math.ceil(duration));
  const PX_PER_SEC = 40 * zoom;
  const trackPxWidth = duration * PX_PER_SEC;

  // chapters from slide segments (edited)
  const editedSlideMarkers = (() => {
    let acc = 0;
    return slideSegs.map((s) => {
      const out = { slideId: s.id, time: acc, end: acc + (s.srcEnd - s.srcStart), slide: { name: s.label } };
      acc += (s.srcEnd - s.srcStart);
      return out;
    });
  })();

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setView("home")} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
          <button onClick={() => setChaptersOpen(true)} className="flex items-center gap-1.5 rounded-md bg-card px-3 py-1.5 text-sm ring-1 ring-border hover:bg-muted">
            <List className="h-4 w-4" /> Capítulos
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => toast.success("Projeto salvo")} className="flex items-center gap-1.5 rounded-md bg-[hsl(var(--rec))] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">
            <Save className="h-4 w-4" /> Salvar
          </button>
        </div>
      </header>

      {chaptersOpen && <ChaptersPanel onClose={() => setChaptersOpen(false)} segments={editedSlideMarkers} onSeek={seek} />}

      <div className="flex flex-1 items-center justify-center gap-6 px-10 pb-4 pt-4">
        <div className="relative h-[220px] w-[300px] overflow-hidden rounded-xl border-2 border-primary shadow-2xl">
          <video ref={videoRef} src={recording.videoUrl} className="h-full w-full object-cover bg-black" />
          <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--rec))] animate-pulse" /> WEBCAM
          </div>
        </div>
        <div className="flex h-[380px] flex-1 max-w-[820px] items-center justify-center rounded-2xl bg-[hsl(var(--slide-bg))] p-4 ring-1 ring-white/5">
          {currentSlide?.slideUrl ? (
            <img src={currentSlide.slideUrl} alt="slide" className="max-h-full max-w-full rounded-lg object-contain" />
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
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button onClick={() => seek(0)} className="rounded-full p-1.5 hover:bg-muted"><SkipBack className="h-4 w-4" /></button>
            <button onClick={toggle} className="rounded-full bg-primary p-1.5 text-primary-foreground hover:bg-primary/90">
              {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
            </button>
            <button onClick={() => seek(duration)} className="rounded-full p-1.5 hover:bg-muted"><SkipForward className="h-4 w-4" /></button>
          </div>
          <div className="text-xs text-muted-foreground">{currentSlide?.label ?? "—"}</div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Volume2 className="h-4 w-4" />
            <Maximize2 className="h-4 w-4" />
            <span className="font-mono tabular-nums">{fmt(time)} / {fmt(duration)}</span>
          </div>
        </div>
      </div>

      {/* edit toolbar */}
      <div className="mt-2 flex items-center gap-2 px-4">
        <button onClick={splitAtPlayhead} disabled={!selectedId} className="flex items-center gap-1.5 rounded-md bg-card px-2.5 py-1.5 text-xs ring-1 ring-border hover:bg-muted disabled:opacity-40">
          <Scissors className="h-3.5 w-3.5" /> Dividir
        </button>
        <button onClick={deleteSelected} disabled={!selectedId} className="flex items-center gap-1.5 rounded-md bg-card px-2.5 py-1.5 text-xs ring-1 ring-border hover:bg-muted disabled:opacity-40">
          <Trash2 className="h-3.5 w-3.5" /> Apagar
        </button>
        <button onClick={() => selectedId && moveSegment(selectedId, -1)} disabled={!selectedId} className="rounded-md bg-card px-2.5 py-1.5 text-xs ring-1 ring-border hover:bg-muted disabled:opacity-40">◀ Mover</button>
        <button onClick={() => selectedId && moveSegment(selectedId, 1)} disabled={!selectedId} className="rounded-md bg-card px-2.5 py-1.5 text-xs ring-1 ring-border hover:bg-muted disabled:opacity-40">Mover ▶</button>
        <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          <button onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))} className="rounded-md px-2 py-1 hover:bg-muted">−</button>
          Zoom {Math.round(zoom * 100)}%
          <button onClick={() => setZoom((z) => Math.min(4, z + 0.2))} className="rounded-md px-2 py-1 hover:bg-muted">+</button>
        </div>
      </div>

      {/* timeline */}
      <div className="mt-2 flex-1 overflow-auto bg-[hsl(var(--timeline-bg))] px-2 pb-4 scrollbar-thin">
        <div className="flex">
          <div className="w-20 shrink-0" />
          <div className="relative" style={{ width: trackPxWidth }}>
            <div className="flex select-none border-b border-border/60 text-[10px] text-muted-foreground" style={{ width: trackPxWidth }}>
              {Array.from({ length: ticks }).map((_, i) => (
                <div key={i} style={{ width: PX_PER_SEC }} className="border-l border-border/40 px-1 py-1">{fmt(i)}</div>
              ))}
            </div>
          </div>
        </div>

        <TrackRow icon={Video} label="Vídeo" segs={videoSegs} totalPx={trackPxWidth} pxPerSec={PX_PER_SEC} selectedId={selectedId} setSelectedId={setSelectedId} trimSegment={trimSegment} colorClass="bg-primary/30 ring-primary/60" />
        <TrackRow icon={ImageIcon} label="Slides" segs={slideSegs} totalPx={trackPxWidth} pxPerSec={PX_PER_SEC} selectedId={selectedId} setSelectedId={setSelectedId} trimSegment={trimSegment} colorClass="bg-emerald-500/30 ring-emerald-500/60" />
        <TrackRow icon={Volume2} label="Áudio" segs={audioSegs} totalPx={trackPxWidth} pxPerSec={PX_PER_SEC} selectedId={selectedId} setSelectedId={setSelectedId} trimSegment={trimSegment} colorClass="bg-fuchsia-500/25 ring-fuchsia-500/50" />

        {/* playhead */}
        <div className="pointer-events-none relative" style={{ marginLeft: 80, marginTop: -120, height: 120, width: trackPxWidth }}>
          <div className="absolute top-0 h-full w-px bg-[hsl(var(--rec))]" style={{ left: time * PX_PER_SEC }} />
        </div>
      </div>
    </div>
  );
}

function TrackRow({ icon: Icon, label, segs, totalPx, pxPerSec, selectedId, setSelectedId, trimSegment, colorClass }: {
  icon: any; label: string; segs: Segment[]; totalPx: number; pxPerSec: number; selectedId: string | null; setSelectedId: (id: string) => void; trimSegment: (id: string, edge: "start" | "end", deltaSrc: number) => void; colorClass: string;
}) {
  let acc = 0;
  return (
    <div className="flex items-stretch">
      <div className="flex w-20 shrink-0 items-center gap-1.5 py-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="relative my-1 h-9 rounded bg-[hsl(var(--track-bg))] ring-1 ring-border/50" style={{ width: totalPx }}>
        {segs.map((s) => {
          const len = s.srcEnd - s.srcStart;
          const left = acc * pxPerSec;
          const width = len * pxPerSec;
          acc += len;
          const selected = selectedId === s.id;
          return (
            <div
              key={s.id}
              onMouseDown={(e) => { if ((e.target as HTMLElement).dataset.handle) return; setSelectedId(s.id); }}
              className={`group absolute inset-y-0.5 cursor-pointer overflow-hidden rounded ring-1 ${colorClass} ${selected ? "outline outline-2 outline-[hsl(var(--rec))]" : ""}`}
              style={{ left, width }}
            >
              <div className="flex h-full items-center gap-1 px-1.5 text-[10px] text-foreground/90">
                <GripVertical className="h-3 w-3 opacity-50" />
                <span className="truncate">{s.label}</span>
              </div>
              <Handle onDrag={(d) => trimSegment(s.id, "start", d / pxPerSec)} side="left" />
              <Handle onDrag={(d) => trimSegment(s.id, "end", d / pxPerSec)} side="right" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Handle({ side, onDrag }: { side: "left" | "right"; onDrag: (deltaPx: number) => void }) {
  const startX = useRef(0);
  const onDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    startX.current = e.clientX;
    let last = e.clientX;
    const move = (ev: MouseEvent) => {
      const d = ev.clientX - last;
      last = ev.clientX;
      onDrag(d);
    };
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };
  return (
    <div
      data-handle="1"
      onMouseDown={onDown}
      className={`absolute inset-y-0 w-1.5 cursor-ew-resize bg-foreground/40 opacity-0 transition group-hover:opacity-100 ${side === "left" ? "left-0" : "right-0"}`}
    />
  );
}
