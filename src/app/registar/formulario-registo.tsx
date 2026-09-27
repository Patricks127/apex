"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registar, type EstadoRegisto } from "@/app/actions/auth";
import { AvisoErroClaro, BotaoSubmeterClaro, CampoClaro, TituloAuth } from "@/app/_ui/auth-claro";

const COR = {
  tinta: "var(--apex-tinta)",
  fraco: "var(--apex-cinza-texto)",
  erro: "var(--apex-erro)",
} as const;

const ESTADO_INICIAL: EstadoRegisto = {};

export function FormularioRegisto() {
  const [estado, acao, pendente] = useActionState(registar, ESTADO_INICIAL);

  if (estado.confirmarEmail) {
    return (
      <div className="flex flex-col gap-3">
        <TituloAuth
          titulo="Confirma o teu email"
          subtitulo={
            <>
              Enviámos uma mensagem para{" "}
              <span style={{ color: COR.tinta, fontWeight: 600 }}>{estado.valores?.email}</span>. Abre a ligação que
              recebeste para ativar a conta e depois inicia sessão.
            </>
          }
        />
        <Link
          href="/entrar"
          className="apex-tipo-secundario apex-link-toque self-start underline underline-offset-4"
          style={{ color: COR.tinta, fontWeight: 700 }}
        >
          Ir para o início de sessão
        </Link>
      </div>
    );
  }

  return (
    <form action={acao} className="flex flex-col gap-5" noValidate>
      <TituloAuth titulo="Criar conta" subtitulo="Junta-te à APEX." />

      {estado.mensagem ? <AvisoErroClaro>{estado.mensagem}</AvisoErroClaro> : null}

      <CampoClaro
        etiqueta="Nome"
        name="nome"
        type="text"
        autoComplete="name"
        required
        defaultValue={estado.valores?.nome}
        erro={estado.erros?.nome}
      />

      <CampoClaro
        etiqueta="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={estado.valores?.email}
        erro={estado.erros?.email}
      />

      <CampoClaro
        etiqueta="Telemóvel (opcional)"
        name="telemovel"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        defaultValue={estado.valores?.telemovel}
        erro={estado.erros?.telemovel}
      />

      <CampoClaro
        etiqueta="Palavra-passe"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint="Pelo menos 8 caracteres."
        erro={estado.erros?.password}
      />

      <fieldset className="flex flex-col gap-2">
        <label className="apex-opcao apex-tipo-secundario">
          <input type="checkbox" name="aceita_termos" />
          <span>
            Li e aceito os <strong>Termos</strong> e a <strong>Política de Privacidade</strong>.
          </span>
        </label>
        {estado.erros?.termos ? (
          <span className="apex-tipo-etiqueta" style={{ color: COR.erro }}>
            {estado.erros.termos}
          </span>
        ) : null}

        <label className="apex-opcao apex-tipo-secundario">
          <input type="checkbox" name="aceita_saude" />
          <span>
            Compreendo que a APEX não substitui aconselhamento médico e que o exercício tem riscos (ver o{" "}
            <strong>aviso de saúde</strong>, nos Termos).
          </span>
        </label>
        {estado.erros?.saude ? (
          <span className="apex-tipo-etiqueta" style={{ color: COR.erro }}>
            {estado.erros.saude}
          </span>
        ) : null}

        {/* Os links vivem FORA das linhas das caixas: lá dentro ocupavam o
            meio da linha, e tocar para marcar a caixa abria os Termos num
            separador novo — na PWA do iPhone, isso tirava a pessoa da app a
            meio do registo. */}
        <div className="apex-tipo-secundario flex flex-wrap gap-x-5">
          <Link href="/termos" target="_blank" className="apex-link-toque underline underline-offset-4" style={{ color: COR.tinta }}>
            Ler os Termos
          </Link>
          <Link href="/privacidade" target="_blank" className="apex-link-toque underline underline-offset-4" style={{ color: COR.tinta }}>
            Ler a Política de Privacidade
          </Link>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="apex-tipo-secundario" style={{ color: COR.tinta, fontWeight: 600 }}>
          Sou…
        </legend>
        <div className="mt-1 grid grid-cols-2 gap-2">
          <OpcaoPapel
            value="atleta"
            titulo="Atleta"
            descricao="Quero treinar"
            checkedPorDefeito={estado.valores?.papel !== "pt"}
          />
          <OpcaoPapel
            value="pt"
            titulo="Personal Trainer"
            descricao="Acompanho atletas"
            checkedPorDefeito={estado.valores?.papel === "pt"}
          />
        </div>
        {estado.erros?.papel ? (
          <span className="apex-tipo-etiqueta" style={{ color: COR.erro }} role="alert">
            {estado.erros.papel}
          </span>
        ) : null}
      </fieldset>

      <BotaoSubmeterClaro pendente={pendente}>Criar conta</BotaoSubmeterClaro>

      <p className="apex-tipo-secundario" style={{ color: COR.fraco }}>
        Já tens conta?{" "}
        <Link
          href="/entrar"
          className="apex-link-toque underline underline-offset-4"
          style={{ color: COR.tinta, fontWeight: 700 }}
        >
          Iniciar sessão
        </Link>
      </p>
    </form>
  );
}

function OpcaoPapel({
  value,
  titulo,
  descricao,
  checkedPorDefeito,
}: {
  value: string;
  titulo: string;
  descricao: string;
  checkedPorDefeito: boolean;
}) {
  return (
    <label className="apex-opcao apex-opcao--papel">
      <input
        type="radio"
        name="papel"
        value={value}
        defaultChecked={checkedPorDefeito}
        className="sr-only"
      />
      <span className="apex-tipo-nome-exercicio block" style={{ color: COR.tinta }}>
        {titulo}
      </span>
      <span className="apex-tipo-etiqueta block" style={{ color: COR.fraco, fontWeight: 500 }}>
        {descricao}
      </span>
    </label>
  );
}
