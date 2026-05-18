export interface TextChunk {
  content: string;
  index: number;
}

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 150;

export function chunkText(text: string): TextChunk[] {
  const cleaned = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const chunks: TextChunk[] = [];

  if (cleaned.length <= CHUNK_SIZE) {
    return [{ content: cleaned, index: 0 }];
  }

  let start = 0;
  let index = 0;

  while (start < cleaned.length) {
    let end = start + CHUNK_SIZE;

    if (end < cleaned.length) {
      // Try to break at paragraph boundary first
      const paragraphBreak = cleaned.lastIndexOf("\n\n", end);
      if (paragraphBreak > start + CHUNK_SIZE / 2) {
        end = paragraphBreak;
      } else {
        // Try sentence boundary
        const sentenceBreak = cleaned.lastIndexOf(". ", end);
        if (sentenceBreak > start + CHUNK_SIZE / 2) {
          end = sentenceBreak + 1;
        } else {
          // Try word boundary
          const wordBreak = cleaned.lastIndexOf(" ", end);
          if (wordBreak > start) end = wordBreak;
        }
      }
    }

    const chunk = cleaned.slice(start, end).trim();
    if (chunk.length > 50) {
      chunks.push({ content: chunk, index });
      index++;
    }

    start = end - CHUNK_OVERLAP;
    if (start <= 0) start = end;
  }

  return chunks;
}
