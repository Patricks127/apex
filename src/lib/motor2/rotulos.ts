// Nomes legíveis dos músculos do motor v2 — sem dependências de propósito
// (só um tipo), para poder ser usado no cliente (src/lib/formato.ts, treino
// ao vivo) sem levar o motor atrás. Reexportado por plano.ts.
import type { Musculo } from "./tipos.ts";

export const MUSCULO_LABEL: Record<Musculo, string> = {
  peito: "Peito",
  dorsais: "Costas",
  trapezio_medio: "Trapézio médio",
  trapezio_superior: "Trapézio superior",
  deltoide_anterior: "Deltoide anterior",
  deltoide_lateral: "Deltoide lateral",
  deltoide_posterior: "Deltoide posterior",
  biceps: "Bíceps",
  triceps: "Tríceps",
  antebraco: "Antebraço",
  quadriceps: "Quadríceps",
  isquiotibiais: "Isquiotibiais",
  gluteo: "Glúteo",
  adutores: "Adutores",
  gemeos: "Gémeos",
  lombar: "Lombar",
  core: "Core",
  cardio: "Cardio",
};
