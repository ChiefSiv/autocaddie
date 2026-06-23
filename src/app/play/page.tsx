import { Flag } from "lucide-react";
import { StubPage } from "@/components/ui/stub-page";

export const metadata = { title: "Play — Autocaddie" };

export default function PlayPage() {
  return (
    <StubPage
      eyebrow="Start or join"
      title="+ Play"
      icon={<Flag className="size-8" aria-hidden />}
    >
      Round setup and join-by-code arrive in Phase 2 — start a round, pick a
      course and tee, add players, and choose your games here.
    </StubPage>
  );
}
