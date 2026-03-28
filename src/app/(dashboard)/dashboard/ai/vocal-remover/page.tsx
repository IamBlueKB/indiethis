import { AIToolsNav } from "@/components/dashboard/AIToolsNav";
import VocalRemoverTool from "@/components/ai-tools/VocalRemoverTool";

export default function VocalRemoverPage() {
  return (
    <>
      <div className="px-6 pt-6 max-w-3xl mx-auto">
        <AIToolsNav />
      </div>
      <VocalRemoverTool mode="artist" />
    </>
  );
}
