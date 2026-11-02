#!/usr/bin/env node
/**
 * Gera os dados estáticos da aplicação a partir da PokéAPI (GraphQL).
 *
 *   public/data/index.json          catálogo enxuto (busca e filtros, sem rede)
 *   public/data/species/<id>.json   ficha completa de cada espécie
 *   public/data/abilities.json      habilidades
 *   public/img/thumb/<id>.webp      miniaturas leves para a grade
 *
 * A resposta bruta fica em .cache/ para repetir o processo sem sobrecarregar a API,
 * que é gratuita e mantida por voluntários. Use --refresh para buscar tudo de novo.
 *
 * Os textos em inglês são traduzidos à parte (ml/scripts/translate.py) e guardados em
 * data/i18n/pt-BR.json. Este script só aplica o que já foi traduzido.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { classifyOfficial, classifyRarity, rarityScore } from '../src/lib/rarity.ts';
import { describeEvolution, formLabel } from '../src/lib/evolution.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, '.cache');
const OUT = path.join(ROOT, 'public', 'data');
const THUMBS = path.join(ROOT, 'public', 'img', 'thumb');
const ART_CACHE = path.join(CACHE, 'art');
const I18N_FILE = path.join(ROOT, 'data', 'i18n', 'pt-BR.json');
const STRINGS_FILE = path.join(ROOT, 'data', 'i18n', 'strings-en.json');
// O endpoint antigo (beta.pokeapi.co/graphql/v1beta) está defasado: faltam as Megas de Legends Z-A.
const ENDPOINT = 'https://graphql.pokeapi.co/v1beta2';
const SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/';
const LOCAL_SPRITES = path.join(ROOT, 'ml', '.work', 'src', 'sprites', 'sprites');
const EN = 9;
const REFRESH = process.argv.includes('--refresh');
const THUMB_SIZE = 192;

const SPECIES_QUERY = /* GraphQL */ `
  query Species($offset: Int!, $limit: Int!) {
    pokemonspecies(order_by: { id: asc }, offset: $offset, limit: $limit) {
      id name generation_id capture_rate base_happiness is_legendary is_mythical is_baby
      hatch_counter gender_rate evolution_chain_id evolves_from_species_id
      pokemoncolor { name }
      pokemonhabitat { name }
      growthrate { name }
      names: pokemonspeciesnames(where: { language_id: { _eq: ${EN} } }) { name genus }
      japanese: pokemonspeciesnames(where: { language_id: { _eq: 11 } }) { name }
      flavor: pokemonspeciesflavortexts(
        where: { language_id: { _eq: ${EN} } }, order_by: { version_id: desc }
      ) { flavor_text version_id }
      evolutions: pokemonevolutions {
        min_level min_happiness min_beauty min_affection time_of_day needs_overworld_rain
        turn_upside_down relative_physical_stats gender_id
        trigger: evolutiontrigger { name }
        item { name }
        heldItem: ItemByHeldItemId { name }
        location { name }
        move { name }
        moveType: type { name }
      }
      pokemon: pokemons(order_by: { id: asc }) {
        id name is_default height weight base_experience
        types: pokemontypes(order_by: { slot: asc }) { type { name } }
        abilities: pokemonabilities(order_by: { slot: asc }) { is_hidden ability { name } }
        stats: pokemonstats(order_by: { stat_id: asc }) { base_stat stat { name } }
        sprites: pokemonsprites { sprites }
        forms: pokemonforms(order_by: { id: asc }) {
          id name form_name is_default is_mega is_battle_only
          names: pokemonformnames(where: { language_id: { _eq: ${EN} } }) { name pokemon_name }
          sprites: pokemonformsprites { sprites }
        }
      }
    }
  }
`;

const ABILITY_QUERY = /* GraphQL */ `
  query Abilities {
    ability(where: { is_main_series: { _eq: true } }, order_by: { id: asc }) {
      name
      names: abilitynames(where: { language_id: { _eq: ${EN} } }) { name }
      effects: abilityeffecttexts(where: { language_id: { _eq: ${EN} } }) { short_effect }
      flavor: abilityflavortexts(
        where: { language_id: { _eq: ${EN} } }, order_by: { version_group_id: desc }, limit: 1
      ) { flavor_text }
    }
  }
`;

