"use client";

import { useActionState, useState } from "react";
import {
  enviarPedidoLigacao,
  procurarPts,
  resolverPt,
  type EstadoLigar,
  type ResultadoProcura,
  type ResultadoResolver,
} from "@/app/actions/ligacoes";
import { AvisoErro, BotaoSubmeter, Campo } from "@/app/_ui/campos";
import { PainelPermissoes } from "@/app/_ui/permissoes";

type Alvo = { id?: string; pt_code?: string | null; nome: string };
type Aba = "codigo" | "link" | "procurar";

const ABAS: { id: Aba; etiqueta: string }[] = [
  { id: "codigo", etiqueta: "Código" },
  { id: "link", etiqueta: "Link" },
  { id: "procurar", etiqueta: "Procurar" },
];

export function FluxoLigar() {
  const [aba, setAba] = useState<Aba>("codigo");
  const [alvo, setAlvo] = useState<Alvo | null>(null);

  if (alvo) {
    return <PainelConfirmacao alvo={alvo} aoVoltar={() => setAlvo(null)} />;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-zinc-100">Ligar a um PT</h1>
        <p className="text-sm text-zinc-400">
          Escolhe como queres encontrar o teu personal trainer.
        </p>
      </div>

      <div className="flex rounded-lg border border-zinc-800 bg-zinc-950 p-1">
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAba(a.id)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              aba === a.id
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {a.etiqueta}
          </button>
        ))}
      </div>

      {aba === "codigo" && (
        <FormResolver
          key="codigo"
          etiqueta="Código do PT"
          placeholder="RUI-8842"
          onEncontrado={(pt) => setAlvo({ id: pt.id, pt_code: pt.pt_code, nome: pt.name })}
        />
      )}
      {aba === "link" && (
        <FormResolver
          key="link"
          etiqueta="Link do PT"
          placeholder="apex.fit/pt/RUI-8842"
          hint="Também podes colar só o código."
          onEncontrado={(pt) => setAlvo({ id: pt.id, pt_code: pt.pt_code, nome: pt.name })}
        />
      )}
      {aba === "procurar" && (
        <FormProcurar
          onEscolhido={(pt) => setAlvo({ id: pt.id, pt_code: pt.pt_code, nome: pt.name })}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function FormResolver({
  etiqueta,
  placeholder,
  hint,
  onEncontrado,
}: {
  etiqueta: string;
  placeholder: string;
  hint?: string;
  onEncontrado: (pt: NonNullable<ResultadoResolver["pt"]>) => void;
}) {
  const [estado, acao, pendente] = useActionState(
    async (anterior: ResultadoResolver, formData: FormData) => {
      const r = await resolverPt(anterior, formData);
      if (r.pt) onEncontrado(r.pt);
      return r;
    },
    {} as ResultadoResolver,
  );

  return (
    <form action={acao} className="flex flex-col gap-4" noValidate>
      {estado.erro ? <AvisoErro>{estado.erro}</AvisoErro> : null}
      <Campo
        etiqueta={etiqueta}
        name="valor"
        type="text"
        autoComplete="off"
        autoCapitalize="characters"
        required
        placeholder={placeholder}
        hint={hint}
      />
      <BotaoSubmeter pendente={pendente}>Continuar</BotaoSubmeter>
    </form>
  );
}

// ---------------------------------------------------------------------------

function FormProcurar({
  onEscolhido,
}: {
  onEscolhido: (pt: ResultadoProcura["resultados"][number]) => void;
}) {
  const [estado, acao, pendente] = useActionState(procurarPts, {
    resultados: [],
  } as ResultadoProcura);

  return (
    <div className="flex flex-col gap-4">
      <form action={acao} className="flex flex-col gap-3" noValidate>
        {estado.erro ? <AvisoErro>{estado.erro}</AvisoErro> : null}
        <Campo
          etiqueta="Nome do PT"
          name="q"
          type="search"
          autoComplete="off"
          required
          placeholder="ex.: Rui Santos"
        />
        <BotaoSubmeter pendente={pendente}>Procurar</BotaoSubmeter>
      </form>

      {estado.resultados.length > 0 && (
        <ul className="flex flex-col gap-2">
          {estado.resultados.map((pt) => (
            <li key={pt.id}>
              <button
                type="button"
                onClick={() => onEscolhido(pt)}
                className="flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-left transition hover:border-zinc-600"
              >
                <span>
                  <span className="block text-sm font-medium text-zinc-100">{pt.name}</span>
                  <span className="block text-xs text-zinc-500">
                    {pt.pt_code}
                    {pt.city ? ` · ${pt.city}` : ""}
                  </span>
                </span>
                <span className="text-xs text-zinc-400">Escolher</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function PainelConfirmacao({ alvo, aoVoltar }: { alvo: Alvo; aoVoltar: () => void }) {
  const [estado, acao, pendente] = useActionState(
    enviarPedidoLigacao,
    {} as EstadoLigar,
  );

  return (
    <form action={acao} className="flex flex-col gap-5">
      <button
        type="button"
        onClick={aoVoltar}
        className="self-start text-sm text-zinc-500 hover:text-zinc-300"
      >
        ← Escolher outro PT
      </button>

      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-zinc-100">Ligar a {alvo.nome}</h1>
        <p className="text-sm text-zinc-400">
          Escolhe o que o {alvo.nome} vai poder ver. O pedido só fica ativo depois de o PT
          aceitar.
        </p>
      </div>

      {estado.erro ? <AvisoErro>{estado.erro}</AvisoErro> : null}

      {alvo.id ? (
        <input type="hidden" name="pt_id" value={alvo.id} />
      ) : (
        <input type="hidden" name="pt_code" value={alvo.pt_code ?? ""} />
      )}

      <PainelPermissoes />

      <BotaoSubmeter pendente={pendente}>Enviar pedido</BotaoSubmeter>
    </form>
  );
}
