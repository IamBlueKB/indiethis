import { AIToolsNav } from "@/components/dashboard/AIToolsNav";
import TrackShieldTool from "@/components/ai-tools/TrackShieldTool";

export default function TrackShieldPage() {
  return (
    <>
      <div className="px-6 pt-6 max-w-5xl mx-auto">
        <AIToolsNav />
      </div>
      <TrackShieldTool />
    </>
  );
}