async function gql(query, variables = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.errors) throw new Error(JSON.stringify(json.errors).slice(0, 500));
      return json.data;
    } catch (error) {
      if (attempt >= 5) throw error;
      console.warn(`  tentativa ${attempt} falhou: ${error.message}`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

async function fetchRaw() {
  const file = path.join(CACHE, 'pokeapi-raw.json');
  if (!REFRESH && existsSync(file)) {
    console.log('Usando cache de .cache/pokeapi-raw.json');
    return JSON.parse(await readFile(file, 'utf8'));
  }
  await mkdir(CACHE, { recursive: true });
  const species = [];
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const data = await gql(SPECIES_QUERY, { offset, limit });
    const page = data.pokemonspecies;
    species.push(...page);
    console.log(`  espécies: ${species.length}`);
    if (page.length < limit) break;
  }
  const { ability: abilities } = await gql(ABILITY_QUERY);
  const raw = { fetchedAt: new Date().toISOString(), species, abilities };
  await writeFile(file, JSON.stringify(raw));
  return raw;
}

/** A PokéAPI usa caracteres de controle e quebras do layout dos jogos antigos. */
export const cleanText = (text) =>
  text
    .replace(/[­]\s*/g, '')
    .replace(/[\f\n\r\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/POKéMON/g, 'Pokémon')
    .replace(/\bPOKé BALL/g, 'Poké Ball')
    .trim();

const parseSprites = (value) => (typeof value === 'string' ? JSON.parse(value) : value);
const stripBase = (url) => (url?.startsWith(SPRITE_BASE) ? url.slice(SPRITE_BASE.length) : null);

function artFrom(sprites) {
  const o = sprites?.other ?? {};
  const art = o['official-artwork'] ?? {};
  const home = o.home ?? {};
  return {
    art: stripBase(art.front_default) ?? stripBase(home.front_default) ?? stripBase(sprites?.front_default),
    artShiny: stripBase(art.front_shiny) ?? stripBase(home.front_shiny) ?? stripBase(sprites?.front_shiny),
    home: stripBase(home.front_default),
    homeShiny: stripBase(home.front_shiny),
    sprite: stripBase(sprites?.front_default),
    spriteShiny: stripBase(sprites?.front_shiny),
  };
}

function regionOf(generationId, speciesId, slug) {
  if (/-alola/.test(slug)) return 'alola';
  if (/-galar/.test(slug)) return 'galar';
  if (/-hisui/.test(slug)) return 'hisui';
  if (/-paldea/.test(slug)) return 'paldea';
  // Espécies de Legends: Arceus constam como Geração VIII, mas nasceram em Hisui.
  if (speciesId >= 899 && speciesId <= 905) return 'hisui';
  return ['kanto', 'johto', 'hoenn', 'sinnoh', 'unova', 'kalos', 'alola', 'galar', 'paldea'][generationId - 1];
}

/** Texto mais recente e legível: evita entradas muito curtas ou todas em maiúsculas. */
function pickFlavor(entries) {
  const clean = entries.map((f) => cleanText(f.flavor_text)).filter((t) => t.length >= 20);
  return clean.find((t) => t !== t.toUpperCase()) ?? clean[0] ?? null;
}

function buildChain(chainMembers) {
  const byId = new Map(chainMembers.map((s) => [s.id, s]));
  const node = (s) => {
    const defaultPokemon = s.pokemon.find((p) => p.is_default) ?? s.pokemon[0];
    return {
      id: s.id,
      name: s.names[0]?.name ?? s.name,
      types: defaultPokemon.types.map((t) => t.type.name),
      thumb: defaultPokemon.id,
      // A mesma condição pode se repetir por versão do jogo.
      conditions: [...new Set(s.evolutions.map(describeEvolution).filter(Boolean))],
      evolvesTo: chainMembers.filter((c) => c.evolves_from_species_id === s.id).map(node),
    };
  };
  const root = chainMembers.find((s) => !byId.has(s.evolves_from_species_id));
  return root ? node(root) : null;
}

async function loadTranslations() {
  if (!existsSync(I18N_FILE)) return {};
  return JSON.parse(await readFile(I18N_FILE, 'utf8'));
}

async function readArt(relPath) {
  const local = path.join(LOCAL_SPRITES, relPath);
  if (existsSync(local)) return readFile(local);
  const cached = path.join(ART_CACHE, createHash('sha1').update(relPath).digest('hex'));
  if (existsSync(cached)) return readFile(cached);
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(SPRITE_BASE + relPath).catch(() => null);
    if (res?.ok) {
      const buffer = Buffer.from(await res.arrayBuffer());
      await mkdir(ART_CACHE, { recursive: true });
      await writeFile(cached, buffer);
      return buffer;
    }
    await new Promise((r) => setTimeout(r, 800 * attempt));
  }
  return null;
}

async function generateThumbs(entries) {
  await mkdir(THUMBS, { recursive: true });
  const existing = new Set(await readdir(THUMBS));
  const pending = entries.filter((e) => e.artPath && !existing.has(`${e.id}.webp`));
  console.log(`Miniaturas: ${existing.size} prontas, ${pending.length} a gerar`);
  const missing = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: 12 }, async () => {
      while (cursor < pending.length) {
        const entry = pending[cursor++];
        const buffer = await readArt(entry.artPath);
        if (!buffer) {
          missing.push(entry.id);
          continue;
        }
        await sharp(buffer)
          .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .webp({ quality: 72, alphaQuality: 80, effort: 5 })
          .toFile(path.join(THUMBS, `${entry.id}.webp`));
      }
    }),
  );
  if (missing.length) console.warn(`Sem imagem para: ${missing.join(', ')}`);
}

