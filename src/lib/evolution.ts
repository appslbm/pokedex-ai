/** Tradução das condições de evolução e dos rótulos de forma para pt-BR. */

const ITEMS: Record<string, string> = {
  'fire-stone': 'Pedra do Fogo',
  'water-stone': 'Pedra da Água',
  'thunder-stone': 'Pedra do Trovão',
  'leaf-stone': 'Pedra da Folha',
  'moon-stone': 'Pedra da Lua',
  'sun-stone': 'Pedra do Sol',
  'shiny-stone': 'Pedra Brilhante',
  'dusk-stone': 'Pedra do Crepúsculo',
  'dawn-stone': 'Pedra da Alvorada',
  'ice-stone': 'Pedra de Gelo',
  'oval-stone': 'Pedra Oval',
  'kings-rock': 'Pedra do Rei',
  'metal-coat': 'Revestimento Metálico',
  'dragon-scale': 'Escama de Dragão',
  'up-grade': 'Melhoria',
  'dubious-disc': 'Disco Duvidoso',
  'razor-claw': 'Garra Afiada',
  'razor-fang': 'Presa Afiada',
  'deep-sea-tooth': 'Dente do Mar Profundo',
  'deep-sea-scale': 'Escama do Mar Profundo',
  'prism-scale': 'Escama Prismática',
  electirizer: 'Eletrizador',
  magmarizer: 'Magmatizador',
  protector: 'Protetor',
  'reaper-cloth': 'Tecido Ceifador',
  sachet: 'Sachê',
  'whipped-dream': 'Sonho Batido',
  'sweet-apple': 'Maçã Doce',
  'tart-apple': 'Maçã Azeda',
  'syrupy-apple': 'Maçã Xaroposa',
  'cracked-pot': 'Bule Rachado',
  'chipped-pot': 'Bule Lascado',
  'unremarkable-teacup': 'Xícara Comum',
  'masterpiece-teacup': 'Xícara Obra-Prima',
  'galarica-cuff': 'Pulseira de Galarica',
  'galarica-wreath': 'Coroa de Galarica',
  'black-augurite': 'Augurita Negra',
  'peat-block': 'Bloco de Turfa',
  'auspicious-armor': 'Armadura Auspiciosa',
  'malicious-armor': 'Armadura Maliciosa',
  'metal-alloy': 'Liga Metálica',
  'scroll-of-darkness': 'Pergaminho da Escuridão',
  'scroll-of-waters': 'Pergaminho das Águas',
  'leaders-crest': 'Brasão do Líder',
  'sweet-treat': 'Doce',
  strawberry: 'Doce de Morango',
};

const TYPES: Record<string, string> = {
  fairy: 'Fada',
  dark: 'Sombrio',
  fighting: 'Lutador',
};

const titleCase = (slug: string) =>
  slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const itemLabel = (slug: string) => ITEMS[slug] ?? titleCase(slug);

export interface RawEvolution {
  min_level: number | null;
  min_happiness: number | null;
  min_beauty: number | null;
  min_affection: number | null;
  time_of_day: string | null;
  needs_overworld_rain: boolean;
  turn_upside_down: boolean;
  relative_physical_stats: number | null;
  gender_id: number | null;
  trigger: { name: string } | null;
  item: { name: string } | null;
  heldItem: { name: string } | null;
  location: { name: string } | null;
  move: { name: string } | null;
  moveType: { name: string } | null;
}

const TIME: Record<string, string> = {
  day: 'de dia',
  night: 'à noite',
  dusk: 'ao anoitecer',
  'full-moon': 'na lua cheia',
};

/** Locais mudam a cada jogo: dizer "em local específico" é mais útil que repetir seis nomes. */
const LOCATION_MARKER = 'Em local específico';

