import { Sino } from "../../_ui/social/sino";
import { linhaMotivadora } from "@/lib/painel/copy-atleta";
import { MenuPerfil } from "./menu-perfil";

const COR = {
  tinta: "var(--apex-tinta)",
  fraco: "var(--apex-cinza-texto)",
} as const;

/**
 * Cabeçalho do painel (atleta E PT) — saudação modesta, só o primeiro
 * nome (`apex-tipo-saudacao`, 24–28px; nunca o nome completo a título de
 * ecrã — era o "Daniela Paulino" a 44px a ocupar metade do telemóvel),
 * sino de notificações e o ponto de entrada do perfil (menu com "Terminar
 * sessão" — o resto do perfil é da Fase 3). Nada de sessão gigante aqui.
 */
export function CabecalhoAtleta({
  nome,
  avatarUrl = null,
  naoLidas,
  papel = "atleta",
  etiqueta,
}: {
  nome: string | null;
  avatarUrl?: string | null;
  naoLidas: number;
  papel?: "atleta" | "pt";
  /** linha pequena por cima da saudação (ex.: a data, no painel do PT) */
  etiqueta?: string;
}) {
  const primeiroNome = (nome ?? "").trim().split(/\s+/)[0] || (papel === "pt" ? "PT" : "atleta");

  return (
    <header className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        {etiqueta ? (
          <p className="apex-tipo-etiqueta" style={{ color: COR.fraco }}>
            {etiqueta}
          </p>
        ) : null}
        <h1 className="apex-tipo-saudacao" style={{ color: COR.tinta }}>
          Olá, {primeiroNome}
        </h1>
        {papel === "atleta" ? (
          <p className="apex-tipo-secundario" style={{ color: COR.fraco }}>
            {linhaMotivadora()}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Sino naoLidas={naoLidas} />
        <MenuPerfil nome={nome} avatarUrl={avatarUrl} papel={papel} />
      </div>
    </header>
  );
}