async function main() {
  const raw = await fetchRaw();
  const translations = await loadTranslations();
  const toPt = (text) => (text ? (translations[text] ?? null) : null);
  const englishStrings = new Set();
  const track = (text) => {
    if (text) englishStrings.add(text);
    return text;
  };

  await rm(path.join(OUT, 'species'), { recursive: true, force: true });
  await mkdir(path.join(OUT, 'species'), { recursive: true });

  const chains = new Map();
  for (const s of raw.species) {
    if (!chains.has(s.evolution_chain_id)) chains.set(s.evolution_chain_id, []);
    chains.get(s.evolution_chain_id).push(s);
  }

  const index = [];
  const thumbEntries = [];

  for (const s of raw.species) {
    const generation = s.generation_id;
    const name = s.names[0]?.name ?? s.name;
    const defaultPokemon = s.pokemon.find((p) => p.is_default) ?? s.pokemon[0];
    const totalOf = (p) => p.stats.reduce((sum, st) => sum + st.base_stat, 0);
    const baseStatTotal = totalOf(defaultPokemon);
    const flags = { isLegendary: s.is_legendary, isMythical: s.is_mythical, isBaby: s.is_baby };
    const rarityInput = {
      captureRate: s.capture_rate ?? 45,
      baseStatTotal,
      hatchCounter: s.hatch_counter,
      ...flags,
    };
    const rarity = classifyRarity(rarityInput);
    const officialClass = classifyOfficial(s.id, flags);
    const description = pickFlavor(s.flavor);
    const genus = s.names[0]?.genus ?? null;
    track(description);
    track(genus);

    const varieties = s.pokemon.map((p) => {
      const images = artFrom(parseSprites(p.sprites[0]?.sprites));
      // Algumas formas (Koraidon, Miraidon) não têm arte própria: usa a da forma padrão.
      if (!images.art) {
        const fallback = artFrom(parseSprites(defaultPokemon.sprites[0]?.sprites));
        images.art = fallback.art;
        images.artShiny = images.artShiny ?? fallback.artShiny;
      }
      const mainForm = p.forms[0];
      const formNames = mainForm?.names[0];
      const label = p.is_default ? null : formLabel(formNames?.name, formNames?.pokemon_name, name, p.name);
      const region = regionOf(generation, s.id, p.name);
      thumbEntries.push({ id: p.id, artPath: images.art });
      index.push({
        id: p.id,
        sid: s.id,
        slug: p.name,
        name: label ?? name,
        types: p.types.map((t) => t.type.name),
        gen: generation,
        region,
        rarity,
        bst: totalOf(p),
        form: !p.is_default,
        art: images.art,
      });
      return {
        id: p.id,
        slug: p.name,
        isDefault: p.is_default,
        label,
        region,
        isMega: Boolean(mainForm?.is_mega),
        isBattleOnly: Boolean(mainForm?.is_battle_only),
        height: p.height,
        weight: p.weight,
        baseExperience: p.base_experience,
        types: p.types.map((t) => t.type.name),
        abilities: p.abilities.map((a) => ({ slug: a.ability.name, hidden: a.is_hidden })),
        stats: Object.fromEntries(p.stats.map((st) => [st.stat.name, st.base_stat])),
        images,
        // Formas cosméticas (Unown, Vivillon…) existem só na tabela de formas.
        cosmetic: p.forms
          .filter((f) => !f.is_default && f.form_name)
          .map((f) => ({
            id: f.id,
            name: formLabel(f.names[0]?.name, f.names[0]?.pokemon_name, name, f.name) ?? f.form_name,
            sprite: stripBase(parseSprites(f.sprites[0]?.sprites)?.front_default),
            spriteShiny: stripBase(parseSprites(f.sprites[0]?.sprites)?.front_shiny),
          })),
      };
    });

    // Formas distintas podem ter o mesmo nome na API (Mega Meowstic macho e fêmea, por exemplo).
    const seen = new Map();
    for (const variety of varieties) {
      if (!variety.label) continue;
      const count = seen.get(variety.label) ?? 0;
      seen.set(variety.label, count + 1);
      if (count > 0) {
        const hint = /female/.test(variety.slug) ? 'Fêmea' : /power-construct/.test(variety.slug) ? 'Agrupamento' : `${count + 1}`;
        variety.label = `${variety.label} (${hint})`;
        const entry = index.find((e) => e.id === variety.id);
        if (entry) entry.name = variety.label;
      }
    }

    const detail = {
      id: s.id,
      slug: s.name,
      name,
      japaneseName: s.japanese[0]?.name ?? null,
      genus: toPt(genus) ?? genus,
      genusEn: genus,
      description: toPt(description),
      descriptionEn: description,
      generation,
      region: regionOf(generation, s.id, s.name),
      habitat: s.pokemonhabitat?.name ?? null,
      color: s.pokemoncolor?.name ?? null,
      growthRate: s.growthrate?.name ?? null,
      captureRate: s.capture_rate,
      baseHappiness: s.base_happiness,
      genderRate: s.gender_rate,
      hatchCounter: s.hatch_counter,
      isLegendary: s.is_legendary,
      isMythical: s.is_mythical,
      isBaby: s.is_baby,
      rarity,
      rarityScore: rarityScore(rarityInput),
      officialClass,
      evolution: buildChain(chains.get(s.evolution_chain_id)),
      varieties,
    };
    await writeFile(path.join(OUT, 'species', `${s.id}.json`), JSON.stringify(detail));
  }

  const abilities = {};
  for (const a of raw.abilities) {
    const effect = cleanText(a.effects[0]?.short_effect ?? a.flavor[0]?.flavor_text ?? '') || null;
    track(effect);
    abilities[a.name] = { name: a.names[0]?.name ?? a.name, effect: toPt(effect), effectEn: effect };
  }

  await writeFile(path.join(OUT, 'abilities.json'), JSON.stringify(abilities));
  await writeFile(
    path.join(OUT, 'index.json'),
    JSON.stringify({ generatedAt: raw.fetchedAt, entries: index.map(({ art, ...rest }) => rest) }),
  );
  await mkdir(path.dirname(STRINGS_FILE), { recursive: true });
  await writeFile(STRINGS_FILE, JSON.stringify([...englishStrings].sort(), null, 0));

  await generateThumbs(thumbEntries);

  const counts = {};
  for (const e of index) if (!e.form) counts[e.rarity] = (counts[e.rarity] ?? 0) + 1;
  const translated = [...englishStrings].filter((t) => translations[t]).length;
  console.log(`Espécies: ${raw.species.length} | registros: ${index.length} | habilidades: ${raw.abilities.length}`);
  console.log(`Raridade:`, counts);
  console.log(`Textos traduzidos: ${translated}/${englishStrings.size}`);
}

await main();