/** Converte um registro de evolução em uma frase curta, por exemplo "Nível 16, à noite". */
export function describeEvolution(evo: RawEvolution): string | null {
  const parts: string[] = [];
  const trigger = evo.trigger?.name;

  if (trigger === 'use-item' && evo.item) parts.push(`Usar ${itemLabel(evo.item.name)}`);
  else if (trigger === 'trade') parts.push('Troca');
  else if (trigger === 'shed') parts.push('Vaga livre na equipe ao evoluir');
  else if (trigger === 'spin') parts.push('Girar o personagem');
  else if (trigger === 'tower-of-darkness') parts.push('Torre da Escuridão');
  else if (trigger === 'tower-of-waters') parts.push('Torre das Águas');
  else if (trigger === 'three-critical-hits') parts.push('3 golpes críticos em uma batalha');
  else if (trigger === 'take-damage') parts.push('Receber dano e passar por um local específico');
  else if (trigger === 'agile-style-move') parts.push('Usar golpe em estilo ágil');
  else if (trigger === 'strong-style-move') parts.push('Usar golpe em estilo forte');
  else if (trigger === 'recoil-damage') parts.push('Sofrer dano de recuo');

  if (evo.min_level) parts.push(`Nível ${evo.min_level}`);
  if (evo.min_happiness) parts.push('Alta amizade');
  if (evo.min_affection) parts.push('Alto afeto');
  if (evo.min_beauty) parts.push('Alta beleza');
  if (evo.heldItem) parts.push(`Segurando ${itemLabel(evo.heldItem.name)}`);
  if (trigger !== 'use-item' && evo.item) parts.push(`Com ${itemLabel(evo.item.name)}`);
  if (evo.move) parts.push(`Conhecendo ${titleCase(evo.move.name)}`);
  if (evo.moveType) parts.push(`Golpe do tipo ${TYPES[evo.moveType.name] ?? titleCase(evo.moveType.name)}`);
  if (evo.location) parts.push(LOCATION_MARKER);
  if (evo.time_of_day && TIME[evo.time_of_day]) parts.push(TIME[evo.time_of_day]);
  if (evo.needs_overworld_rain) parts.push('com chuva');
  if (evo.turn_upside_down) parts.push('console de cabeça para baixo');
  if (evo.relative_physical_stats === 1) parts.push('Ataque maior que Defesa');
  if (evo.relative_physical_stats === -1) parts.push('Defesa maior que Ataque');
  if (evo.relative_physical_stats === 0) parts.push('Ataque igual a Defesa');
  if (evo.gender_id === 1) parts.push('apenas fêmeas');
  if (evo.gender_id === 2) parts.push('apenas machos');

  if (parts.length === 0) return trigger === 'level-up' ? 'Subir de nível' : null;
  const text = parts.join(', ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const REGIONAL: Array<[RegExp, string]> = [
  [/\bAlolan\b/i, 'de Alola'],
  [/\bGalarian\b/i, 'de Galar'],
  [/\bHisuian\b/i, 'de Hisui'],
  [/\bPaldean\b/i, 'de Paldea'],
];

/** Formas com tradução conhecida. As demais mantêm o nome original, que é nome próprio. */
const FORM_TERMS: Record<string, string> = {
  Female: 'Fêmea', Male: 'Macho', Attack: 'Ataque', Defense: 'Defesa', Speed: 'Velocidade',
  Sunny: 'Sol', Rainy: 'Chuva', Snowy: 'Neve', Sandy: 'Areia', Trash: 'Lixo', Plant: 'Planta',
  Heat: 'Calor', Wash: 'Lavagem', Frost: 'Geada', Fan: 'Ventilador', Mow: 'Corte', Origin: 'Origem',
  Sky: 'Céu', Zen: 'Zen', Standard: 'Padrão', Black: 'Negro', White: 'Branco', Resolute: 'Resoluto',
  Pirouette: 'Pirueta', Blade: 'Lâmina', Small: 'Pequeno', Large: 'Grande', Super: 'Supertamanho',
  Complete: 'Completo', Unbound: 'Liberto', Midnight: 'Meia-Noite', Dusk: 'Crepúsculo', Dawn: 'Alvorada',
  School: 'Cardume', Busted: 'Disfarce Quebrado', 'Totem Busted': 'Totem, Disfarce Quebrado',
  'Totem Disguised': 'Totem', Noice: 'Sem Gelo', Hangry: 'Faminto', Crowned: 'Coroado',
  'Rapid Strike': 'Golpe Fluido', Dada: 'Papai', Ice: 'Gelo', Shadow: 'Sombra', Bloodmoon: 'Lua de Sangue',
  'Hero Form': 'Forma Heroica', 'Droopy Form': 'Caído', 'Stretchy Form': 'Esticado', 'Roaming Form': 'Andarilho',
  'Three-Segment Form': 'Três Segmentos', 'Terastal Form': 'Terastal', 'Stellar Form': 'Estelar',
  Gulping: 'Engolindo', Gorging: 'Devorando', 'Low Key': 'Grave', 'Own Tempo': 'Ritmo Próprio',
  'Blue-Striped': 'Listras Azuis', 'White-Striped': 'Listras Brancas', 'Battle Bond': 'Vínculo de Batalha',
  'Partner Cap': 'Boné de Parceiro', 'Original Cap': 'Boné Original', 'World Cap': 'Boné Mundial',
  'Hoenn Cap': 'Boné de Hoenn', 'Sinnoh Cap': 'Boné de Sinnoh', 'Unova Cap': 'Boné de Unova',
  'Kalos Cap': 'Boné de Kalos', 'Alola Cap': 'Boné de Alola', Partner: 'Parceiro',
  'Blue Plumage': 'Plumagem Azul', 'Yellow Plumage': 'Plumagem Amarela', 'White Plumage': 'Plumagem Branca',
  'Wellspring Mask': 'Máscara da Nascente', 'Hearthflame Mask': 'Máscara da Fornalha',
  'Cornerstone Mask': 'Máscara da Pedra Angular', 'Family of Three': 'Família de Três',
  'Limited Build': 'Forma Limitada', 'Sprinting Build': 'Forma de Corrida', 'Swimming Build': 'Forma de Nado',
  'Gliding Build': 'Forma de Planar', 'Low-Power Mode': 'Baixa Potência', 'Drive Mode': 'Modo Direção',
  'Aquatic Mode': 'Modo Aquático', 'Glide Mode': 'Modo Planar', 'Combat Breed': 'Raça Combate',
  'Blaze Breed': 'Raça Chama', 'Aqua Breed': 'Raça Água', 'Orange Meteor': 'Meteoro Laranja',
  'Yellow Meteor': 'Meteoro Amarelo', 'Green Meteor': 'Meteoro Verde', 'Blue Meteor': 'Meteoro Azul',
  'Indigo Meteor': 'Meteoro Índigo', 'Violet Meteor': 'Meteoro Violeta', 'Red Core': 'Núcleo Vermelho',
  'Orange Core': 'Núcleo Laranja', 'Yellow Core': 'Núcleo Amarelo', 'Green Core': 'Núcleo Verde',
  'Blue Core': 'Núcleo Azul', 'Indigo Core': 'Núcleo Índigo', 'Violet Core': 'Núcleo Violeta',
  Bug: 'Inseto', Dark: 'Sombrio', Dragon: 'Dragão', Electric: 'Elétrico', Fairy: 'Fada', Fighting: 'Lutador',
  Fire: 'Fogo', Flying: 'Voador', Ghost: 'Fantasma', Grass: 'Planta', Ground: 'Terrestre', Poison: 'Venenoso',
  Psychic: 'Psíquico', Rock: 'Pedra', Steel: 'Aço', Water: 'Água', Summer: 'Verão', Autumn: 'Outono',
  Winter: 'Inverno', East: 'Mar Leste', Sunshine: 'Ensolarado', 'Spiky-eared': 'Orelha Pontuda',
};

const translateForm = (qualifier: string) => FORM_TERMS[qualifier] ?? qualifier;
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Monta o nome de exibição de uma forma, por exemplo "Mega Charizard X", "Vulpix de Alola"
 * ou "Deoxys (Ataque)". A PokéAPI traz "Alolan Vulpix" e "Attack Deoxys" em `pokemon_name`.
 */
export function formLabel(
  formName: string | undefined,
  pokemonName: string | undefined,
  speciesName: string,
  slug: string,
): string | null {
  const source = (pokemonName || formName)?.replace(/\s+/g, ' ').trim();
  if (source) {
    for (const [pattern, suffix] of REGIONAL) {
      if (pattern.test(source)) {
        const rest = source.replace(pattern, '').replace(/\s*form\b/i, '').replace(/\s+/g, ' ').trim();
        const breed = rest.match(/\(([^)]+)\)/)?.[1];
        const base = rest.replace(/\s*\([^)]+\)/, '').trim() || speciesName;
        const prefix = base.match(/^(Totem|Zen)\s/)?.[1];
        const label = base.replace(/^(Totem|Standard|Zen)\s+/, '');
        const note = breed ? translateForm(breed) : prefix ? translateForm(prefix) : null;
        return `${label} ${suffix}${note ? ` (${note})` : ''}`;
      }
    }
    if (/^mega\b/i.test(source) || /\bgmax\b|gigantamax/i.test(source)) return source;
    const inParentheses = source.match(/\(([^)]+)\)/)?.[1];
    if (inParentheses) return `${speciesName} (${translateForm(inParentheses)})`;
    if (source.toLowerCase().includes(speciesName.toLowerCase())) {
      const qualifier = source
        .replace(new RegExp(escapeRegExp(speciesName), 'i'), '')
        .replace(/\s+/g, ' ')
        .trim();
      return qualifier ? `${speciesName} (${translateForm(qualifier)})` : speciesName;
    }
    return `${speciesName} (${translateForm(source.replace(/\s*Forme?$/i, '').trim())})`;
  }
  const suffix = titleCase(slug.replace(/^[^-]+-?/, ''));
  return suffix ? `${speciesName} (${suffix})` : null;
}
