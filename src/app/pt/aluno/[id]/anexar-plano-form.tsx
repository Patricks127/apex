"use client";

import { useActionState, useRef } from "react";
import { anexarPlanoDocumento, type EstadoAnexo } from "@/app/actions/plan-documents";

const COR = {
  tinta: "var(--apex-tinta)",
  fraco: "var(--apex-cinza-texto)",
  erro: "var(--apex-erro)",
} as const;

export function AnexarPlanoForm({ alunoId }: { alunoId: string }) {
  const [estado, submeter, aEnviar] = useActionState<EstadoAnexo, FormData>(anexarPlanoDocumento, {});
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={(fd) => {
        submeter(fd);
        formRef.current?.reset();
      }}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="aluno_id" value={alunoId} />
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          name="ficheiro"
          accept="application/pdf"
          required
          className="apex-tipo-secundario"
          style={{ color: COR.tinta }}
        />
        <button
          type="submit"
          disabled={aEnviar}
          className="apex-tipo-etiqueta border px-3 py-1.5"
          style={{ borderColor: COR.tinta, color: COR.tinta }}
        >
          {aEnviar ? "A enviar…" : "Anexar PDF"}
        </button>
      </div>
      {estado.erro ? (
        <p className="apex-tipo-etiqueta" style={{ color: COR.erro }}>
          {estado.erro}
        </p>
      ) : null}
      {estado.ok ? (
        <p className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
          Anexado.
        </p>
      ) : null}
    </form>
  );
}
