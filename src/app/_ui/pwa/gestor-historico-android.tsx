"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { avancar, recuar } from "@/lib/pwa/pilha-historico";

const CHAVE_SESSAO = "apex:pwa-pilha";

function lerPilha(): string[] {
  try {
    const bruto = sessionStorage.getItem(CHAVE_SESSAO);
    return bruto ? (JSON.parse(bruto) as string[]) : [];
  } catch {
    return [];
  }
}

function gravarPilha(pilha: string[]) {
  try {
    sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(pilha));
  } catch {
    // sessionStorage indisponível (modo privado, quota) — sem pilha própria,
    // este ecrã fica inerte e o Android volta ao comportamento nativo dele.
  }
}

/**
 * Corrige o botão/gesto de SISTEMA do Android quando a app corre instalada
 * (standalone): sem isto, o botão de sistema às vezes fecha a app em vez de
 * andar para trás DENTRO dela. Os links "← Voltar" já existentes
 * (router.back()/Link) não têm este problema — só o botão do SISTEMA
 * precisa deste apoio.
 *
 * Desenho deliberadamente simples: NUNCA escreve no histórico nativo por
 * conta própria (nem pushState nem replaceState diretos) — só lê o que já
 * lá está e usa router.replace() para corrigir. Uma versão anterior
 * empurrava uma entrada extra "amortecedora" a cada navegação para garantir
 * sempre algo para o Android consumir; verificado ao vivo (Playwright, com
 * histórico real de navegação) que isso colide com a gestão interna de
 * histórico do App Router do Next — que também reage ao mesmo pushState — e
 * podia ressuscitar um ecrã antigo em vez de sair da app. Sem essa escrita
 * própria, cada navegação por Link já cria uma entrada nativa real e
 * "pop-ável" (confirmado nos mesmos testes), por isso não faz falta.
 *
 * A pilha lógica em sessionStorage é só para SABER qual é o ecrã anterior
 * certo quando um popstate acontece — nunca para forçar o histórico nativo
 * a ter uma forma específica.
 *
 * Só ativa em Android + standalone. No browser normal (qualquer telemóvel
 * ou desktop, instalado ou não) e no iOS (que nem tem botão físico de
 * recuar em modo standalone — usa o gesto de margem, que este componente
 * nunca toca), fica completamente inerte: os "← Voltar" já existentes na
 * app continuam a funcionar exatamente como antes, sem qualquer interceção.
 *
 * Sem animação nenhuma — é uma navegação normal do Next (router.replace),
 * por isso não há nada a respeitar de prefers-reduced-motion aqui.
 */
export function GestorHistoricoAndroid() {
  const pathname = usePathname();
  const router = useRouter();
  const ativo = useRef(false);
  // Fica true logo a seguir a UMA correção nossa (dentro de aoRecuar) — esse
  // caminho já grava a pilha ele próprio, por isso o efeito de baixo
  // ignora-se a si mesmo UMA vez, para não voltar a empilhar em cima do
  // ecrã de onde acabámos de recuar.
  const ignorarProximaNavegacao = useRef(false);

  useEffect(() => {
    ativo.current =
      window.matchMedia("(display-mode: standalone)").matches &&
      /Android/i.test(navigator.userAgent);
  }, []);

  // Mantém a pilha lógica atualizada a cada navegação real (por link, por
  // botão "← Voltar" existente, ou pela própria correção abaixo) — é a
  // única fonte de verdade para decidir o que o botão de sistema deve fazer.
  useEffect(() => {
    if (!ativo.current) return;
    if (ignorarProximaNavegacao.current) {
      ignorarProximaNavegacao.current = false;
      return;
    }
    gravarPilha(avancar(lerPilha(), pathname));
  }, [pathname]);

  // O evento popstate dispara tanto pelo botão/gesto de sistema do Android
  // como por router.back() (usado pelos "← Voltar" já existentes) — cobrir
  // os dois com a mesma lógica é o que garante que esta correção nunca
  // contradiz um botão "← Voltar" que já funciona, só reforça o resultado
  // certo quando o histórico nativo, sozinho, não chegava lá.
  useEffect(() => {
    function aoRecuar() {
      if (!ativo.current) return;
      const resultado = recuar(lerPilha());
      if (resultado === null) return; // já numa raiz (ou sem pilha própria) — deixa o Android sair da app
      gravarPilha(resultado.pilha);
      ignorarProximaNavegacao.current = true;
      router.replace(resultado.anterior);
    }
    window.addEventListener("popstate", aoRecuar);
    return () => window.removeEventListener("popstate", aoRecuar);
  }, [router]);

  return null;
}
