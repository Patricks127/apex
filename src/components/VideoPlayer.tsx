"use client";

import { useState, useEffect, useRef } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

interface VideoPlayerProps {
  storagePath?: string;
  signedUrl?: string;
  className?: string;
  poster?: string;
  onError?: (err: string) => void;
}

export function VideoPlayer({
  storagePath,
  signedUrl: initialSignedUrl,
  className = "",
  poster,
  onError,
}: VideoPlayerProps) {
  const supabase = createClientComponentClient();
  const [url, setUrl] = useState<string | null>(initialSignedUrl ?? null);
  const [loading, setLoading] = useState(!initialSignedUrl && !!storagePath);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (initialSignedUrl || !storagePath) return;
    let cancelled = false;

    async function getSignedUrl() {
      setLoading(true);
      setError(null);
      const { data, error: signError } = await supabase.storage
        .from("private-media")
        .createSignedUrl(storagePath!, 3600);

      if (cancelled) return;

      if (signError || !data?.signedUrl) {
        const msg = signError?.message ?? "Erro ao carregar vídeo";
        setError(msg);
        onError?.(msg);
      } else {
        setUrl(data.signedUrl);
      }
      setLoading(false);
    }

    getSignedUrl();
    return () => { cancelled = true; };
  }, [storagePath, initialSignedUrl]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg aspect-video ${className}`}>
        <div className="flex flex-col items-center gap-2 text-gray-500">
          <div className="w-8 h-8 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">A carregar vídeo...</span>
        </div>
      </div>
    );
  }

  if (error || !url) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg aspect-video ${className}`}>
        <div className="flex flex-col items-center gap-2 text-gray-500 p-4 text-center">
          <span className="text-2xl">warning</span>
          <span className="text-sm">{error ?? "Vídeo indisponível"}</span>
        </div>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      src={url}
      controls
      poster={poster}
      preload="metadata"
      className={`w-full rounded-lg max-h-64 bg-black ${className}`}
      onError={() => {
        const msg = "Erro ao reproduzir vídeo";
        setError(msg);
        onError?.(msg);
      }}
    >
      O teu browser nao suporta reproducao de video.
    </video>
  );
}

export function VideoMessage({
  storagePath,
  signedUrl,
  senderName,
  timestamp,
}: {
  storagePath?: string;
  signedUrl?: string;
  senderName?: string;
  timestamp?: string;
}) {
  return (
    <div className="flex flex-col gap-1 max-w-xs">
      {senderName && (
        <span className="text-xs text-gray-500 font-medium">{senderName}</span>
      )}
      <VideoPlayer
        storagePath={storagePath}
        signedUrl={signedUrl}
        className="rounded-lg"
      />
      {timestamp && (
        <span className="text-xs text-gray-400 self-end">{timestamp}</span>
      )}
    </div>
  );
}
