"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BotaoVoltar } from "@/app/_ui/design/botao-voltar";
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

import { FUSO } from "@/lib/fuso";
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

const COR = {
  tinta: "var(--apex-tinta)",
  fraco: "var(--apex-cinza-texto)",
  linha: "var(--apex-cinza-linha)",
  fundo: "var(--apex-cinza-fundo)",
  erro: "var(--apex-erro)",
} as const;

// Fuso FIXO — sem timeZone explícito, a data de cada vídeo divergia entre
// o servidor (Vercel, UTC) e o telemóvel de quem usa a app (Portugal)
// perto da meia-noite — erro de hidratação (#418).
// FUSO: fonte única em src/lib/fuso.ts

const data = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric", timeZone: FUSO });

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
        <div className="flex items-start gap-3">
          {/* Só do lado do aluno — o PT já tem "← Voltar aos alunos" fixo
              (uma única origem sensata: a lista de alunos). Aqui, /videos
              é alcançável de vários sítios (nav do painel, "O meu PT",
              atividade recente), por isso router.back(), não um Link. */}
          {perspetiva === "aluno" ? <BotaoVoltar /> : null}
          <div>
            <p className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
              {perspetiva === "pt" ? `Vídeos de ${alunoNome}` : "Os teus vídeos"}
            </p>
            <h1 className="apex-tipo-titulo-ecra" style={{ marginTop: 0, color: COR.tinta }}>
              {videos.length} {videos.length === 1 ? "vídeo" : "vídeos"}
            </h1>
          </div>
        </div>
        {perspetiva === "pt" ? (
          <span className={semFeedback > 0 ? "apex-chip-alerta apex-tipo-etiqueta shrink-0" : "apex-tipo-etiqueta shrink-0"} style={semFeedback > 0 ? undefined : { color: COR.fraco }}>
            {semFeedback} por rever
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
        <p className="apex-tipo-secundario border-l-2 px-3 py-2" style={{ borderColor: COR.erro, color: COR.tinta }}>
          O atleta não te deu permissão de <strong>vídeos</strong> — os vídeos de treino dele
          não são mostrados.
        </p>
      ) : videos.length === 0 ? (
        <p className="apex-tipo-corpo py-10 text-center" style={{ color: COR.fraco }}>
          {perspetiva === "aluno"
            ? "Ainda não enviaste nenhum vídeo."
            : "Este atleta ainda não enviou vídeos."}
        </p>
      ) : (
        <div className="flex flex-col">
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
        </div>
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
    <div className="apex-video-item">
      <div className="flex items-baseline justify-between">
        <span className="apex-tipo-nome-exercicio" style={{ color: COR.tinta }}>
          {video.exercise ?? "Exercício"}
        </span>
        <span className="apex-tipo-etiqueta apex-tabular" style={{ color: COR.fraco }}>
          {data(video.created_at)}
        </span>
      </div>

      {url === undefined ? (
        <div className="h-56 w-full" style={{ background: COR.fundo }} />
      ) : url === null ? (
        <div
          className="apex-tipo-etiqueta flex h-56 w-full flex-col items-center justify-center gap-1"
          style={{ background: COR.fundo, color: COR.fraco }}
        >
          <span>Sem acesso a este ficheiro</span>
        </div>
      ) : (
        <video src={url} controls className="max-h-[70vh] w-full" style={{ background: "#000" }} />
      )}

      <div className="flex flex-col gap-2">
        <p className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
          Feedback do PT{feedback.length > 0 ? ` (${feedback.length})` : ""}
        </p>
        {feedback.length === 0 ? (
          <p className="apex-tipo-secundario" style={{ color: COR.fraco }}>
            Ainda sem feedback do PT.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {feedback.map((f) => (
              <div key={f.id} className="apex-video-feedback-item">
                <p className="apex-tipo-corpo whitespace-pre-wrap break-words" style={{ color: COR.tinta }}>
                  {f.body}
                </p>
                <p className="apex-tipo-etiqueta apex-tabular mt-1" style={{ color: COR.fraco }}>
                  PT · {data(f.created_at)}
                </p>
              </div>
            ))}
          </div>
        )}

        {podeComentar ? <FormFeedback videoId={video.id} aoEnviado={aoComentado} /> : null}
      </div>
    </div>
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
        className="apex-tipo-corpo resize-none border px-3 py-2 outline-none"
        style={{ borderColor: COR.linha, borderRadius: 2, background: "transparent", color: COR.tinta }}
      />
      {erro ? (
        <p className="apex-tipo-secundario" style={{ color: COR.erro }}>
          {erro}
        </p>
      ) : null}
      <button
        type="button"
        onClick={submeter}
        disabled={!texto.trim() || aEnviar}
        className="apex-botao apex-botao--claro self-start"
        style={{ width: "auto", padding: "8px 16px" }}
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
      <button type="button" onClick={() => setAberto(true)} className="apex-botao apex-botao--claro">
        Enviar vídeo
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 border p-4" style={{ borderColor: COR.linha, background: COR.fundo }}>
      <div className="flex items-center justify-between">
        <p className="apex-tipo-nome-exercicio" style={{ color: COR.tinta }}>
          Novo vídeo
        </p>
        <button type="button" onClick={() => setAberto(false)} className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
          Cancelar
        </button>
      </div>

      <input
        type="file"
        accept="video/*"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="apex-tipo-secundario"
        style={{ color: COR.tinta }}
      />
      <input
        list="lista-exercicios"
        value={exercicio}
        onChange={(e) => setExercicio(e.target.value)}
        maxLength={80}
        placeholder="Que exercício é? (ex.: Agachamento)"
        className="apex-tipo-corpo border px-3 py-2 outline-none"
        style={{ borderColor: COR.linha, borderRadius: 2, background: "var(--apex-branco)", color: COR.tinta }}
      />
      <datalist id="lista-exercicios">
        {EXERCICIOS.map((e) => (
          <option key={e} value={e} />
        ))}
      </datalist>

      {pct != null ? (
        <div className="apex-progresso-claro">
          <div className="apex-progresso-claro__preenchido" style={{ width: `${pct}%` }} />
        </div>
      ) : null}
      {erro ? (
        <p className="apex-tipo-secundario" style={{ color: COR.erro }}>
          {erro}
        </p>
      ) : null}

      <button
        type="button"
        onClick={enviar}
        disabled={!file || !exercicio.trim() || pct != null}
        className="apex-botao apex-botao--claro self-start"
        style={{ width: "auto", padding: "10px 20px" }}
      >
        {pct != null ? `A enviar… ${pct}%` : "Enviar"}
      </button>
    </div>
  );
}
