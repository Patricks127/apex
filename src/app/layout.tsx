import type { Metadata, Viewport } from "next";
import { Archivo, Barlow_Condensed, Geist, Geist_Mono } from "next/font/google";
import { Rodape } from "./_ui/rodape";
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

export const metadata: Metadata = {
  title: "APEX",
  description: "Treino com acompanhamento PT e comunidade.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "APEX",
    statusBarStyle: "default",
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
      </body>
    </html>
  );
}
