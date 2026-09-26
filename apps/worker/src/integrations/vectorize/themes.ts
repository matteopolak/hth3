export const THEME_EMBEDDING_DIMENSIONS = 768;

export interface ThemeVectorIndex {
  upsert(
    vectors: Array<{
      id: string;
      namespace: string;
      values: number[];
      metadata: { submissionId: string };
    }>,
  ): Promise<unknown>;
  query(
    values: number[],
    options: {
      namespace: string;
      topK: number;
      returnValues: false;
      returnMetadata: "none";
    },
  ): Promise<{ matches: Array<{ id: string; score: number }> }>;
}

export interface EmbeddedSubmission {
  id: string;
  categoryId: string;
  values: number[];
}

export interface CandidatePair {
  firstId: string;
  secondId: string;
  score: number;
}

// The index is a derived, private candidate store. D1 remains authoritative.
export async function findThemeCandidates(
  index: ThemeVectorIndex,
  organizationId: string,
  submissions: EmbeddedSubmission[],
): Promise<CandidatePair[]> {
  for (const row of submissions) validateVector(row.values);
  const namespaceFor = (categoryId: string) =>
    `${organizationId.slice(0, 40)}:${hashCategory(categoryId)}`;
  await index.upsert(
    submissions.map((row) => ({
      id: row.id,
      namespace: namespaceFor(row.categoryId),
      values: row.values,
      metadata: { submissionId: row.id },
    })),
  );

  const available = new Map(submissions.map((row) => [row.id, row]));
  const candidates = new Map<string, CandidatePair>();
  for (const row of submissions) {
    const result = await index.query(row.values, {
      namespace: namespaceFor(row.categoryId),
      topK: 8,
      returnValues: false,
      returnMetadata: "none",
    });
    for (const match of result.matches ?? []) {
      const other = available.get(match.id);
      if (!other || other.id === row.id || other.categoryId !== row.categoryId)
        continue;
      const score = cosine(row.values, other.values);
      addPair(candidates, row.id, other.id, score);
    }
  }

  // Vectorize upserts are eventually queryable. The bounded current batch is
  // compared locally so a first refresh still finds candidates.
  for (let i = 0; i < submissions.length; i++) {
    for (let j = i + 1; j < submissions.length; j++) {
      const first = submissions[i]!;
      const second = submissions[j]!;
      if (first.categoryId !== second.categoryId) continue;
      addPair(
        candidates,
        first.id,
        second.id,
        cosine(first.values, second.values),
      );
    }
  }
  return [...candidates.values()].filter((pair) => pair.score >= 0.84);
}

function hashCategory(value: string): string {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0)!;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function addPair(
  pairs: Map<string, CandidatePair>,
  firstId: string,
  secondId: string,
  score: number,
) {
  const [first, second] = [firstId, secondId].sort();
  const key = `${first}:${second}`;
  if (score > (pairs.get(key)?.score ?? -1))
    pairs.set(key, { firstId: first!, secondId: second!, score });
}

function validateVector(values: number[]): void {
  if (
    values.length !== THEME_EMBEDDING_DIMENSIONS ||
    values.some((value) => !Number.isFinite(value))
  )
    throw new Error("Theme embedding has an invalid shape.");
}

function cosine(first: number[], second: number[]): number {
  let dot = 0;
  let firstNorm = 0;
  let secondNorm = 0;
  for (let i = 0; i < first.length; i++) {
    dot += first[i]! * second[i]!;
    firstNorm += first[i]! * first[i]!;
    secondNorm += second[i]! * second[i]!;
  }
  return firstNorm && secondNorm ? dot / Math.sqrt(firstNorm * secondNorm) : 0;
}
