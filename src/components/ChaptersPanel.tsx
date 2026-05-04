import { Pencil, X } from "lucide-react";

type Chapter = { title: string; start: string; end: string; active?: boolean };

const chapters: Chapter[] = [
  { title: "Capítulo 1", start: "00:00:00", end: "00:00:05", active: true },
  { title: "h1 QA(Garantia de Qualid…", start: "00:00:05", end: "00:00:06" },
  { title: "Teste de Unidade.PNG", start: "00:00:06", end: "00:00:06" },
  { title: "Teste de Integração.PNG", start: "00:00:06", end: "00:00:07" },
  { title: "Teste de Aceitação.PNG", start: "00:00:07", end: "00:00:09" },
  { title: "Teste de Aceitação.PNG", start: "00:00:09", end: "00:00:11" },
  { title: "Teste de Aceitação.PNG", start: "00:00:11", end: "00:00:12" },
  { title: "h1 QA(Garantia de Qualid…", start: "00:00:12", end: "00:00:13" },
  { title: "Teste de Unidade.PNG", start: "00:00:13", end: "00:00:14" },
];

export default function ChaptersPanel({ onClose }: { onClose: () => void }) {
  return (
    <aside className="absolute inset-y-0 left-0 z-30 flex w-[340px] flex-col border-r border-border bg-[hsl(0_0%_5%)] p-5 shadow-2xl">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Lista de capítulos</h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto scrollbar-thin pr-1">
        {chapters.map((c, i) => (
          <div key={i} className={`group flex items-start gap-2 rounded-md p-2 ${c.active ? "border-l-2 border-[hsl(var(--chapter-active))] bg-white/5" : "hover:bg-white/[0.03]"}`}>
            {c.active && <input type="checkbox" className="mt-1 h-3.5 w-3.5 accent-[hsl(var(--chapter-active))]" />}
            <div className={`flex-1 ${c.active ? "" : "pl-1"}`}>
              <div className="text-[13px] font-medium text-foreground">{c.title}</div>
              <div className="mt-0.5 text-[11px] text-[hsl(var(--chapter-active))]">{c.start} - {c.end}</div>
            </div>
            {c.active && (
              <div className="flex items-center gap-1 opacity-80">
                <button className="text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                <button className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-2">
        <button className="w-full rounded-md border border-border bg-card py-2.5 text-sm font-medium hover:bg-muted">+ Adicionar capítulo</button>
        <button className="w-full rounded-md border border-border bg-card py-2.5 text-sm font-medium hover:bg-muted">Mesclar capítulos</button>
        <button className="w-full rounded-md py-2.5 text-sm font-medium text-[hsl(var(--rec))] hover:bg-white/5">Remover selecionados</button>
      </div>
    </aside>
  );
}
