const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const percent = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

export const dexNumber = (id: number) => `#${String(id).padStart(4, '0')}`;
export const formatHeight = (decimeters: number) => `${decimal.format(decimeters / 10)} m`;
export const formatWeight = (hectograms: number) => `${decimal.format(hectograms / 10)} kg`;

export function formatGender(genderRate: number): string {
  if (genderRate < 0) return 'Sem gênero';
  const female = (genderRate / 8) * 100;
  return `${percent.format(100 - female)}% ♂ · ${percent.format(female)}% ♀`;
}

export const formatConfidence = (value: number) =>
  `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: value >= 0.995 ? 0 : 1 }).format(value * 100)}%`;
