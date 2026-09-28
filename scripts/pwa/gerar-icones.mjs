// Gera os PNG da PWA a partir de SVG, com o Chromium (sem fontes: o "A" é uma forma).
// Uso: node scripts/pwa/gerar-icones.mjs public   (precisa do playwright-core e de um Chromium;
//      CHROMIUM_PATH=<caminho do Chromium>)
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

// "A" angular e pesado (como a Archivo 900 da marca), numa grelha de 512.
// Pernas paralelas (declive 124/320), topo plano, contra-forma triangular.
const A = "M216 96 H296 L420 416 H338 L310 344 H202 L174 416 H92 Z M222 292 H290 L256 204 Z";

const icone = (tam, { escala = 1, fundo = "#0a0a0b", cantos = 0 } = {}) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${tam}" height="${tam}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${cantos}" fill="${fundo}"/>
  <g transform="translate(256 256) scale(${escala}) translate(-256 -256)">
    <path d="${A}" fill="#ffffff" fill-rule="evenodd"/>
  </g>
</svg>`;

// Ecrã de arranque: fundo branco (a app é clara — sem clarão ao abrir) e o
// ícone da marca ao centro, a ~22% da largura.
const arranque = (w, h) => {
  const lado = Math.round(w * 0.22);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="#ffffff"/>
  <svg x="${(w - lado) / 2}" y="${(h - lado) / 2}" width="${lado}" height="${lado}" viewBox="0 0 512 512">
    <rect width="512" height="512" rx="0" fill="#0a0a0b"/>
    <path d="${A}" fill="#ffffff" fill-rule="evenodd"/>
  </svg></svg>`;
};

const SAIDA = process.argv[2];
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const p = await b.newPage();
async function png(svg, w, h, ficheiro) {
  await p.setViewportSize({ width: w, height: h });
  await p.setContent(`<html><body style="margin:0">${svg}</body></html>`);
  await p.screenshot({ path: ficheiro, clip: { x: 0, y: 0, width: w, height: h } });
}

mkdirSync(`${SAIDA}/icons`, { recursive: true });
mkdirSync(`${SAIDA}/splash`, { recursive: true });
await png(icone(180), 180, 180, `${SAIDA}/icons/apple-touch-icon.png`);
await png(icone(192), 192, 192, `${SAIDA}/icons/icon-192.png`);
await png(icone(512), 512, 512, `${SAIDA}/icons/icon-512.png`);
// maskable (Android): o "A" dentro da zona segura (círculo de 80%)
await png(icone(512, { escala: 0.72 }), 512, 512, `${SAIDA}/icons/icon-maskable-512.png`);
await png(icone(32), 32, 32, `${SAIDA}/icons/favicon-32.png`);

// iPhones (retrato): largura × altura em px de ecrã
const ECRAS = [
  [640, 1136], [750, 1334], [1242, 2208], [1125, 2436], [828, 1792], [1242, 2688],
  [1170, 2532], [1284, 2778], [1179, 2556], [1290, 2796], [1206, 2622], [1320, 2868],
];
for (const [w, h] of ECRAS) await png(arranque(w, h), w, h, `${SAIDA}/splash/arranque-${w}x${h}.png`);
await b.close();
console.log("ok");
