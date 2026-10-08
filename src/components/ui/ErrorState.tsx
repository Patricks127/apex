import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Algo correu mal",
  description = "Não foi possível carregar os dados. Tenta novamente.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-16 px-6",
        className
      )}
    >
      <div className="text-5xl mb-4 select-none" aria-hidden>
        ⚠️
      </div>
      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
        {title}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mb-6">
        {description}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 active:bg-gray-100 transition-colors"
        >
          ↺ Tentar novamente
        </button>
      )}
    </div>
  );
}

// Banner inline para erros dentro de cards
interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorBanner({ message, onRetry, className }: ErrorBannerProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3",
        className
      )}
    >
      <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
        <span aria-hidden>⚠</span>
        <span>{message}</span>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline whitespace-nowrap"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}
