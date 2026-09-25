import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { carregarPlanoAtivo, treinoDeHojeFeito } from "@/lib/treino/perfil";
import { indiceDiaSemanaHoje, proximoDiaDeTreino, construirLinhaTempo } from "@/lib/treino/linha-tempo";
import type { DiaGerado } from "@/lib/motor";
import { BlocoDados } from "../../_ui/design/bloco-dados";

const COR = {
  tinta: "var(--apex-tinta)",
  fraco: "var(--apex-cinza-texto)",
} as const;

const BUCKET_PLANOS = "plan-documents";

/**
 * O card principal do dashboard do atleta — "o que faço agora?". Antes,
 * quando o PT anexava um PDF, isto virava o ecrã inteiro ("O teu plano é um
 * PDF" como título). Agora é sempre UM cartão entre outros — o PDF é uma
 * funcionalidade do plano, não o dashboard (ver referencia/plano-execucao-
 * apex.md, ponto 3/18).
 */
export async function CartaoTreinoHoje({ userId }: { userId: string }) {
  const supabase = await createClient();

  const { data: documentos } = await supabase
    .from("plan_documents")
    .select("id, file_name, storage_path")
    .eq("student_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  if ((documentos ?? []).length > 0) {
    const doc = documentos![0];
    const { data: assinado } = await supabase.storage.from(BUCKET_PLANOS).createSignedUrl(doc.storage_path, 60 * 60);
    return <CartaoPlanoPdf nomeFicheiro={doc.file_name} url={assinado?.signedUrl ?? null} />;
  }

  const planoAtivo = await carregarPlanoAtivo(supabase, userId);

  if (!planoAtivo) {
    return (
      <section className="apex-cartao apex-cartao--destaque">
        <span className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
          O teu plano
        </span>
        <h2 className="apex-tipo-titulo-seccao" style={{ marginTop: 0, color: COR.tinta }}>
          Ainda sem plano
        </h2>
        <p className="apex-tipo-corpo" style={{ color: COR.fraco }}>
          Responde a seis perguntas rápidas e o motor gera a tua semana.
        </p>
        <Link href="/plano" className="apex-botao apex-botao--claro" style={{ marginTop: "var(--apex-space-1)" }}>
          Começar
        </Link>
      </section>
    );
  }

  const dias = planoAtivo.days.days;
  const indiceHoje = indiceDiaSemanaHoje();
  const diaHoje = dias[indiceHoje];

  const semanaAtual = planoAtivo.progression?.week ?? 1;
  const nPrevistos = dias.filter((d) => !d.rest).length;
  const { count: nFeitosCru } = await supabase
    .from("workout_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("week_number", semanaAtual);
  const nFeitos = Math.min(nPrevistos, nFeitosCru ?? 0);
  const percursoSemana = nPrevistos > 0 ? Math.round((nFeitos / nPrevistos) * 100) : 0;

  return (
    <section className="flex flex-col gap-4">
      {diaHoje.rest ? (
        <CartaoDescanso dias={dias} indiceHoje={indiceHoje} />
      ) : (
        <CartaoTreinoEstruturado userId={userId} dia={diaHoje} indiceHoje={indiceHoje} />
      )}

      {nPrevistos > 0 ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <span className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
              Esta semana
            </span>
            <span className="apex-tipo-secundario apex-tabular" style={{ color: COR.fraco }}>
              {nFeitos} de {nPrevistos}
            </span>
          </div>
          <div className="apex-progresso-claro">
            <div className="apex-progresso-claro__preenchido" style={{ width: `${percursoSemana}%` }} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function CartaoPlanoPdf({ nomeFicheiro, url }: { nomeFicheiro: string; url: string | null }) {
  return (
    <section className="apex-cartao apex-cartao--destaque">
      <span className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
        O teu plano
      </span>
      <p className="apex-tipo-corpo" style={{ color: COR.fraco }}>
        O teu PT preparou-te um plano em PDF. O treino ao vivo e a progressão automática não estão disponíveis para
        este plano — regista os teus treinos manualmente.
      </p>
      <div className="flex flex-col gap-2 min-[380px]:flex-row">
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="apex-botao apex-botao--claro">
            Abrir plano
          </a>
        ) : (
          <span className="apex-tipo-secundario" style={{ color: COR.fraco }}>
            {nomeFicheiro} — link indisponível de momento.
          </span>
        )}
        <Link
          href="/treino/registar"
          className="apex-tipo-secundario flex items-center justify-center border px-4 py-2.5"
          style={{ borderColor: "var(--apex-cinza-linha)", color: COR.tinta }}
        >
          Registar treino de hoje
        </Link>
      </div>
    </section>
  );
}

async function CartaoTreinoEstruturado({
  userId,
  dia,
  indiceHoje,
}: {
  userId: string;
  dia: DiaGerado;
  indiceHoje: number;
}) {
  const supabase = await createClient();
  const titulo = dia.title ?? "Treino";
  const feito = await treinoDeHojeFeito(supabase, userId, titulo);
  const { duracaoTotalMin } = construirLinhaTempo(dia, { estadoDia: "neutro" });
  const nExercicios = dia.exercises?.length ?? 0;

  if (feito) {
    return (
      <section className="apex-cartao apex-cartao--destaque">
        <span className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
          Hoje · {dia.dayName}
        </span>
        <h2 className="apex-tipo-titulo-ecra" style={{ marginTop: 0, color: COR.tinta }}>
          {titulo}
        </h2>
        <p className="apex-tipo-corpo" style={{ color: COR.fraco }}>
          Já treinaste hoje. Bom trabalho.
        </p>
      </section>
    );
  }

  return (
    <section className="apex-cartao apex-cartao--destaque">
      <span className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
        Hoje · {dia.dayName}
      </span>
      <h2 className="apex-tipo-titulo-ecra" style={{ marginTop: 0, color: COR.tinta }}>
        {titulo}
      </h2>
      <BlocoDados
        itens={[
          { valor: String(nExercicios), etiqueta: "exercícios" },
          { valor: `${duracaoTotalMin}′`, etiqueta: "estimado" },
        ]}
      />
      <Link href={`/treino/${indiceHoje}`} className="apex-botao apex-botao--claro">
        Começar treino
      </Link>
    </section>
  );
}

function CartaoDescanso({ dias, indiceHoje }: { dias: DiaGerado[]; indiceHoje: number }) {
  const proximo = proximoDiaDeTreino(dias, indiceHoje);
  return (
    <section className="apex-cartao apex-cartao--destaque">
      <span className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
        Hoje
      </span>
      <h2 className="apex-tipo-titulo-seccao" style={{ marginTop: 0, color: COR.tinta }}>
        Descanso
      </h2>
      <p className="apex-tipo-corpo" style={{ color: COR.fraco }}>
        {proximo
          ? `Próximo treino ${rotuloOffset(proximo.offset)}: ${proximo.dia.title} (${proximo.dia.dayName}).`
          : "Sem treinos marcados esta semana."}
      </p>
    </section>
  );
}

function rotuloOffset(offset: number): string {
  if (offset === 1) return "amanhã";
  if (offset === 2) return "depois de amanhã";
  return `daqui a ${offset} dias`;
}
