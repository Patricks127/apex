"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LIFT_LABEL, type Lift } from "@/lib/motor";
import { redimensionarImagem } from "@/lib/chat/media";
import { criarPost, type EstadoSocial } from "@/app/actions/social";
import { PostCard } from "@/app/_ui/social/post-card";
import type {
  Filtro,
  PostFeed,
  FontePickerTreino,
  FontePickerRecorde,
  FontePickerVideo,
} from "@/lib/social/feed-dados";
import type { PostKind } from "@/lib/social/sanitizar-post";

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
const FUSO = "Europe/Lisbon";

const dataCurta = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-PT", { day: "numeric", month: "short", timeZone: FUSO });

export function FeedView({
  meId,
  filtroInicial,
  posts,
  fontes,
}: {
  meId: string;
  filtroInicial: Filtro;
  posts: PostFeed[];
  fontes: { treinos: FontePickerTreino[]; recordes: FontePickerRecorde[]; videos: FontePickerVideo[] };
}) {
  const router = useRouter();
  const aoMudar = () => router.refresh();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="apex-tipo-titulo-ecra" style={{ marginTop: 0, color: COR.tinta }}>
        Feed
      </h1>

      <Composer fontes={fontes} aoPublicado={aoMudar} />

      <div className="apex-abas apex-abas--scroll">
        {(Object.keys(FILTRO_LABEL) as Filtro[]).map((f) => (
          <Link key={f} href={`/feed?filtro=${f}`} className="apex-aba" data-ativa={f === filtroInicial}>
            {FILTRO_LABEL[f]}
          </Link>
        ))}
      </div>

      {posts.length === 0 ? (
        <p className="apex-tipo-corpo py-10 text-center" style={{ color: COR.fraco }}>
          {filtroInicial === "seguindo"
            ? "Ainda não segues ninguém — vai a Descobrir para encontrar atletas e PTs."
            : filtroInicial === "meus"
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

function Composer({
  fontes,
  aoPublicado,
}: {
  fontes: { treinos: FontePickerTreino[]; recordes: FontePickerRecorde[]; videos: FontePickerVideo[] };
  aoPublicado: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [kind, setKind] = useState<PostKind>("texto");
  const [erroImagem, setErroImagem] = useState<string | null>(null);

  // O trabalho assíncrono (redimensionar) tem de viver DENTRO da função
  // passada a useActionState, nunca num wrapper `async` à volta de
  // `submeter` — chamar o dispatcher fora de uma transição dá um aviso
  // do React e a submissão não chega a acontecer. `redimensionarImagem`
  // (lib/chat/media.ts, mesma função do chat) só pode correr no browser,
  // por isso o redimensionamento fica no cliente; o resultado (Blob) é
  // que viaja para criarPost, nunca o ficheiro original em tamanho real.
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

  const precisaDeFonte = kind === "treino" || kind === "recorde" || kind === "video";
  const listaFontes = kind === "treino" ? fontes.treinos : kind === "recorde" ? fontes.recordes : kind === "video" ? fontes.videos : [];
  const semFontes = precisaDeFonte && listaFontes.length === 0;

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className="apex-botao apex-botao--claro">
        Publicar
      </button>
    );
  }

  return (
    <form
      action={(fd) => {
        // submeter(fd) TEM de ser chamado sincronamente aqui dentro — não
        // em onSubmit separado (desmonta o form antes do React despachar
        // a ação) nem atrás de um await (dá aviso do React e a submissão
        // nem chega a acontecer). O trabalho assíncrono (redimensionar)
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
            {kind === "treino" ? "Ainda sem treinos registados." : kind === "recorde" ? "Ainda sem recordes registados." : "Ainda sem vídeos enviados."}
          </p>
        ) : (
          <select name="source_id" required defaultValue="">
            <option value="" disabled>
              Escolhe {kind === "treino" ? "um treino" : kind === "recorde" ? "um recorde" : "um vídeo"}…
            </option>
            {kind === "treino"
              ? (fontes.treinos as FontePickerTreino[]).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} · {dataCurta(t.performedAt)} · {t.nSets} séries
                  </option>
                ))
              : kind === "recorde"
                ? (fontes.recordes as FontePickerRecorde[]).map((r) => (
                    <option key={r.id} value={r.id}>
                      {LIFT_LABEL[r.lift as Lift] ?? r.lift} — {r.valueKg} kg · {dataCurta(r.recordedAt)}
                    </option>
                  ))
                : (fontes.videos as FontePickerVideo[]).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.exercise ?? "Vídeo"} · {dataCurta(v.createdAt)}
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
