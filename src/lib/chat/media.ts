/** Utilitários de media do chat — só corre no browser. */

export const MAX_DIM = 1200;
export const JPEG_QUALITY = 0.82;
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200 MB

/**
 * Redimensiona uma imagem para no máximo `maxDim` px no lado maior e
 * devolve um Blob JPEG. Se já for menor, na mesma re-codifica para JPEG.
 */
export async function redimensionarImagem(
  file: File,
  maxDim = MAX_DIM,
  quality = JPEG_QUALITY,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error("Não foi possível ler a imagem.");

  const escala = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * escala);
  const h = Math.round(bitmap.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Falha a codificar a imagem."))),
      "image/jpeg",
      quality,
    );
  });
}

/** Extensão para o caminho de storage a partir do MIME. */
export function extensaoDe(mime: string): string {
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "video/mp4") return "mp4";
  if (mime === "video/quicktime") return "mov";
  if (mime === "video/webm") return "webm";
  return "bin";
}

/** id curto e ordenável para nome de ficheiro. */
export function idFicheiro(): string {
  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 8)
  );
}

/**
 * Upload direto para o bucket private-media com progresso real (XHR).
 * A RLS do storage garante que só se escreve na pasta do próprio.
 */
export function uploadComProgresso(opts: {
  supabaseUrl: string;
  anonKey: string;
  token: string;
  path: string;
  blob: Blob;
  contentType: string;
  bucket?: string; // por omissão "private-media"
  upsert?: boolean; // por omissão false
  onProgress?: (pct: number) => void;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const bucket = opts.bucket ?? "private-media";
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${opts.supabaseUrl}/storage/v1/object/${bucket}/${opts.path}`);
    xhr.setRequestHeader("authorization", `Bearer ${opts.token}`);
    xhr.setRequestHeader("apikey", opts.anonKey);
    xhr.setRequestHeader("content-type", opts.contentType);
    xhr.setRequestHeader("x-upsert", opts.upsert ? "true" : "false");
    xhr.setRequestHeader("cache-control", "no-store, max-age=0");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && opts.onProgress) {
        opts.onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload falhou (${xhr.status}).`));
    xhr.onerror = () => reject(new Error("Falha de rede no upload."));
    xhr.send(opts.blob);
  });
}
