import { Users } from "lucide-react";
import { StubPage } from "@/components/ui/stub-page";

export const metadata = { title: "Friends — Autocaddie" };

export default function FriendsPage() {
  return (
    <StubPage
      eyebrow="Crews"
      title="Friends"
      icon={<Users className="size-8" aria-hidden />}
    >
      Your friends and saved crews — for one-tap re-invites and team
      auto-balancing — will live here. (Coming in a later phase.)
    </StubPage>
  );
}
