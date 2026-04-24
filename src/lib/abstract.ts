/**
 * OpenAlex returns abstracts as an "inverted index" — a map of
 * word → [positions where that word appears].
 *
 * Example:
 *   { "Hello": [0], "world": [1, 4], "great": [2], "amazing": [3] }
 * reconstructs to:
 *   "Hello world great amazing world"
 *
 * This is cheap to re-hydrate (O(total words)) and surprisingly robust.
 * Reference: https://docs.openalex.org/api-entities/works/work-object#abstract_inverted_index
 */
export function reconstructAbstract(
  invertedIndex: Record<string, number[]> | null | undefined
): string | null {
  if (!invertedIndex) return null;
  const positions: { word: string; pos: number }[] = [];
  for (const [word, spots] of Object.entries(invertedIndex)) {
    for (const pos of spots) positions.push({ word, pos });
  }
  if (positions.length === 0) return null;
  positions.sort((a, b) => a.pos - b.pos);
  return positions.map(p => p.word).join(' ');
}
