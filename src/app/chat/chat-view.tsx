"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { BotaoVoltar } from "@/app/_ui/design/botao-voltar";
import {
  analisarFotoEvolucao,
  assinarMedia,
  compararFotosEvolucao,
  enviarMensagem,
  marcarLidas,
  registarMedia,
} from "@/app/actions/chat";
import {
  redimensionarImagem,
  uploadComProgresso,
  extensaoDe,
  idFicheiro,
  mimeNormalizado,
  MAX_VIDEO_BYTES,
} from "@/lib/chat/media";

import { FUSO, chaveDiaLisboa } from "@/lib/fuso";
import { formatarKg } from "@/lib/formato";
export type Mensagem = {
  id: string;
  sender_id: string;
  body: string | null;
  media_path: string | null;
  media_kind: "image" | "video" | null;
  is_evolution: boolean;
  weight_kg: number | null;
  measurement: string | null;
  ai_analysis: string | null;
  read_at: string | null;
  created_at: string;
};

const COR = {
  tinta: "var(--apex-tinta)",
  fraco: "var(--apex-cinza-texto)",
  linha: "var(--apex-cinza-linha)",
  branco: "var(--apex-branco)",
  fundo: "var(--apex-cinza-fundo)",
  erro: "var(--apex-erro)",
} as const;

const MS_DIA = 86_400_000;

// Fuso FIXO (não o do sistema onde o código corre) — nunca "new Date()" a
// decidir "que dia é hoje" sozinho, nem toLocale*String sem timeZone. Sem
// isto, o servidor (Vercel, UTC) e o telemóvel de quem usa a app (Portugal)
// podiam calcular "Hoje"/"Ontem"/a hora de forma diferente — o HTML que o
// servidor manda já não bate certo com o que o cliente calcula ao hidratar,
// e o React acusa isso como erro (#418), mesmo sendo só uma hora de
// diferença perto da meia-noite. Um fuso explícito, IGUAL dos dois lados,
// elimina a divergência pela raiz — não é "o fuso de ninguém", é o fuso de
// quem usa a app hoje.
// FUSO: fonte única em src/lib/fuso.ts

/** "YYYY-MM-DD" no dia de Lisboa — o helper único de src/lib/fuso.ts. */
const chaveDia = (d: Date) => chaveDiaLisboa(d);

function rotuloDia(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date(hoje.getTime() - MS_DIA);
  const chaveD = chaveDia(d);
  if (chaveD === chaveDia(hoje)) return "Hoje";
  if (chaveD === chaveDia(ontem)) return "Ontem";
  return d.toLocaleDateString("pt-PT", { day: "numeric", month: "long", timeZone: FUSO });
}

const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", timeZone: FUSO });

