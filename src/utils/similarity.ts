// Dice coefficient for string similarity (bigram overlap). Returns 0–1.
export function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const aBigrams = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const bigram = a.substring(i, i + 2).toLowerCase();
    aBigrams.set(bigram, (aBigrams.get(bigram) ?? 0) + 1);
  }

  let intersectionSize = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bigram = b.substring(i, i + 2).toLowerCase();
    const count = aBigrams.get(bigram) ?? 0;
    if (count > 0) {
      aBigrams.set(bigram, count - 1);
      intersectionSize++;
    }
  }

  return (2 * intersectionSize) / (a.length + b.length - 2);
}
