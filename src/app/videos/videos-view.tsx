"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  assinarVideos,
  enviarFeedback,
  registarVideo,
  type EstadoVideo,
} from "@/app/actions/videos";
import {
  extensaoDe,
  idFicheiro,
  uploadComProgresso,
  MAX_VIDEO_BYTES,
} from "@/lib/chat/media";

export type VideoRow = {
  id: string;
  user_id: string;
  storage_path: string;
  exercise: string | null;
  created_at: string;
};
export type FeedbackRow = {
  id: string;
  video_id: string;
  pt_id: string;
  body: string;
  created_at: string;
};

const data = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" });

const EXERCICIOS = [
  "Agachamento",
  "Levantamento terra",
  "Supino",
  "Press militar",
  "Remada",
  "Peso morto romeno",
  "Afundo",
  "Elevação (pull-up)",
];

export function VideosView({
  perspetiva,
  scopeVideos,
  alunoNome,
  videos,
  feedback,
  supabaseUrl,
  anonKey,
}: {
  perspetiva: "aluno" | "pt";
  scopeVideos: boolean;
  alunoNome: string;
  videos: VideoRow[];
  feedback: FeedbackRow[];
  meId: string;
  supabaseUrl: string;
  anonKey: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [urls, setUrls] = useState<Record<string, string | null>>({});

  useEffect(() => {
    (async () => {
      const paths = videos.map((v) => v.storage_path);
      if (paths.length) setUrls(await assinarVideos(paths));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videos.map((v) => v.id).join(",")]);

  const porVideo = useMemo(() => {
    const m: Record<string, FeedbackRow[]> = {};
    for (const f of feedback) (m[f.video_id] ??= []).push(f);
    return m;
  }, [feedback]);

  const semFeedback = videos.filter((v) => (porVideo[v.id]?.length ?? 0) === 0).length;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-zinc-600">
            {perspetiva === "pt" ? `Vídeos de ${alunoNome}` : "Os teus vídeos"}
          </p>
          <h1 className="text-2xl font-semibold text-zinc-100">
            {videos.length} {videos.length === 1 ? "vídeo" : "vídeos"}
          </h1>
        </div>
        {perspetiva === "pt" ? (
          <span
            className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${
              semFeedback > 0
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                : "border-zinc-700 text-zinc-500"
            }`}
          >
            {semFeedback} por ver
          </span>
        ) : null}
      </header>

      {perspetiva === "aluno" ? (
        <PainelUpload
          supabase={supabase}
          supabaseUrl={supabaseUrl}
          anonKey={anonKey}
          aoEnviado={() => router.refresh()}
        />
      ) : null}

      {perspetiva === "pt" && !scopeVideos ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          🔒 O atleta não te deu permissão de <span className="font-medium">vídeos</span> —
          os vídeos de treino dele não são mostrados.
        </p>
      ) : videos.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-600">
          {perspetiva === "aluno"
            ? "Ainda não enviaste nenhum vídeo."
            : "Este atleta ainda não enviou vídeos."}
        </p>
      ) : (
        <ol className="flex flex-col gap-4">
          {videos.map((v) => (
            <VideoCard
              key={v.id}
              video={v}
              url={urls[v.storage_path]}
              feedback={porVideo[v.id] ?? []}
              podeComentar={perspetiva === "pt"}
              aoComentado={() => router.refresh()}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function VideoCard({
  video,
  url,
  feedback,
  podeComentar,
  aoComentado,
}: {
  video: VideoRow;
  url: string | null | undefined;
  feedback: FeedbackRow[];
  podeComentar: boolean;
  aoComentado: () => void;
}) {
  return (
    <li className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
      <div className="flex items-baseline justify-between px-4 py-2.5">
        <span className="text-sm font-semibold text-zinc-100">
          {video.exercise ?? "Exercício"}
        </span>
        <span className="text-xs text-zinc-500">{data(video.created_at)}</span>
      </div>

      {url === undefined ? (
        <div className="h-56 w-full animate-pulse bg-zinc-800" />
      ) : url === null ? (
        <div className="flex h-56 w-full flex-col items-center justify-center gap-1 bg-zinc-950 text-xs text-zinc-500">
          <span className="text-xl">🔒</span>
          <span>Sem acesso a este ficheiro</span>
        </div>
      ) : (
        <video src={url} controls className="max-h-[70vh] w-full bg-black" />
      )}

      <div className="flex flex-col gap-2 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Feedback ({feedback.length})
        </p>
        {feedback.length === 0 ? (
          <p className="text-xs text-zinc-600">Ainda sem feedback do PT.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {feedback.map((f) => (
              <li
                key={f.id}
                className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2"
              >
                <p className="whitespace-pre-wrap break-words text-sm text-zinc-200">
                  {f.body}
                </p>
                <p className="mt-1 text-[11px] text-zinc-600">PT · {data(f.created_at)}</p>
              </li>
            ))}
          </ul>
        )}

        {podeComentar ? (
          <FormFeedback videoId={video.id} aoEnviado={aoComentado} />
        ) : null}
      </div>
    </li>
  );
}

function FormFeedback({
  videoId,
  aoEnviado,
}: {
  videoId: string;
  aoEnviado: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function submeter() {
    const body = texto.trim();
    if (!body || aEnviar) return;
    setAEnviar(true);
    setErro(null);
    const fd = new FormData();
    fd.set("video_id", videoId);
    fd.set("body", body);
    const r: EstadoVideo = await enviarFeedback({}, fd);
    setAEnviar(false);
    if (r.ok) {
      setTexto("");
      aoEnviado();
    } else {
      setErro(r.erro ?? "Falha ao enviar.");
    }
  }

  return (
    <div className="mt-1 flex flex-col gap-2">
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={2}
        maxLength={2000}
        placeholder="Ex.: joelho a colapsar na subida — pensa em empurrar o chão para fora"
        className="resize-none rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
      />
      {erro ? <p className="text-xs text-red-400">{erro}</p> : null}
      <button
        type="button"
        onClick={submeter}
        disabled={!texto.trim() || aEnviar}
        className="self-start rounded-lg bg-zinc-100 px-4 py-1.5 text-sm font-semibold text-zinc-900 transition hover:bg-white disabled:opacity-50"
      >
        {aEnviar ? "A enviar…" : "Enviar feedback"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------

type Cliente = ReturnType<typeof createClient>;

function PainelUpload({
  supabase,
  supabaseUrl,
  anonKey,
  aoEnviado,
}: {
  supabase: Cliente;
  supabaseUrl: string;
  anonKey: string;
  aoEnviado: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [exercicio, setExercicio] = useState("");
  const [pct, setPct] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    if (!file || pct != null) return;
    setErro(null);
    if (!file.type.startsWith("video/")) {
      setErro("Escolhe um ficheiro de vídeo.");
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setErro("Vídeo demasiado grande (máx. 50 MB).");
      return;
    }
    if (!exercicio.trim()) {
      setErro("Diz qual é o exercício.");
      return;
    }
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setErro("Sessão expirada.");
        return;
      }
      const uid = session.user.id;
      const path = `${uid}/videos/${idFicheiro()}.${extensaoDe(file.type)}`;
      setPct(0);
      await uploadComProgresso({
        supabaseUrl,
        anonKey,
        token: session.access_token,
        path,
        blob: file,
        contentType: file.type || "video/mp4",
        onProgress: setPct,
      });
      const fd = new FormData();
      fd.set("storage_path", path);
      fd.set("exercise", exercicio.trim());
      const r = await registarVideo({}, fd);
      setPct(null);
      if (r.ok) {
        setFile(null);
        setExercicio("");
        setAberto(false);
        aoEnviado();
      } else {
        setErro(r.erro ?? "Falha ao registar.");
      }
    } catch (e) {
      setPct(null);
      setErro(e instanceof Error ? e.message : "Falha no envio.");
    }
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-white"
      >
        Enviar vídeo
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-zinc-100">Novo vídeo</p>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          Cancelar
        </button>
      </div>

      <input
        type="file"
        accept="video/*"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="text-sm text-zinc-300 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-zinc-200"
      />
      <input
        list="lista-exercicios"
        value={exercicio}
        onChange={(e) => setExercicio(e.target.value)}
        maxLength={80}
        placeholder="Que exercício é? (ex.: Agachamento)"
        className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
      />
      <datalist id="lista-exercicios">
        {EXERCICIOS.map((e) => (
          <option key={e} value={e} />
        ))}
      </datalist>

      {pct != null ? (
        <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
          <div className="h-full bg-emerald-400 transition-all" style={{ width: `${pct}%` }} />
        </div>
      ) : null}
      {erro ? <p className="text-xs text-red-400">{erro}</p> : null}

      <button
        type="button"
        onClick={enviar}
        disabled={!file || !exercicio.trim() || pct != null}
        className="self-start rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-white disabled:opacity-50"
      >
        {pct != null ? `A enviar… ${pct}%` : "Enviar"}
      </button>
    </div>
  );
}
