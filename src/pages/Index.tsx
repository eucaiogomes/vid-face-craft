import { StudioProvider, useStudio } from "@/state/studio";
import Home from "@/components/Home";
import RecordStudio from "@/components/RecordStudio";
import EditStudio from "@/components/EditStudio";

function Inner() {
  const { view } = useStudio();
  if (view === "record") return <RecordStudio />;
  if (view === "edit") return <EditStudio />;
  return <Home />;
}

export default function Index() {
  return (
    <StudioProvider>
      <Inner />
    </StudioProvider>
  );
}
