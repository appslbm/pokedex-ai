import { describeEvolution, formLabel, type RawEvolution } from '../../src/lib/evolution';
import { dexNumber, formatConfidence, formatGender, formatHeight, formatWeight } from '../../src/lib/format';
import { TYPE_NAMES } from '../../src/lib/i18n';
import { damageMultiplier, defensiveMatchups } from '../../src/lib/typeChart';

const evolution = (patch: Partial<RawEvolution>): RawEvolution => ({
  min_level: null,
  min_happiness: null,
  min_beauty: null,
  min_affection: null,
  time_of_day: null,
  needs_overworld_rain: false,
  turn_upside_down: false,
  relative_physical_stats: null,
  gender_id: null,
  trigger: { name: 'level-up' },
  item: null,
  heldItem: null,
  location: null,
  move: null,
  moveType: null,
  ...patch,
});

describe('tabela de tipos', () => {
  it('é coerente: 18 tipos e multiplicadores conhecidos', () => {
    expect(TYPE_NAMES).toHaveLength(18);
    expect(damageMultiplier('electric', ['ground'])).toBe(0);
    expect(damageMultiplier('fire', ['grass', 'steel'])).toBe(4);
  });

  it('calcula fraquezas de Charizard', () => {
    const { weak, immune } = defensiveMatchups(['fire', 'flying']);
    expect(weak[0]).toEqual({ type: 'rock', multiplier: 4 });
    expect(immune).toContain('ground');
  });
});

describe('evolução', () => {
  it('traduz condições comuns', () => {
    expect(describeEvolution(evolution({ min_level: 16 }))).toBe('Nível 16');
    expect(describeEvolution(evolution({ trigger: { name: 'use-item' }, item: { name: 'fire-stone' } }))).toBe('Usar Pedra do Fogo');
    expect(describeEvolution(evolution({ min_happiness: 160, time_of_day: 'night' }))).toBe('Alta amizade, à noite');
    expect(describeEvolution(evolution({ trigger: { name: 'trade' } }))).toBe('Troca');
  });
});

describe('formas', () => {
  it('traduz formas regionais e mantém Megas', () => {
    expect(formLabel('Alolan Form', 'Alolan Vulpix', 'Vulpix', 'vulpix-alola')).toBe('Vulpix de Alola');
    expect(formLabel('Mega Charizard X', 'Mega Charizard X', 'Charizard', 'charizard-mega-x')).toBe('Mega Charizard X');
  });
});

describe('formatação', () => {
  it('usa o padrão brasileiro', () => {
    expect(dexNumber(25)).toBe('#0025');
    expect(formatHeight(4)).toBe('0,4 m');
    expect(formatWeight(60)).toBe('6,0 kg');
    expect(formatGender(-1)).toBe('Sem gênero');
    expect(formatGender(1)).toContain('87,5% ♂');
    expect(formatConfidence(0.873)).toBe('87,3%');
  });
});
