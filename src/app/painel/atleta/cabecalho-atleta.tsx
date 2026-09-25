import { Sino } from "../../_ui/social/sino";
import { linhaMotivadora } from "@/lib/painel/copy-atleta";
import { MenuPerfil } from "./menu-perfil";

const COR = {
  tinta: "var(--apex-tinta)",
  fraco: "var(--apex-cinza-texto)",
} as const;

/**
 * Cabeçalho do atleta — saudação modesta (nunca o `apex-tipo-titulo-ecra`
 * de 44px: esse peso fica para o treino de hoje, o herói real do ecrã),
 * sino de notificações e o ponto de entrada do perfil (menu com "Terminar
 * sessão" — o resto do perfil é da Fase 3). Nada de sessão gigante aqui.
 */
export function CabecalhoAtleta({ nome, naoLidas }: { nome: string | null; naoLidas: number }) {
  const primeiroNome = (nome ?? "").trim().split(/\s+/)[0] || "atleta";

  return (
    <header className="flex items-start justify-between gap-3">
      <div className="flex flex-col gap-0.5">
        <h1 className="apex-tipo-titulo-seccao" style={{ marginTop: 0, color: COR.tinta }}>
          Olá, {primeiroNome}
        </h1>
        <p className="apex-tipo-secundario" style={{ color: COR.fraco }}>
          {linhaMotivadora()}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Sino naoLidas={naoLidas} />
        <MenuPerfil nome={nome} />
      </div>
    </header>
  );
}
