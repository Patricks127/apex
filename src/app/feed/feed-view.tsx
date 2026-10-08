"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LIFT_LABEL, type Lift } from "@/lib/motor";
import { redimensionarImagem, uploadComProgresso, extensaoDe, idFicheiro } from "@/lib/chat/media";
import { createClient } from "@/lib/supabase/client";
import { criarPost, type EstadoSocial } from "@/app/actions/social";
import { PostCard } from "@/app/_ui/social/post-card";
import type {
  Filtro,
  PostFeed,
  FontePickerTreino,
  FontePickerRecorde,
} from "@/lib/social/feed-dados";
import type { PostKind } from "@/lib/social/sanitizar-post";

import { FUSO } from "@/lib/fuso";
import { formatarKg } from "@/lib/formato";
const COR = {
  tinta: "var(--apex-tinta)",
  fraco: "var(--apex-cinza-texto)",
  linha: "var(--apex-cinza-linha)",
  erro: "var(--apex-erro)",
} as const;

const FILTRO_LABEL: Record<Filtro, string> = {
  tudo: "Tudo",
  seguindo: "A seguir",
  pts: "De PTs",
  meus: "Meus",
};

const KIND_LABEL: Record<PostKind, string> = {
  treino: "Treino",
  recorde: "Recorde",
  conquista: "Conquista",
  video: "Vídeo",
  imagem: "Foto",
  texto: "Texto",
};

// Fuso FIXO — mesmo raciocínio de chat-view.tsx: sem timeZone explícito,
// toLocaleDateString usa o fuso de onde o código corre, e o servidor
// (Vercel, UTC) discorda do telemóvel de quem usa a app (Portugal) sobre
// que dia é uma data perto da meia-noite — o React acusa isso como erro de
// hidratação (#418) ao comparar o HTML do servidor com o do cliente.
// FUSO: fonte única em src/lib/fuso.ts

const dataCurta = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-PT", { day: "numeric", month: "short", timeZone: FUSO });

