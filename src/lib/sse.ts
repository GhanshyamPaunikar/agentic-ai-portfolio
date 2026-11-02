/**
 * Minimal Server-Sent Events parsing.
 *
 * Pure and dependency-free so it can be exercised directly in tests — the
 * failure mode that matters is a network chunk splitting an event in half,
 * which only shows up under realistic chunking.
 */

/** Pull the `data:` payload out of one SSE event block. */
export function payloadOf(block: string): string {
  return block
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("");
}

/** Yields complete `data:` payloads from a stream of decoded text chunks. */
export async function* sseEvents(
  chunks: AsyncIterable<string>,
): AsyncGenerator<string> {
  let buffer = "";

  for await (const chunk of chunks) {
    buffer += chunk;

    // Events are separated by a blank line, and a network chunk can split one
    // in half — so only consume up to the last complete separator.
    for (;;) {
      const sep = /\r?\n\r?\n/.exec(buffer);
      if (!sep) break;
      const block = buffer.slice(0, sep.index);
      buffer = buffer.slice(sep.index + sep[0].length);
      const payload = payloadOf(block);
      if (payload) yield payload;
    }
  }

  const tail = payloadOf(buffer);
  if (tail) yield tail;
}

/** Decodes a byte stream into text chunks, preserving multi-byte boundaries. */
export async function* decodeStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    yield decoder.decode(value, { stream: true });
  }
}
