import type { Metadata } from "next";
import { Archivo, Barlow_Condensed, Geist, Geist_Mono } from "next/font/google";
import { Rodape } from "./_ui/rodape";
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
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-PT"
      className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable} ${barlowCondensed.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="flex flex-1 flex-col">{children}</div>
        <Rodape />
      </body>
    </html>
  );
}
