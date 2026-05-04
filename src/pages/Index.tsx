import { useState } from "react";
import TopBar from "@/components/TopBar";
import RecordView from "@/components/RecordView";
import EditView from "@/components/EditView";

export default function Index() {
  const [mode, setMode] = useState<"rec" | "edit">("edit");
  const [chaptersOpen, setChaptersOpen] = useState(false);
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <TopBar mode={mode} onMode={setMode} showChapters={mode === "edit"} onChapters={() => setChaptersOpen(true)} />
      {mode === "rec" ? (
        <RecordView onMode={setMode} />
      ) : (
        <EditView onMode={setMode} chaptersOpen={chaptersOpen} setChaptersOpen={setChaptersOpen} />
      )}
    </div>
  );
}
