"use client";

import { useState } from "react";

export function isPlayableVideoUrl(raw: unknown): boolean {
  const url = String(raw || "").trim();
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    if (host.includes("youtube.com") || host.includes("youtu.be") || host.includes("vimeo.com")) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function shouldShowCategoryVideo(category: {
  videoUrl?: string;
  videoEnabled?: boolean;
} | null): boolean {
  if (!category || category.videoEnabled === false) return false;
  return isPlayableVideoUrl(category.videoUrl);
}

export function CategoryVideo({
  category,
}: {
  category: { videoUrl?: string; videoEnabled?: boolean } | null;
}) {
  const [failed, setFailed] = useState(false);
  if (!shouldShowCategoryVideo(category) || failed || !category?.videoUrl) return null;

  return (
    <div className="mb-8 overflow-hidden rounded-[20px] border border-black/5 bg-black shadow-sm">
      <video
        className="aspect-video w-full object-cover"
        src={category.videoUrl}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
