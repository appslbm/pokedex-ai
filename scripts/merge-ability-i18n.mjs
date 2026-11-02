#!/usr/bin/env node
/**
 * Junta os efeitos de habilidade traduzidos à mão (data/i18n/abilities-source.txt) ao
 * dicionário principal. O arquivo tem uma linha por efeito único, na ordem em que aparecem
 * em public/data/abilities.json. Tradução automática erra demais em frases tão curtas.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const abilities = JSON.parse(readFileSync('public/data/abilities.json', 'utf8'));
const lines = readFileSync('data/i18n/abilities-source.txt', 'utf8').split(/\r?\n/).filter(Boolean);
const effects = [...new Set(Object.values(abilities).map((a) => a.effectEn).filter(Boolean))];

if (effects.length !== lines.length) {
  throw new Error(`Esperava ${effects.length} linhas e encontrei ${lines.length}. Verifique a ordem.`);
}

const file = 'data/i18n/pt-BR.json';
const dictionary = JSON.parse(readFileSync(file, 'utf8'));
effects.forEach((effect, index) => {
  dictionary[effect] = lines[index];
});
const sorted = Object.fromEntries(Object.entries(dictionary).sort(([a], [b]) => (a < b ? -1 : 1)));
writeFileSync(file, JSON.stringify(sorted, null, 0));
console.log(`Efeitos de habilidade atualizados: ${effects.length}`);
