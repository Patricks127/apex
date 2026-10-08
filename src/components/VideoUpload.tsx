"use client";

import { useState, useRef } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

interface VideoUploadProps {
  /** ID do utilizador dono do vídeo (path: {userId}/videos/{file}) */
  userId: string;
  onUploadComplete?: (storagePath: string, publicUrl: string) => void;
  onError?: (err: string) => void;
  /** Texto do botão; default: "Enviar vídeo" */
  label?: string;
  /** Mostrar pré-visualização inline após seleccionar */
  showPreview?: boolean;
  className?: string;
}

export function VideoUpload({
  userId,
  onUploadComplete,
  onError,
  label = "Enviar vídeo 🎥",
  showPreview = true,
  className = "",
}: VideoUploadProps) {
  const supabase = createClientComponentClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const BUCKET = "private-media";
  const MAX_SIZE_MB = 200;

  async function handleFile(file: File) {
    setError(null);

    if (!file.type.startsWith("video/")) {
      const msg = "Só são aceites ficheiros de vídeo (mp4, mov, webm).";
      setError(msg);
      onError?.(msg);
      return;
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      const msg = `O vídeo não pode ultrapassar ${MAX_SIZE_MB}MB.`;
      setError(msg);
      onError?.(msg);
      return;
    }

    if (showPreview) {
      setPreviewUrl(URL.createObjectURL(file));
    }

    setUploading(true);
    setProgress(10);

    try {
      const ext = file.name.split(".").pop() ?? "mp4";
      const filename = `${Date.now()}.${ext}`;
      const storagePath = `${userId}/videos/${filename}`;

      setProgress(30);

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      setProgress(80);

      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(storagePath, 3600); // URL válida 1h

      setProgress(100);
      onUploadComplete?.(storagePath, signed?.signedUrl ?? "");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar vídeo.";
      setError(msg);
      onError?.(msg);
    } finally {
      setUploading(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => !uploading && inputRef.current?.click()}
        className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-6 cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors bg-gray-50 dark:bg-gray-900/50 select-none"
      >
        <span className="text-3xl">🎥</span>
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {uploading ? "A enviar…" : label}
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          MP4, MOV, WEBM · máx. {MAX_SIZE_MB}MB
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleChange}
          disabled={uploading}
        />
      </div>

      {/* Barra de progresso */}
      {uploading && (
        <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Erro */}
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
          <span>⚠</span> {error}
        </p>
      )}

      {/* Pré-visualização */}
      {showPreview && previewUrl && !uploading && (
        <video
          src={previewUrl}
          controls
          className="w-full rounded-xl border border-gray-200 dark:border-gray-800 max-h-64 object-contain bg-black"
        />
      )}
    </div>
  );
}
