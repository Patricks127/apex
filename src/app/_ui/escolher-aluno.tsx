// PT sem saber qual aluno — /chat e /videos abertos sem parâmetro, com mais
// de um aluno ligado. Escolhido: quando há só um aluno, /chat e /videos já
// redirecionam direto (isto só aparece com ≥2). Modo claro — chat/videos em
// si ainda não foram redesenhados (é o próximo passo), mas este ecrã é novo.

import Link from "next/link";
import type { AlunoLigado } from "@/lib/chat/link";

export function EscolherAluno({
  alunos,
  destino,
  titulo,
}: {
  alunos: AlunoLigado[];
  destino: "chat" | "videos";
  titulo: string;
}) {
  return (
    <main className="apex-ecra-claro mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-4 px-5 py-10">
      <h1 className="apex-tipo-titulo-ecra" style={{ marginTop: 0, color: "var(--apex-tinta)" }}>
        {titulo}
      </h1>
      <p className="apex-tipo-corpo" style={{ color: "var(--apex-cinza-texto)" }}>
        Escolhe um aluno.
      </p>
      <div className="flex flex-col">
        {alunos.map((a) => (
          <Link
            key={a.id}
            href={`/pt/aluno/${a.id}/${destino}`}
            className="apex-linha-exercicio"
            style={{ textDecoration: "none" }}
          >
            <span className="apex-tipo-nome-exercicio" style={{ color: "var(--apex-tinta)" }}>
              {a.nome}
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
