export async function generateEmbedding(input: string): Promise<number[]> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const OPENAI_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-large';

  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not configured.');
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_EMBEDDING_MODEL,
      input,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI embedding request failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    data: Array<{ embedding: number[] }>;
  };

  const embedding = data.data?.[0]?.embedding;
  if (!embedding) {
    throw new Error('OpenAI embedding response missing embedding data.');
  }

  return embedding;
}