export function ChatView({
  linkId,
  meId,
  perspetiva,
  scopeEvolucao,
  outroNome,
  inicial,
  supabaseUrl,
  anonKey,
}: {
  linkId: string;
  meId: string;
  perspetiva: "aluno" | "pt";
  scopeEvolucao: boolean;
  outroNome: string;
  inicial: Mensagem[];
  supabaseUrl: string;
  anonKey: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [msgs, setMsgs] = useState<Mensagem[]>(inicial);
  const [aba, setAba] = useState<"conversa" | "evolucao">("conversa");
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  const fundoRef = useRef<HTMLDivElement>(null);

  const assinarEmFalta = useCallback(
    async (lista: Mensagem[]) => {
      const paths = lista
        .filter((m) => m.media_path)
        .map((m) => m.media_path as string);
      const novos = paths.filter((p) => !(p in urls));
      if (novos.length === 0) return;
      const mapa = await assinarMedia(novos);
      setUrls((u) => ({ ...u, ...mapa }));
    },
    [urls],
  );

  const recarregar = useCallback(async () => {
    const { data } = await supabase
      .from("messages")
      .select(
        "id, sender_id, body, media_path, media_kind, is_evolution, weight_kg, measurement, ai_analysis, read_at, created_at",
      )
      .eq("link_id", linkId)
      .order("created_at", { ascending: true })
      .limit(500);
    if (data) {
      setMsgs(data as Mensagem[]);
      assinarEmFalta(data as Mensagem[]);
    }
  }, [supabase, linkId, assinarEmFalta]);

  // marcar lidas + assinar media inicial + realtime
  //
  // O canal só é criado DEPOIS de vários `await` — em React StrictMode
  // (dev: monta, desmonta, torna a montar) a função de limpeza do primeiro
  // efeito corre ANTES desses awaits resolverem, com `canal` ainda `null`;
  // a limpeza não tem nada para remover, e a função async continua a
  // correr sozinha e acaba por subscrever um canal que nunca é limpo. O
  // segundo efeito (o que fica de pé) subscreve OUTRO canal com o mesmo
  // tópico (`chat:${linkId}`) — dois `.subscribe()` no mesmo tópico é o
  // "cannot add postgres_changes callbacks ... after subscribe()".
  //
  // Correção: uma flag `cancelado`, verificada a seguir a cada `await`,
  // ANTES de se comprometer a criar/subscrever o canal — se o efeito já
  // foi desmontado entretanto, a função async desiste sem nunca chegar a
  // `channel().on().subscribe()`, por isso nunca há um canal órfão.
  useEffect(() => {
    let cancelado = false;
    let canal: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      await marcarLidas(linkId);
      await assinarEmFalta(inicial);
      if (cancelado) return;

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelado) return;
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);

      // .on() sempre ANTES de .subscribe() — o filtro faz parte da
      // subscrição, não algo que se acrescente depois.
      canal = supabase
        .channel(`chat:${linkId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "messages", filter: `link_id=eq.${linkId}` },
          () => recarregar(),
        )
        .subscribe();
    })();

    return () => {
      cancelado = true;
      if (canal) {
        supabase.removeChannel(canal);
        canal = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkId]);

  // scroll para o fim quando chegam mensagens (na aba conversa)
  useEffect(() => {
    if (aba === "conversa") fundoRef.current?.scrollIntoView({ block: "end" });
  }, [msgs, aba]);

  const evolucao = msgs.filter((m) => m.is_evolution);

  return (
    <div className="apex-chat">
      <div className="apex-chat-cabecalho">
        <div className="flex items-center gap-3">
          <BotaoVoltar />
          <div>
            <p className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
              {perspetiva === "aluno" ? "O teu PT" : "Atleta"}
            </p>
            <h1 className="apex-tipo-nome-exercicio" style={{ color: COR.tinta }}>
              {outroNome}
            </h1>
          </div>
        </div>
        <div className="apex-chat-abas">
          {(["conversa", "evolucao"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setAba(t)}
              data-ativa={aba === t}
              className="apex-chat-aba apex-tipo-etiqueta"
            >
              {t === "conversa" ? "Conversa" : "Evolução"}
            </button>
          ))}
        </div>
      </div>

      {aba === "conversa" ? (
        <>
          <div className="apex-chat-corpo">
            {msgs.length === 0 ? (
              <p className="apex-tipo-corpo py-10 text-center" style={{ color: COR.fraco }}>
                Ainda não há mensagens. Diz olá.
              </p>
            ) : (
              <ListaConversa msgs={msgs} meId={meId} urls={urls} />
            )}
            <div ref={fundoRef} />
          </div>
          <Composer
            linkId={linkId}
            meId={meId}
            podeEnviarMedia={true}
            supabase={supabase}
            supabaseUrl={supabaseUrl}
            anonKey={anonKey}
            aoEnviar={recarregar}
          />
        </>
      ) : (
        <TimelineEvolucao
          itens={evolucao}
          urls={urls}
          podeVer={perspetiva === "aluno" || scopeEvolucao}
          ehPt={perspetiva === "pt"}
          aoAnalisar={(id, texto) =>
            setMsgs((lista) => lista.map((m) => (m.id === id ? { ...m, ai_analysis: texto } : m)))
          }
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conversa
// ---------------------------------------------------------------------------

function ListaConversa({
  msgs,
  meId,
  urls,
}: {
  msgs: Mensagem[];
  meId: string;
  urls: Record<string, string | null>;
}) {
  const blocos: { dia: string; itens: Mensagem[] }[] = [];
  for (const m of msgs) {
    const dia = rotuloDia(m.created_at);
    const ultimo = blocos[blocos.length - 1];
    if (ultimo && ultimo.dia === dia) ultimo.itens.push(m);
    else blocos.push({ dia, itens: [m] });
  }

  return (
    <>
      {blocos.map((b, i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="apex-separador-dia">
            <span className="apex-separador-dia__linha" />
            <span className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
              {b.dia}
            </span>
            <span className="apex-separador-dia__linha" />
          </div>
          <div className="apex-bolhas-dia">
            {b.itens.map((m) => (
              <Bolha key={m.id} m={m} meu={m.sender_id === meId} urls={urls} />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

function Bolha({
  m,
  meu,
  urls,
}: {
  m: Mensagem;
  meu: boolean;
  urls: Record<string, string | null>;
}) {
  return (
    <div className={`apex-bolha-linha ${meu ? "apex-bolha-linha--minha" : "apex-bolha-linha--outro"}`}>
      <div className={`apex-bolha apex-tipo-corpo ${meu ? "apex-bolha--minha" : "apex-bolha--outro"}`}>
        {m.is_evolution ? (
          <span className="apex-chip-neutro apex-tipo-etiqueta apex-tabular">
            Evolução
            {m.weight_kg != null ? ` · ${formatarKg(m.weight_kg)}` : ""}
            {m.measurement ? ` · ${m.measurement}` : ""}
          </span>
        ) : null}
        {m.media_path ? (
          <MediaMsg path={m.media_path} kind={m.media_kind} url={urls[m.media_path]} meu={meu} />
        ) : null}
        {m.body ? <p className="whitespace-pre-wrap break-words">{m.body}</p> : null}
        <div className="apex-bolha__rodape apex-tipo-etiqueta apex-tabular" style={{ opacity: 0.7 }}>
          <span>{hhmm(m.created_at)}</span>
          {meu ? <span>{m.read_at ? "✓✓" : "✓"}</span> : null}
        </div>
      </div>
    </div>
  );
}

function MediaMsg({
  path,
  kind,
  url,
  meu,
}: {
  path: string;
  kind: "image" | "video" | null;
  url: string | null | undefined;
  meu: boolean;
}) {
  const corBorda = meu ? "rgba(255,255,255,0.3)" : COR.linha;
  if (url === undefined) {
    return <div style={{ height: 160, width: 224, background: corBorda }} />;
  }
  if (url === null) {
    return (
      <div
        className="apex-tipo-etiqueta flex flex-col items-center justify-center gap-1 border"
        style={{ height: 160, width: 224, borderColor: corBorda }}
      >
        <span>Sem acesso a este ficheiro</span>
      </div>
    );
  }
  if (kind === "video") {
    return <video src={url} controls className="max-h-72 w-56 bg-black" title={path} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="max-h-72 w-56 object-cover" />
  );
}

// ---------------------------------------------------------------------------
// Timeline de evolução
// ---------------------------------------------------------------------------

function TimelineEvolucao({
  itens,
  urls,
  podeVer,
  ehPt,
  aoAnalisar,
}: {
  itens: Mensagem[];
  urls: Record<string, string | null>;
  podeVer: boolean;
  ehPt: boolean;
  aoAnalisar: (id: string, texto: string) => void;
}) {
  return (
    <div className="apex-chat-corpo">
      {!podeVer ? (
        <p className="apex-tipo-secundario border-l-2 px-3 py-2" style={{ borderColor: COR.erro, color: COR.tinta }}>
          Não tens permissão de <strong>evolução</strong> para esta ligação — as fotos de
          progresso do atleta não são mostradas.
        </p>
      ) : itens.length === 0 ? (
        <p className="apex-tipo-corpo py-10 text-center" style={{ color: COR.fraco }}>
          Sem fotos de evolução ainda.
        </p>
      ) : (
        <div className="flex flex-col">
          {itens.map((m, i) => (
            <div key={m.id} className="flex flex-col gap-2 border-b py-4" style={{ borderColor: COR.linha }}>
              {ehPt && i > 0 ? <ComparacaoIA anterior={itens[i - 1]} atual={m} /> : null}
              <div className="flex items-baseline justify-between">
                <span className="apex-tipo-nome-exercicio" style={{ color: COR.tinta }}>
                  {new Date(m.created_at).toLocaleDateString("pt-PT", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    timeZone: FUSO,
                  })}
                </span>
                <span className="apex-tipo-secundario apex-tabular" style={{ color: COR.fraco }}>
                  {m.weight_kg != null ? formatarKg(m.weight_kg) : ""}
                  {m.weight_kg != null && m.measurement ? " · " : ""}
                  {m.measurement ?? ""}
                </span>
              </div>
              {m.media_path ? <MediaEvolucao path={m.media_path} url={urls[m.media_path]} /> : null}
              {m.media_kind === "image" ? (
                <AnaliseIA m={m} ehPt={ehPt} aoAnalisar={aoAnalisar} />
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Análise IA (o PT pede; o atleta só vê o resultado)
// ---------------------------------------------------------------------------

function CaixaIA({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="flex flex-col gap-1 border-l-2 px-3 py-2" style={{ borderColor: COR.tinta }}>
      <span className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
        {titulo}
      </span>
      <p className="apex-tipo-secundario whitespace-pre-wrap" style={{ color: COR.tinta }}>
        {texto}
      </p>
    </div>
  );
}

function BotaoIA({
  rotulo,
  aCorrer,
  disabled,
  onClick,
}: {
  rotulo: string;
  aCorrer: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || aCorrer}
      className="apex-botao apex-botao--claro"
      style={{ width: "auto", alignSelf: "flex-start", padding: "8px 16px" }}
    >
      {aCorrer ? "A analisar…" : rotulo}
    </button>
  );
}

function AnaliseIA({
  m,
  ehPt,
  aoAnalisar,
}: {
  m: Mensagem;
  ehPt: boolean;
  aoAnalisar: (id: string, texto: string) => void;
}) {
  const [aCorrer, setACorrer] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (m.ai_analysis) return <CaixaIA titulo="Análise IA" texto={m.ai_analysis} />;
  if (!ehPt) return null;

  async function analisar() {
    setACorrer(true);
    setErro(null);
    const r = await analisarFotoEvolucao(m.id);
    setACorrer(false);
    if (r.ok && r.texto) aoAnalisar(m.id, r.texto);
    else setErro(r.erro ?? "Falha na análise.");
  }

  return (
    <div className="flex flex-col gap-2">
      <BotaoIA rotulo="Analisar com IA" aCorrer={aCorrer} onClick={analisar} />
      {erro ? (
        <p className="apex-tipo-secundario" style={{ color: COR.erro }}>
          {erro}
        </p>
      ) : null}
    </div>
  );
}

/** Comparação com a foto anterior — não fica gravada, é só desta sessão. */
function ComparacaoIA({ anterior, atual }: { anterior: Mensagem; atual: Mensagem }) {
  const [aCorrer, setACorrer] = useState(false);
  const [texto, setTexto] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  if (anterior.media_kind !== "image" || atual.media_kind !== "image") return null;
  if (texto) return <CaixaIA titulo="Comparação com a anterior" texto={texto} />;

  const prontas = !!anterior.ai_analysis && !!atual.ai_analysis;

  async function comparar() {
    setACorrer(true);
    setErro(null);
    const r = await compararFotosEvolucao(anterior.id, atual.id);
    setACorrer(false);
    if (r.ok && r.texto) setTexto(r.texto);
    else setErro(r.erro ?? "Falha na comparação.");
  }

  return (
    <div className="flex flex-col gap-2">
      <BotaoIA
        rotulo="Comparar com a anterior"
        aCorrer={aCorrer}
        disabled={!prontas}
        onClick={comparar}
      />
      {!prontas ? (
        <p className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
          Analisa primeiro as duas fotos.
        </p>
      ) : null}
      {erro ? (
        <p className="apex-tipo-secundario" style={{ color: COR.erro }}>
          {erro}
        </p>
      ) : null}
    </div>
  );
}

function MediaEvolucao({ path, url }: { path: string; url: string | null | undefined }) {
  if (url === undefined) {
    return <div className="h-64 w-full" style={{ background: COR.fundo }} />;
  }
  if (url === null) {
    return (
      <div
        className="apex-tipo-etiqueta flex h-64 w-full flex-col items-center justify-center gap-1"
        style={{ background: COR.fundo, color: COR.fraco }}
      >
        <span>Sem acesso a este ficheiro</span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={path} className="max-h-[70vh] w-full object-contain" style={{ background: "#000" }} />
  );
}

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

type Cliente = ReturnType<typeof createClient>;

function Composer({
  linkId,
  meId,
  podeEnviarMedia,
  supabase,
  supabaseUrl,
  anonKey,
  aoEnviar,
}: {
  linkId: string;
  meId: string;
  podeEnviarMedia: boolean;
  supabase: Cliente;
  supabaseUrl: string;
  anonKey: string;
  aoEnviar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [menu, setMenu] = useState(false);
  const [modo, setModo] = useState<null | "evolucao" | "media">(null);
  const [aEnviarTexto, setAEnviarTexto] = useState(false);

  async function submeterTexto(e: React.FormEvent) {
    e.preventDefault();
    const body = texto.trim();
    if (!body || aEnviarTexto) return;
    setAEnviarTexto(true);
    const fd = new FormData();
    fd.set("link_id", linkId);
    fd.set("body", body);
    const r = await enviarMensagem({}, fd);
    setAEnviarTexto(false);
    if (r.ok) {
      setTexto("");
      aoEnviar();
    } else if (r.erro) {
      alert(r.erro);
    }
  }

  return (
    <div>
      {modo ? (
        <PainelMedia
          modo={modo}
          linkId={linkId}
          meId={meId}
          supabase={supabase}
          supabaseUrl={supabaseUrl}
          anonKey={anonKey}
          aoFechar={() => setModo(null)}
          aoEnviado={() => {
            setModo(null);
            aoEnviar();
          }}
        />
      ) : null}

      <form onSubmit={submeterTexto} className="apex-composer">
        {podeEnviarMedia ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenu((v) => !v)}
              className="apex-composer__anexar"
              aria-label="Anexar"
            >
              +
            </button>
            {menu ? (
              <div className="apex-composer__menu apex-tipo-corpo">
                <button
                  type="button"
                  onClick={() => {
                    setModo("evolucao");
                    setMenu(false);
                  }}
                >
                  Foto de evolução
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModo("media");
                    setMenu(false);
                  }}
                >
                  Imagem ou vídeo
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submeterTexto(e as unknown as React.FormEvent);
            }
          }}
          rows={1}
          placeholder="Mensagem"
          className="apex-composer__campo"
        />
        <button
          type="submit"
          disabled={!texto.trim() || aEnviarTexto}
          className="apex-botao apex-botao--claro"
          style={{ width: "auto", minHeight: 44, padding: "10px 20px" }}
        >
          Enviar
        </button>
      </form>
    </div>
  );
}

function PainelMedia({
  modo,
  linkId,
  meId,
  supabase,
  supabaseUrl,
  anonKey,
  aoFechar,
  aoEnviado,
}: {
  modo: "evolucao" | "media";
  linkId: string;
  meId: string;
  supabase: Cliente;
  supabaseUrl: string;
  anonKey: string;
  aoFechar: () => void;
  aoEnviado: () => void;
}) {
  const evolucao = modo === "evolucao";
  const [file, setFile] = useState<File | null>(null);
  const [peso, setPeso] = useState("");
  const [medida, setMedida] = useState("");
  const [pct, setPct] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    if (!file || pct != null) return;
    setErro(null);
    try {
      const ehVideo = file.type.startsWith("video/");
      if (evolucao && ehVideo) {
        setErro("A foto de evolução tem de ser uma imagem.");
        return;
      }
      if (ehVideo && file.size > MAX_VIDEO_BYTES) {
        setErro(`Vídeo demasiado grande (máx. ${MAX_VIDEO_BYTES / 1024 / 1024} MB).`);
        return;
      }

      let blob: Blob;
      let contentType: string;
      let ext: string;
      if (ehVideo) {
        blob = file;
        contentType = mimeNormalizado(file.type);
        ext = extensaoDe(contentType);
      } else {
        blob = await redimensionarImagem(file);
        contentType = "image/jpeg";
        ext = "jpg";
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setErro("Sessão expirada.");
        return;
      }

      const path = `${meId}/${evolucao ? "evolucao" : "chat"}/${idFicheiro()}.${ext}`;
      setPct(0);
      await uploadComProgresso({
        supabaseUrl,
        anonKey,
        token: session.access_token,
        path,
        blob,
        contentType,
        onProgress: setPct,
      });

      const fd = new FormData();
      fd.set("link_id", linkId);
      fd.set("media_path", path);
      fd.set("media_kind", ehVideo ? "video" : "image");
      fd.set("is_evolution", evolucao ? "true" : "");
      if (evolucao) {
        fd.set("weight_kg", peso.trim());
        fd.set("measurement", medida.trim());
      }
      const r = await registarMedia({}, fd);
      setPct(null);
      if (r.ok) aoEnviado();
      else setErro(r.erro ?? "Falha ao registar.");
    } catch (e) {
      setPct(null);
      setErro(e instanceof Error ? e.message : "Falha no envio.");
    }
  }

  return (
    <div className="flex flex-col gap-3 border-t p-4" style={{ borderColor: COR.linha }}>
      <div className="flex items-center justify-between">
        <p className="apex-tipo-nome-exercicio" style={{ color: COR.tinta }}>
          {evolucao ? "Foto de evolução" : "Imagem ou vídeo"}
        </p>
        <button type="button" onClick={aoFechar} className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
          Cancelar
        </button>
      </div>

      <input
        type="file"
        accept={evolucao ? "image/*" : "image/*,video/*"}
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="apex-tipo-secundario"
        style={{ color: COR.tinta }}
      />

      {evolucao ? (
        <div className="grid grid-cols-2 gap-2">
          <input
            value={peso}
            onChange={(e) => setPeso(e.target.value)}
            inputMode="decimal"
            placeholder="Peso (kg) — opcional"
            className="apex-tipo-corpo border px-3 py-2 outline-none"
            style={{ borderColor: COR.linha, borderRadius: 2, background: "transparent", color: COR.tinta }}
          />
          <input
            value={medida}
            onChange={(e) => setMedida(e.target.value)}
            maxLength={120}
            placeholder="Medida — opcional"
            className="apex-tipo-corpo border px-3 py-2 outline-none"
            style={{ borderColor: COR.linha, borderRadius: 2, background: "transparent", color: COR.tinta }}
          />
        </div>
      ) : null}

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
        disabled={!file || pct != null}
        className="apex-botao apex-botao--claro"
        style={{ width: "auto", padding: "10px 20px" }}
      >
        {pct != null ? `A enviar… ${pct}%` : "Enviar"}
      </button>
    </div>
  );
}
