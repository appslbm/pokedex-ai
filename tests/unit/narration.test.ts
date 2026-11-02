import { readFileSync } from 'node:fs';
import type { SpeciesDetail } from '../../src/data/types';
import { characteristicsScript, descriptionScript, nameScript, splitForSpeech } from '../../src/lib/narration';
import { pickVoice } from '../../src/lib/speech';

const pikachu = JSON.parse(readFileSync('public/data/species/25.json', 'utf8')) as SpeciesDetail;
const variety = pikachu.varieties[0];

describe('narração', () => {
  it('fala o nome', () => {
    expect(nameScript(pikachu, variety)).toBe('Pikachu');
  });

  it('descreve em português, por extenso e sem símbolos', () => {
    const text = characteristicsScript(pikachu, variety);
    expect(text).toContain('número 25');
    expect(text).toContain('tipo Elétrico');
    expect(text).toContain('região de Kanto');
    expect(text).toContain('0,4 metros');
    expect(text).toContain('pontos de saúde');
    expect(text).not.toMatch(/[#_]/);
    expect(text).not.toContain('undefined');
  });

  it('menciona a classificação oficial só quando existe', () => {
    const mew = JSON.parse(readFileSync('public/data/species/151.json', 'utf8')) as SpeciesDetail;
    expect(characteristicsScript(mew, mew.varieties[0])).toContain('classificação oficial é Mítico');
    expect(characteristicsScript(pikachu, variety)).not.toContain('classificação oficial');
  });

  it('prefere a descrição em português', () => {
    expect(descriptionScript(pikachu)?.lang).toBe('pt-BR');
    expect(descriptionScript({ ...pikachu, description: null })?.lang).toBe('en-US');
  });

  it('divide textos longos sem perder conteúdo', () => {
    const longSentence = `Uma frase, que é bem longa, ${'continua, '.repeat(16)}e termina aqui.`;
    const text = 'Primeira frase curta. '.repeat(30) + longSentence;
    const chunks = splitForSpeech(text, 120);
    expect(chunks.every((c) => c.length <= 120)).toBe(true);
    expect(chunks.join(' ').replace(/\s+/g, ' ')).toBe(text.trim().replace(/\s+/g, ' '));
  });

  it('todas as espécies têm categoria e descrição em português', () => {
    for (let id = 1; id <= 1025; id++) {
      const species = JSON.parse(readFileSync(`public/data/species/${id}.json`, 'utf8')) as SpeciesDetail;
      if (species.genusEn) expect(species.genus).toMatch(/^Pokémon /);
      if (species.descriptionEn) expect(species.description).toBeTruthy();
    }
  });
});

describe('escolha de voz', () => {
  const voice = (name: string, lang: string, localService = true) =>
    ({ name, lang, localService, voiceURI: name }) as SpeechSynthesisVoice;
  const voices = [
    voice('English', 'en-US'),
    voice('Portugal', 'pt-PT'),
    voice('Maria', 'pt-BR'),
    voice('Google português do Brasil', 'pt-BR', false),
  ];

  it('prefere pt-BR de melhor qualidade', () => {
    expect(pickVoice(voices, 'pt-BR')?.name).toBe('Google português do Brasil');
  });

  it('aceita a escolha do usuário', () => {
    expect(pickVoice(voices, 'pt-BR', 'Maria')?.name).toBe('Maria');
  });

  it('usa outra variante do idioma se faltar pt-BR', () => {
    expect(pickVoice([voices[0], voices[1]], 'pt-BR')?.name).toBe('Portugal');
  });

  it('retorna nulo se não houver voz no idioma', () => {
    expect(pickVoice([voices[0]], 'pt-BR')).toBeNull();
  });
});
