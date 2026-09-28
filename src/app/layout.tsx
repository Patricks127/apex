import type { Metadata, Viewport } from "next";
import { Archivo, Barlow_Condensed, Geist, Geist_Mono } from "next/font/google";
import { Rodape } from "./_ui/rodape";
import { BarraNavegacao } from "./_ui/navegacao/barra-navegacao";
import { GestorHistoricoAndroid } from "./_ui/pwa/gestor-historico-android";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Sistema de design (fase 1) — corpo/títulos em Archivo, números grandes do
// modo treino em Barlow Condensed. Só expõem CSS custom properties
// (--font-archivo/--font-barlow-condensed); nenhum ecrã existente as usa
// ainda, por isso carregá-las aqui não muda nada do que já está construído.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["600", "700"],
});

// iPhones em retrato: largura × altura em pontos (CSS px) e densidade.
const ECRAS_ARRANQUE: [number, number, number][] = [
  [320, 568, 2], // SE (1.ª geração)
  [375, 667, 2], // SE (2.ª/3.ª), 6/7/8
  [414, 736, 3], // 6/7/8 Plus
  [375, 812, 3], // X, XS, 11 Pro, 12/13 mini
  [414, 896, 2], // XR, 11
  [414, 896, 3], // XS Max, 11 Pro Max
  [390, 844, 3], // 12, 13, 14
  [428, 926, 3], // 12/13 Pro Max, 14 Plus
  [393, 852, 3], // 14 Pro, 15, 15 Pro, 16
  [430, 932, 3], // 14 Pro Max, 15 Plus/Pro Max, 16 Plus
  [402, 874, 3], // 16 Pro
  [440, 956, 3], // 16 Pro Max
];

export const metadata: Metadata = {
  title: "APEX",
  description: "Treino com acompanhamento PT e comunidade.",
  manifest: "/manifest.json",
  icons: {
    // o "A" da APEX também no separador do browser (o favicon.ico era o de
    // origem do Next.js — removido)
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "APEX",
    // "default": barra de estado clara com texto escuro — a app é clara.
    // ("black-translucent" poria a hora/bateria a BRANCO em todos os ecrãs,
    // invisível sobre os ecrãs claros.)
    statusBarStyle: "default",
    // Ecrã de arranque da app instalada no iPhone: o iOS NÃO o gera a partir
    // do manifest — sem isto, abre num ecrã vazio. Branco com o ícone da
    // marca ao centro (a app é branca: sem clarão na passagem). Um por
    // tamanho de ecrã; gerados por scripts/pwa/gerar-icones.mjs.
    startupImage: ECRAS_ARRANQUE.map(([w, h, dpr]) => ({
      url: `/splash/arranque-${w * dpr}x${h * dpr}.png`,
      media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`,
    })),
  },
  // `appleWebApp.capable` só gera "mobile-web-app-capable" — o Safari mais
  // antigo (antes do iOS 17.4) só reconhece o nome "apple-" prefixado, por
  // isso o par de tags aqui, à mão.
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  colorScheme: "light",
  // Sem isto, env(safe-area-inset-*) resolve sempre a 0 no iOS — mesmo com
  // notch/Dynamic Island/barra de gestos, o WebKit só reserva espaço real
  // para eles quando a página pede para desenhar por baixo (viewport-fit
  // cover). Necessário para a PWA instalada no iOS (standalone, sem chrome
  // do Safari) respeitar as safe areas.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-PT"
      className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable} ${barlowCondensed.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <GestorHistoricoAndroid />
        <div className="flex flex-1 flex-col">{children}</div>
        <Rodape />
        <BarraNavegacao />
      </body>
    </html>
  );
}
