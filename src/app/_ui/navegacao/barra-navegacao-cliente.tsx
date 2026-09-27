"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export type Papel = "atleta" | "pt";

type Separador = {
  href: string;
  etiqueta: string;
  icone: ReactNode;
  /** prefixos de caminho em que este separador conta como ativo */
  ativoEm: string[];
};

// Ícones de traço 1.8, como o sino — mesmo desenho em toda a barra.
const Icone = ({ children }: { children: ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    width="22"
    height="22"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const ICONE = {
  inicio: (
    <Icone>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9v12h14V9" />
    </Icone>
  ),
  plano: (
    <Icone>
      <rect x="3" y="4" width="18" height="17" rx="1" />
      <path d="M3 9h18M8 2v4M16 2v4" />
    </Icone>
  ),
  progresso: (
    <Icone>
      <path d="M3 20h18" />
      <path d="M4 16l5-5 4 3 7-8" />
    </Icone>
  ),
  feed: (
    <Icone>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.8-3.6 3.3-5.5 6.5-5.5s5.7 1.9 6.5 5.5" />
      <path d="M16 4.8a3.5 3.5 0 0 1 0 6.4M18.5 14.8c1.6.8 2.6 2.6 3 5.2" />
    </Icone>
  ),
  chat: (
    <Icone>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.8A8 8 0 1 1 21 12Z" />
    </Icone>
  ),
  alunos: (
    <Icone>
      <rect x="3" y="4" width="18" height="16" rx="1" />
      <path d="M7 9h10M7 13h10M7 17h6" />
    </Icone>
  ),
};

const SEPARADORES: Record<Papel, Separador[]> = {
  atleta: [
    { href: "/painel", etiqueta: "Início", icone: ICONE.inicio, ativoEm: ["/painel"] },
    { href: "/plano", etiqueta: "Plano", icone: ICONE.plano, ativoEm: ["/plano", "/treino"] },
    { href: "/progresso", etiqueta: "Progresso", icone: ICONE.progresso, ativoEm: ["/progresso", "/videos"] },
    { href: "/feed", etiqueta: "Feed", icone: ICONE.feed, ativoEm: ["/feed", "/descobrir", "/u"] },
    { href: "/chat", etiqueta: "Chat", icone: ICONE.chat, ativoEm: ["/chat"] },
  ],
  pt: [
    { href: "/painel", etiqueta: "Início", icone: ICONE.inicio, ativoEm: ["/painel"] },
    { href: "/pt/alunos", etiqueta: "Alunos", icone: ICONE.alunos, ativoEm: ["/pt/alunos", "/pt/aluno"] },
    { href: "/feed", etiqueta: "Feed", icone: ICONE.feed, ativoEm: ["/feed", "/descobrir", "/u"] },
    { href: "/chat", etiqueta: "Chat", icone: ICONE.chat, ativoEm: ["/chat"] },
  ],
};

// Ecrãs sem barra, por caminho: antes de haver conta/papel, e a montra de
// estilo. Os ecrãs IMERSIVOS (treino ao vivo, conversa de chat) escondem-na
// por CSS — `body:has(.apex-treino)`/`body:has(.apex-chat)` em design.css —
// porque o caminho sozinho não chega (ex.: /chat é a conversa para um
// atleta, mas uma lista de alunos para um PT com vários).
const SEM_BARRA = ["/entrar", "/registar", "/auth", "/onboarding", "/estilo"];

const corresponde = (caminho: string, prefixo: string) => caminho === prefixo || caminho.startsWith(prefixo + "/");

export function BarraNavegacaoCliente({ papel }: { papel: Papel }) {
  const caminho = usePathname() ?? "";
  if (caminho === "/" || SEM_BARRA.some((p) => corresponde(caminho, p))) return null;

  return (
    <>
      {/* Reserva o espaço da barra no fim do documento — sem isto, o
          último conteúdo de cada ecrã (e o rodapé) ficava tapado por ela. */}
      <div className="apex-nav-espaco" aria-hidden="true" />
      <nav className="apex-nav" aria-label="Navegação principal">
        <ul className="apex-nav__lista">
          {SEPARADORES[papel].map((s) => {
            const ativo = s.ativoEm.some((p) => corresponde(caminho, p));
            return (
              <li key={s.href} className="apex-nav__item">
                <Link
                  href={s.href}
                  className="apex-nav__link"
                  data-ativo={ativo ? "true" : undefined}
                  aria-current={ativo ? "page" : undefined}
                >
                  {s.icone}
                  <span className="apex-nav__etiqueta">{s.etiqueta}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
