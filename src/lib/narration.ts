import type { AbilityMap, SpeciesDetail, Variety } from '../data/types';
import { generationLabel, REGION_LABEL, STAT_SPOKEN, TYPE_LABEL } from './i18n';
import { OFFICIAL_CLASS_LABEL, RARITY_LABEL } from './rarity';

const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

const joinList = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;

const displayName = (species: SpeciesDetail, variety: Variety) => variety.label ?? species.name;

export const nameScript = (species: SpeciesDetail, variety: Variety) => displayName(species, variety);

/** Texto falado das características. Sem símbolos, números de ficha ou abreviações. */
export function characteristicsScript(
  species: SpeciesDetail,
  variety: Variety,
  abilities?: AbilityMap | null,
): string {
  const types = variety.types.map((t) => TYPE_LABEL[t]);
  const typeText = types.length > 1 ? `dos tipos ${joinList(types)}` : `do tipo ${types[0]}`;
  const parts = [
    `${displayName(species, variety)}, número ${species.id} da Pokédex nacional.`,
    species.genus ? `É um ${species.genus}, ${typeText}.` : `É um Pokémon ${typeText}.`,
    `Tem origem na região de ${REGION_LABEL[variety.region]}, na ${generationLabel(species.generation).replace('Geração', 'geração').replace(/ ([IVX]+)$/, ' $1')}.`,
    `Mede ${number.format(variety.height / 10)} metros e pesa ${number.format(variety.weight / 10)} quilos.`,
  ];

  const regular = variety.abilities.filter((a) => !a.hidden).map((a) => abilities?.[a.slug]?.name ?? a.slug);
  const hidden = variety.abilities.filter((a) => a.hidden).map((a) => abilities?.[a.slug]?.name ?? a.slug);
  if (regular.length) {
    parts.push(`${regular.length > 1 ? 'Habilidades' : 'Habilidade'}: ${joinList(regular)}.`);
  }
  if (hidden.length) parts.push(`Habilidade oculta: ${joinList(hidden)}.`);

  const stats = Object.entries(variety.stats).map(([key, value]) => `${STAT_SPOKEN[key] ?? key} ${value}`);
  parts.push(`Estatísticas base: ${stats.join(', ')}.`);
  parts.push(`Na nossa escala de raridade, é classificado como ${RARITY_LABEL[species.rarity]}.`);
  if (species.officialClass !== 'padrao') {
    parts.push(`Sua classificação oficial é ${OFFICIAL_CLASS_LABEL[species.officialClass]}.`);
  }
  return parts.join(' ');
}

/** A descrição traduzida, quando houver. Devolve também o idioma para escolher a voz certa. */
export function descriptionScript(species: SpeciesDetail): { text: string; lang: string } | null {
  if (species.description) return { text: species.description, lang: 'pt-BR' };
  if (species.descriptionEn) return { text: species.descriptionEn, lang: 'en-US' };
  return null;
}

/**
 * Limite de cada trecho falado: cerca de 11 segundos em velocidade normal. Fica abaixo dos
 * 15 segundos em que o Chrome no desktop corta vozes pela rede sem avisar. Trechos curtos
 * também limitam o que se perde quando o aparelho interrompe a fala.
 */
export const MAX_CHUNK_LENGTH = 150;

/**
 * Divide o texto em trechos, preferindo fim de frase, depois pausas e, em último caso,
 * espaços. O ponto só encerra frase antes de espaço: "4.600 pés" precisa continuar inteiro.
 */
export function splitForSpeech(text: string, maxLength = MAX_CHUNK_LENGTH): string[] {
  const sentences = text.trim().match(/\S.*?(?:[.!?…]+(?=\s|$)|$)/gs) ?? [];
  const pieces = sentences.flatMap((sentence) =>
    sentence.length <= maxLength
      ? [sentence]
      : sentence
          .split(/(?<=[,;:])\s+/)
          .flatMap((clause) => (clause.length <= maxLength ? [clause] : clause.split(/\s+/))),
  );

  const chunks: string[] = [];
  let current = '';
  for (const piece of pieces) {
    if (current && current.length + piece.length + 1 > maxLength) {
      chunks.push(current);
      current = piece;
    } else {
      current = current ? current + ' ' + piece : piece;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
