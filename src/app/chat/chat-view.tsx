"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import {
  assinarMedia,
  enviarMensagem,
  marcarLidas,
  registarMedia,
} from "@/app/actions/chat";
import {
  redimensionarImagem,
  uploadComProgresso,
  extensaoDe,
  idFicheiro,
  MAX_VIDEO_BYTES,
} from "@/lib/chat/media";

export type Mensagem = {
  id: string;
  sender_id: string;
  body: string | null;
  media_path: string | null;
  media_kind: "image" | "video" | null;
  is_evolution: boolean;
  weight_kg: number | null;
  measurement: string | null;
  read_at: string | null;
  created_at: string;
};

const MS_DIA = 86_400_000;

function rotuloDia(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date();
  const zerar = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((zerar(hoje) - zerar(d)) / MS_DIA);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  return d.toLocaleDateString("pt-PT", { day: "numeric", month: "long" });
}

const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });

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
        "id, sender_id, body, media_path, media_kind, is_evolution, weight_kg, measurement, read_at, created_at",
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
  useEffect(() => {
    let canal: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      await marcarLidas(linkId);
      await assinarEmFalta(inicial);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);
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
      if (canal) supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkId]);

  // scroll para o fim quando chegam mensagens (na aba conversa)
  useEffect(() => {
    if (aba === "conversa") fundoRef.current?.scrollIntoView({ block: "end" });
  }, [msgs, aba]);

  const evolucao = msgs.filter((m) => m.is_evolution);

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-zinc-600">
            {perspetiva === "aluno" ? "O teu PT" : "Atleta"}
          </p>
          <h1 className="text-lg font-semibold text-zinc-100">{outroNome}</h1>
        </div>
        <div className="flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5 text-xs">
          {(["conversa", "evolucao"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setAba(t)}
              className={`rounded-md px-3 py-1.5 font-medium transition ${
                aba === t ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t === "conversa" ? "Conversa" : "Evolução"}
            </button>
          ))}
        </div>
      </header>

      {aba === "conversa" ? (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {msgs.length === 0 ? (
              <p className="py-10 text-center text-sm text-zinc-600">
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
            podeEnviarMedia={perspetiva === "aluno"}
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
    <div className="flex flex-col gap-4">
      {blocos.map((b, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <div className="my-1 flex justify-center">
            <span className="rounded-full bg-zinc-900 px-3 py-0.5 text-[11px] font-medium text-zinc-500">
              {b.dia}
            </span>
          </div>
          {b.itens.map((m) => (
            <Bolha key={m.id} m={m} meu={m.sender_id === meId} urls={urls} />
          ))}
        </div>
      ))}
    </div>
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
    <div className={`flex ${meu ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
          meu
            ? "rounded-br-sm bg-zinc-100 text-zinc-900"
            : "rounded-bl-sm bg-zinc-800 text-zinc-100"
        }`}
      >
        {m.is_evolution ? (
          <span
            className={`mb-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              meu ? "bg-zinc-900/10 text-zinc-700" : "bg-sky-500/20 text-sky-300"
            }`}
          >
            Evolução
            {m.weight_kg != null ? ` · ${m.weight_kg} kg` : ""}
            {m.measurement ? ` · ${m.measurement}` : ""}
          </span>
        ) : null}
        {m.media_path ? (
          <MediaMsg
            path={m.media_path}
            kind={m.media_kind}
            url={urls[m.media_path]}
            claro={meu}
          />
        ) : null}
        {m.body ? <p className="whitespace-pre-wrap break-words">{m.body}</p> : null}
        <div
          className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
            meu ? "text-zinc-500" : "text-zinc-400"
          }`}
        >
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
  claro,
}: {
  path: string;
  kind: "image" | "video" | null;
  url: string | null | undefined;
  claro: boolean;
}) {
  if (url === undefined) {
    return (
      <div
        className={`mb-1 h-40 w-56 animate-pulse rounded-lg ${
          claro ? "bg-zinc-300" : "bg-zinc-700"
        }`}
      />
    );
  }
  if (url === null) {
    return (
      <div
        className={`mb-1 flex h-40 w-56 flex-col items-center justify-center gap-1 rounded-lg border text-xs ${
          claro ? "border-zinc-300 text-zinc-500" : "border-zinc-700 text-zinc-400"
        }`}
      >
        <span className="text-lg">🔒</span>
        <span>Sem acesso a este ficheiro</span>
      </div>
    );
  }
  if (kind === "video") {
    return (
      <video
        src={url}
        controls
        className="mb-1 max-h-72 w-56 rounded-lg bg-black"
        title={path}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="mb-1 max-h-72 w-56 rounded-lg object-cover" />
  );
}

// ---------------------------------------------------------------------------
// Timeline de evolução
// ---------------------------------------------------------------------------

function TimelineEvolucao({
  itens,
  urls,
  podeVer,
}: {
  itens: Mensagem[];
  urls: Record<string, string | null>;
  podeVer: boolean;
}) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {!podeVer ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Não tens permissão de <span className="font-medium">evolução</span> para esta
          ligação — as fotos de progresso do atleta não são mostradas.
        </p>
      ) : itens.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-600">
          Sem fotos de evolução ainda.
        </p>
      ) : (
        <ol className="flex flex-col gap-4">
          {itens.map((m) => (
            <li
              key={m.id}
              className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900"
            >
              <div className="flex items-baseline justify-between px-3 py-2 text-xs">
                <span className="font-medium text-zinc-200">
                  {new Date(m.created_at).toLocaleDateString("pt-PT", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <span className="text-zinc-500">
                  {m.weight_kg != null ? `${m.weight_kg} kg` : ""}
                  {m.weight_kg != null && m.measurement ? " · " : ""}
                  {m.measurement ?? ""}
                </span>
              </div>
              {m.media_path ? (
                <MediaEvolucao path={m.media_path} url={urls[m.media_path]} />
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function MediaEvolucao({ path, url }: { path: string; url: string | null | undefined }) {
  if (url === undefined) {
    return <div className="h-64 w-full animate-pulse bg-zinc-800" />;
  }
  if (url === null) {
    return (
      <div className="flex h-64 w-full flex-col items-center justify-center gap-1 bg-zinc-950 text-xs text-zinc-500">
        <span className="text-xl">🔒</span>
        <span>Sem acesso a este ficheiro</span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={path} className="max-h-[70vh] w-full object-contain bg-black" />
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
    <div className="border-t border-zinc-800 bg-zinc-950">
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

      <form onSubmit={submeterTexto} className="flex items-end gap-2 px-3 py-3">
        {podeEnviarMedia ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenu((v) => !v)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-700 text-xl text-zinc-300 hover:bg-zinc-800"
              aria-label="Anexar"
            >
              +
            </button>
            {menu ? (
              <div className="absolute bottom-12 left-0 z-10 w-52 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 text-sm shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    setModo("evolucao");
                    setMenu(false);
                  }}
                  className="block w-full px-3 py-2.5 text-left text-zinc-200 hover:bg-zinc-800"
                >
                  📈 Foto de evolução
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModo("media");
                    setMenu(false);
                  }}
                  className="block w-full border-t border-zinc-800 px-3 py-2.5 text-left text-zinc-200 hover:bg-zinc-800"
                >
                  🖼️ Imagem ou vídeo
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
          className="max-h-32 flex-1 resize-none rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
        />
        <button
          type="submit"
          disabled={!texto.trim() || aEnviarTexto}
          className="flex h-10 shrink-0 items-center rounded-full bg-zinc-100 px-4 text-sm font-semibold text-zinc-900 transition hover:bg-white disabled:opacity-50"
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
        setErro("Vídeo demasiado grande (máx. 50 MB).");
        return;
      }

      let blob: Blob;
      let contentType: string;
      let ext: string;
      if (ehVideo) {
        blob = file;
        contentType = file.type;
        ext = extensaoDe(file.type);
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
    <div className="flex flex-col gap-3 border-b border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-zinc-100">
          {evolucao ? "Foto de evolução" : "Imagem ou vídeo"}
        </p>
        <button
          type="button"
          onClick={aoFechar}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          Cancelar
        </button>
      </div>

      <input
        type="file"
        accept={evolucao ? "image/*" : "image/*,video/*"}
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="text-sm text-zinc-300 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-zinc-200"
      />

      {evolucao ? (
        <div className="grid grid-cols-2 gap-2">
          <input
            value={peso}
            onChange={(e) => setPeso(e.target.value)}
            inputMode="decimal"
            placeholder="Peso (kg) — opcional"
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
          />
          <input
            value={medida}
            onChange={(e) => setMedida(e.target.value)}
            maxLength={120}
            placeholder="Medida — opcional"
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
          />
        </div>
      ) : null}

      {pct != null ? (
        <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full bg-emerald-400 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
      {erro ? <p className="text-xs text-red-400">{erro}</p> : null}

      <button
        type="button"
        onClick={enviar}
        disabled={!file || pct != null}
        className="self-start rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-white disabled:opacity-50"
      >
        {pct != null ? `A enviar… ${pct}%` : "Enviar"}
      </button>
    </div>
  );
}
