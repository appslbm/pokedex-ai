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
 * Divide o texto em frases. O Chrome no Android interrompe falas longas sem aviso,
 * então cada trecho precisa ser curto.
 */
export function splitForSpeech(text: string, maxLength = 180): string[] {
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
  const chunks: string[] = [];
  let current = '';
  const push = () => {
    if (current) chunks.push(current);
    current = '';
  };
  for (const sentence of sentences) {
    if (sentence.length > maxLength) {
      push();
      let piece = '';
      for (const clause of sentence.split(/(?<=,)\s+/)) {
        if (piece && piece.length + clause.length + 1 > maxLength) {
          chunks.push(piece);
          piece = clause;
        } else {
          piece = piece ? `${piece} ${clause}` : clause;
        }
      }
      if (piece) chunks.push(piece);
    } else if (current && current.length + sentence.length + 1 > maxLength) {
      push();
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  push();
  return chunks;
}
