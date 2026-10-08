import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon = "📭",
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-16 px-6",
        className
      )}
    >
      <div className="text-5xl mb-4 select-none" aria-hidden>
        {icon}
      </div>
      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mb-6">
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-semibold transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// Variants pre-construídos para os casos mais comuns
export function EmptyWorkouts({ onStart }: { onStart?: () => void }) {
  return (
    <EmptyState
      icon="🏋️"
      title="Ainda sem treinos"
      description="Os teus treinos aparecerão aqui assim que completares a primeira sessão."
      action={onStart ? { label: "+ Iniciar Treino", onClick: onStart } : undefined}
    />
  );
}

export function EmptyAthletes({ onInvite }: { onInvite?: () => void }) {
  return (
    <EmptyState
      icon="👥"
      title="Sem atletas ainda"
      description="Convida os teus atletas para começarem a usar o APEX."
      action={onInvite ? { label: "Convidar Atleta", onClick: onInvite } : undefined}
    />
  );
}

export function EmptyMessages() {
  return (
    <EmptyState
      icon="💬"
      title="Nenhuma mensagem"
      description="As mensagens com o teu PT aparecerão aqui."
    />
  );
}

export function EmptyPlans({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      icon="📋"
      title="Nenhum plano criado"
      description="Cria o primeiro plano de treino para este atleta."
      action={onCreate ? { label: "+ Criar Plano", onClick: onCreate } : undefined}
    />
  );
}
