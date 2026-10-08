"use client";

import { useState, useTransition } from "react";
import {
  arquivarPlano,
  desarquivarPlano,
  toggleRascunho,
  toggleModelo,
} from "@/app/actions/planos";

interface PlanStatusControlsProps {
  planId: string;
  isDraft: boolean;
  isTemplate: boolean;
  isArchived: boolean;
  onSuccess?: () => void;
}

/**
 * Dropdowns de gestão de estado de um plano de treino.
 * Exibe chips coloridos + menu de ações inline.
 */
export function PlanStatusControls({
  planId,
  isDraft,
  isTemplate,
  isArchived,
  onSuccess,
}: PlanStatusControlsProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok?: boolean; erro?: string }>) {
    setErro(null);
    startTransition(async () => {
      const r = await fn();
      if (r.erro) setErro(r.erro);
      else { setOpen(false); onSuccess?.(); }
    });
  }

  return (
    <div className="relative inline-flex items-center gap-1.5">
      {/* Status chips */}
      {isDraft && !isArchived && (
        <span className="inline-flex items-center rounded-full bg-yellow-100 dark:bg-yellow-900/30 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:text-yellow-300">
          Rascunho
        </span>
      )}
      {isTemplate && !isArchived && (
        <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">
          Modelo
        </span>
      )}
      {isArchived && (
        <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs font-medium text-gray-500">
          Arquivado
        </span>
      )}

      {/* Actions menu button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={pending}
          className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition disabled:opacity-40"
          title="Gerir plano"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
            <circle cx="8" cy="3" r="1.5" />
            <circle cx="8" cy="8" r="1.5" />
            <circle cx="8" cy="13" r="1.5" />
          </svg>
        </button>

        {open && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />

            <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 shadow-lg py-1 text-sm">
              {isArchived ? (
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                  onClick={() => run(() => desarquivarPlano(planId))}
                >
                  Desarquivar
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                    onClick={() => run(() => toggleRascunho(planId, !isDraft))}
                  >
                    {isDraft ? "Publicar plano" : "Marcar como rascunho"}
                  </button>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                    onClick={() => run(() => toggleModelo(planId, !isTemplate))}
                  >
                    {isTemplate ? "Remover modelo" : "Guardar como modelo"}
                  </button>
                  <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
                    onClick={() => run(() => arquivarPlano(planId))}
                  >
                    Arquivar plano
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {erro && (
        <span className="text-xs text-red-500">{erro}</span>
      )}
    </div>
  );
}

/** Badge simples de estado (para listas somente de leitura). */
export function PlanStatusBadge({
  isDraft,
  isTemplate,
  isArchived,
}: {
  isDraft: boolean;
  isTemplate: boolean;
  isArchived: boolean;
}) {
  if (isArchived)
    return <span className="text-xs text-gray-400 italic">Arquivado</span>;
  if (isDraft)
    return <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400">Rascunho</span>;
  if (isTemplate)
    return <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Modelo</span>;
  return null;
}
