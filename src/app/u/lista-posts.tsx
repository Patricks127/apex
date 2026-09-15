"use client";

import { useRouter } from "next/navigation";
import { PostCard } from "@/app/_ui/social/post-card";
import type { PostFeed } from "@/lib/social/feed-dados";

export function ListaPosts({
  posts,
  meId,
  vazioTexto,
}: {
  posts: PostFeed[];
  meId: string;
  vazioTexto: string;
}) {
  const router = useRouter();

  if (posts.length === 0) {
    return (
      <p className="apex-tipo-corpo py-6" style={{ color: "var(--apex-cinza-texto)" }}>
        {vazioTexto}
      </p>
    );
  }

  return (
    <div>
      {posts.map((p) => (
        <PostCard key={p.id} post={p} meId={meId} aoMudar={() => router.refresh()} />
      ))}
    </div>
  );
}
