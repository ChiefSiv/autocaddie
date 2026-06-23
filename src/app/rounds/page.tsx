import { ListOrdered } from "lucide-react";
import { StubPage } from "@/components/ui/stub-page";

export const metadata = { title: "Rounds — Autocaddie" };

export default function RoundsPage() {
  return (
    <StubPage
      eyebrow="History"
      title="Rounds"
      icon={<ListOrdered className="size-8" aria-hidden />}
    >
      Your past rounds and results will live here. Play your first round to fill
      this in. (Coming in a later phase.)
    </StubPage>
  );
}
