"use client";

import { useState, useRef } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

interface VideoSendButtonProps {
  userId: string;
  onVideoReady: (storagePath: string, previewUrl: string) => void;
  disabled?: boolean;
}

/** Compact video attach button for the message composer */
export function VideoSendButton({ userId, onVideoReady, disabled }: VideoSendButtonProps) {
  const supabase = createClientComponentClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith("video/")) {
      setError("Só são aceites ficheiros de vídeo.");
      return;
    }
    if (file.size > 200 * 1024 * 1024) {
      setError("O vídeo não pode exceder 200 MB.");
      return;
    }

    setError(null);
    setUploading(true);
    setProgress(10);

    const ext = file.name.split(".").pop() ?? "mp4";
    const storagePath = `${userId}/videos/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("private-media")
      .upload(storagePath, file, { upsert: false });

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    setProgress(90);

    const { data: signed } = await supabase.storage
      .from("private-media")
      .createSignedUrl(storagePath, 3600);

    setProgress(100);
    setUploading(false);

    if (signed?.signedUrl) {
      onVideoReady(storagePath, signed.signedUrl);
    }
  }

  return (
    <div className="relative">
      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
        disabled={disabled || uploading}
      />

      <button
        type="button"
        title="Enviar vídeo"
        disabled={disabled || uploading}
        onClick={() => fileRef.current?.click()}
        className="p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition disabled:opacity-40"
      >
        {uploading ? (
          <span className="flex items-center gap-1 text-xs text-blue-600">
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="60" strokeDashoffset="40" />
            </svg>
            {progress}%
          </span>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9A2.25 2.25 0 004.5 18.75z" />
          </svg>
        )}
      </button>

      {error && (
        <div className="absolute bottom-full mb-1 left-0 bg-red-50 dark:bg-red-900/30 text-red-600 text-xs px-2 py-1 rounded whitespace-nowrap">
          {error}
        </div>
      )}
    </div>
  );
}