export function FeedView({
  meId,
  filtroInicial,
  posts,
  fontes,
  supabaseUrl,
  anonKey,
}: {
  meId: string;
  filtroInicial: Filtro;
  posts: PostFeed[];
  fontes: { treinos: FontePickerTreino[]; recordes: FontePickerRecorde[] };
  supabaseUrl: string;
  anonKey: string;
}) {
  const router = useRouter();
  const aoMudar = () => router.refresh();

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="apex-tipo-titulo-ecra" style={{ marginTop: 0, color: COR.tinta }}>
          Feed
        </h1>
        {/* Descobrir (procurar atletas/PTs para seguir) vive dentro do Feed,
            não como separador próprio da barra inferior — a fila de links do
            painel que lá levava saiu na Fase 2 e deixou-o órfão. Mesmo ecrã
            para atleta e PT. */}
        <Link href="/descobrir" className="apex-botao-icone" aria-label="Descobrir pessoas">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </Link>
      </header>

      <Composer fontes={fontes} aoPublicado={aoMudar} supabaseUrl={supabaseUrl} anonKey={anonKey} />

      <div className="apex-abas apex-abas--scroll">
        {(Object.keys(FILTRO_LABEL) as Filtro[]).map((f) => (
          <Link key={f} href={`/feed?filtro=${f}`} className="apex-aba" data-ativa={f === filtroInicial}>
            {FILTRO_LABEL[f]}
          </Link>
        ))}
      </div>

      {posts.length === 0 ? (
        <p className="apex-tipo-corpo py-10 text-center" style={{ color: COR.fraco }}>
          {filtroInicial === "seguindo" ? (
            <>
              Ainda não segues ninguém —{" "}
              <Link href="/descobrir" className="underline underline-offset-4" style={{ color: COR.tinta }}>
                descobre atletas e PTs
              </Link>
              .
            </>
          ) : filtroInicial === "meus"
              ? "Ainda não publicaste nada."
              : "Ainda não há publicações."}
        </p>
      ) : (
        <div>
          {posts.map((p) => (
            <PostCard key={p.id} post={p} meId={meId} aoMudar={aoMudar} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

const KINDS: PostKind[] = ["treino", "recorde", "conquista", "video", "imagem", "texto"];

// Limite de vídeo para o feed — post-media tem 50 MB de limite de ficheiro
const MAX_FEED_VIDEO_BYTES = 50 * 1024 * 1024;

function Composer({
  fontes,
  aoPublicado,
  supabaseUrl,
  anonKey,
}: {
  fontes: { treinos: FontePickerTreino[]; recordes: FontePickerRecorde[] };
  aoPublicado: () => void;
  supabaseUrl: string;
  anonKey: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [kind, setKind] = useState<PostKind>("texto");
  const [erroImagem, setErroImagem] = useState<string | null>(null);

  // Estado específico do fluxo de vídeo (upload direto com progresso)
  const [videoFicheiro, setVideoFicheiro] = useState<File | null>(null);
  const [videoProgresso, setVideoProgresso] = useState<number | null>(null);
  const [erroVideo, setErroVideo] = useState<string | null>(null);
  const [videoAEnviar, setVideoAEnviar] = useState(false);

  // O trabalho assíncrono (redimensionar) tem de viver DENTRO da função
  // passada a useActionState, nunca num wrapper `async` à volta de
  // `submeter` — chamar o dispatcher fora de uma transição dá um aviso
  // do React e a submissão não chega a acontecer. `redimensionarImagem`
  // (lib/chat/media.ts, mesma função do chat) só pode correr no browser,
  // por isso o redimensionamento fica no cliente; o resultado (Blob)
  // é que viaja para criarPost, nunca o ficheiro original em tamanho real.
  async function acaoComposta(anterior: EstadoSocial, fd: FormData): Promise<EstadoSocial> {
    setErroImagem(null);
    const ficheiro = fd.get("imagem");
    if (fd.get("kind") === "imagem" && ficheiro instanceof File && ficheiro.size > 0) {
      try {
        const blob = await redimensionarImagem(ficheiro);
        fd.delete("imagem");
        fd.set("imagem", blob, "imagem.jpg");
      } catch {
        setErroImagem("Não foi possível processar esta imagem.");
        return anterior;
      }
    }
    return criarPost(anterior, fd);
  }

  const [estado, submeter, aEnviar] = useActionState<EstadoSocial, FormData>(acaoComposta, {});

  // Upload de vídeo: fluxo separado do useActionState porque precisa de
  // XHR com progresso e não pode ir via FormData do Server Action (limite
  // de tamanho). O vídeo vai diretamente para post-media (bucket público
  // com RLS que verifica auth.uid() == primeiro segmento do path). Só
  // depois de o upload concluir é que chamamos criarPost com o path.
  async function submeterVideo(bodyTexto: string) {
    if (!videoFicheiro || videoAEnviar) return;
    setErroVideo(null);

    if (!videoFicheiro.type.startsWith("video/")) {
      setErroVideo("Só ficheiros de vídeo são aceites.");
      return;
    }
    if (videoFicheiro.size > MAX_FEED_VIDEO_BYTES) {
      setErroVideo("Vídeo demasiado grande (máx. 50 MB).");
      return;
    }

    setVideoAEnviar(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setErroVideo("Sessão expirada.");
        setVideoAEnviar(false);
        return;
      }

      const ext = extensaoDe(videoFicheiro.type);
      const path = `${session.user.id}/${idFicheiro()}.${ext}`;

      setVideoProgresso(0);
      await uploadComProgresso({
        supabaseUrl,
        anonKey,
        token: session.access_token,
        path,
        blob: videoFicheiro,
        contentType: videoFicheiro.type,
        bucket: "post-media",
        onProgress: setVideoProgresso,
      });
      setVideoProgresso(null);

      // O ficheiro já está em post-media — só precisamos de registar o post
      const fd = new FormData();
      fd.set("kind", "video");
      fd.set("video_path", path);
      fd.set("body", bodyTexto);
      const resultado = await criarPost({}, fd);

      if (resultado.erro) {
        setErroVideo(resultado.erro);
        setVideoAEnviar(false);
        return;
      }

      // Sucesso
      setVideoFicheiro(null);
      setVideoAEnviar(false);
      setAberto(false);
      aoPublicado();
    } catch (e) {
      setVideoProgresso(null);
      setVideoAEnviar(false);
      setErroVideo(e instanceof Error ? e.message : "Falha no envio.");
    }
  }

  const precisaDeFonte = kind === "treino" || kind === "recorde";
  const listaFontes =
    kind === "treino" ? fontes.treinos : kind === "recorde" ? fontes.recordes : [];
  const semFontes = precisaDeFonte && listaFontes.length === 0;

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className="apex-botao apex-botao--claro">
        Publicar
      </button>
    );
  }

  // Formulário de vídeo: fluxo separado (upload com progresso)
  if (kind === "video") {
    return (
      <div className="apex-form-registo">
        <div className="flex items-center justify-between">
          <p className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
            Nova publicação
          </p>
          <button
            type="button"
            onClick={() => { setAberto(false); setVideoFicheiro(null); setErroVideo(null); setVideoProgresso(null); }}
            className="apex-tipo-etiqueta"
            style={{ color: COR.fraco }}
            disabled={videoAEnviar}
          >
            Cancelar
          </button>
        </div>

        <div className="apex-abas apex-abas--scroll">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              className="apex-aba"
              data-ativa={k === kind}
              onClick={() => { setKind(k); setVideoFicheiro(null); setErroVideo(null); }}
              disabled={videoAEnviar}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>

        {/* Seleção de ficheiro e pré-visualização */}
        <div className="flex flex-col gap-2">
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/*"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setVideoFicheiro(f);
              setErroVideo(null);
            }}
            className="apex-tipo-secundario"
            style={{ color: COR.tinta }}
            disabled={videoAEnviar}
          />
          <p className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
            Máx. 50 MB · MP4 ou MOV
          </p>
          {videoFicheiro ? (
            <video
              src={URL.createObjectURL(videoFicheiro)}
              controls
              className="max-h-48 w-full bg-black"
              style={{ borderRadius: 4 }}
            />
          ) : null}
        </div>

        {/* Barra de progresso durante o upload */}
        {videoProgresso !== null ? (
          <div className="flex flex-col gap-1">
            <div
              className="h-1 w-full overflow-hidden"
              style={{ background: COR.linha, borderRadius: 2 }}
            >
              <div
                className="h-full transition-all"
                style={{ width: `${videoProgresso}%`, background: COR.tinta }}
              />
            </div>
            <p className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
              A enviar… {videoProgresso}%
            </p>
          </div>
        ) : null}

        {/* Texto opcional */}
        <CorpoTextarea kind="video" disabled={videoAEnviar} id="video-body" />

        {erroVideo ? (
          <p className="apex-tipo-secundario" style={{ color: COR.erro }}>
            {erroVideo}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => {
            const el = document.getElementById("video-body") as HTMLTextAreaElement | null;
            submeterVideo(el?.value ?? "");
          }}
          disabled={videoAEnviar || !videoFicheiro}
          className="apex-botao apex-botao--claro self-start"
          style={{ width: "auto", padding: "10px 20px" }}
        >
          {videoAEnviar ? (videoProgresso !== null ? `A enviar… ${videoProgresso}%` : "A publicar…") : "Publicar"}
        </button>
      </div>
    );
  }

  return (
    <form
      action={(fd) => {
        // submeter(fd) TEM de ser chamado sincronamente aqui dentro — não
        // em onSubmit separado (desmonta o form antes do React despachar
        // a ação) nem atrás de um await (dá aviso do React e a submissão
        // não chega a acontecer). O trabalho assíncrono (redimensionar)
        // já vive dentro de acaoComposta, que é isso que submeter dispara.
        submeter(fd);
        setAberto(false);
        aoPublicado();
      }}
      className="apex-form-registo"
    >
      <div className="flex items-center justify-between">
        <p className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
          Nova publicação
        </p>
        <button type="button" onClick={() => setAberto(false)} className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
          Cancelar
        </button>
      </div>

      <div className="apex-abas apex-abas--scroll">
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            className="apex-aba"
            data-ativa={k === kind}
            onClick={() => setKind(k)}
          >
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <input type="hidden" name="kind" value={kind} />

      {precisaDeFonte ? (
        semFontes ? (
          <p className="apex-tipo-secundario" style={{ color: COR.fraco }}>
            {kind === "treino" ? "Ainda sem treinos registados." : "Ainda sem recordes registados."}
          </p>
        ) : (
          <select name="source_id" required defaultValue="">
            <option value="" disabled>
              Escolhe {kind === "treino" ? "um treino" : "um recorde"}…
            </option>
            {kind === "treino"
              ? (fontes.treinos as FontePickerTreino[]).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} · {dataCurta(t.performedAt)} · {t.nSets} séries
                  </option>
                ))
              : (fontes.recordes as FontePickerRecorde[]).map((r) => (
                  <option key={r.id} value={r.id}>
                    {LIFT_LABEL[r.lift as Lift] ?? r.lift} — {formatarKg(r.valueKg)} · {dataCurta(r.recordedAt)}
                  </option>
                ))}
          </select>
        )
      ) : null}

      {kind === "imagem" ? (
        <input
          type="file"
          name="imagem"
          accept="image/*"
          required
          className="apex-tipo-secundario"
          style={{ color: COR.tinta }}
        />
      ) : null}

      <textarea
        name="body"
        rows={precisaDeFonte ? 2 : 3}
        maxLength={2000}
        placeholder={
          kind === "conquista"
            ? "Ex.: completei o meu primeiro mês sem faltar a um treino!"
            : kind === "texto"
              ? "O que se passa?"
              : "Diz alguma coisa sobre isto (opcional)"
        }
        required={kind === "conquista" || kind === "texto"}
        className="apex-tipo-corpo resize-none border px-3 py-2 outline-none"
        style={{ borderColor: COR.linha, borderRadius: 2, background: "var(--apex-branco)", color: COR.tinta }}
      />

      {erroImagem ? (
        <p className="apex-tipo-secundario" style={{ color: COR.erro }}>
          {erroImagem}
        </p>
      ) : null}
      {estado.erro ? (
        <p className="apex-tipo-secundario" style={{ color: COR.erro }}>
          {estado.erro}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={aEnviar || semFontes}
        className="apex-botao apex-botao--claro self-start"
        style={{ width: "auto", padding: "10px 20px" }}
      >
        {aEnviar ? "A publicar…" : "Publicar"}
      </button>
    </form>
  );
}

// Textarea reutilizável para o fluxo de vídeo (fora de <form>)
function CorpoTextarea({ kind, disabled, id }: { kind: PostKind; disabled: boolean; id: string }) {
  return (
    <textarea
      id={id}
      rows={2}
      maxLength={2000}
      placeholder="Diz alguma coisa sobre este vídeo (opcional)"
      className="apex-tipo-corpo resize-none border px-3 py-2 outline-none"
      style={{
        borderColor: "var(--apex-cinza-linha)",
        borderRadius: 2,
        background: "var(--apex-branco)",
        color: "var(--apex-tinta)",
      }}
      disabled={disabled}
    />
  );
}
