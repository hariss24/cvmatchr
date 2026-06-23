/**
 * Enveloppe SSE commune pour les endpoints IA en streaming. Port de `_stream_ai` (app.py).
 *
 * Format identique à l'app Flask, attendu par le frontend :
 *   data: <chunk JSON-encodé>\n\n   (un par morceau)
 *   data: [DONE]\n\n                 (fin normale)
 *   data: [ERROR] <message>\n\n      (erreur en cours de génération)
 */
export function sseFromGenerator(gen: AsyncGenerator<string>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of gen) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(`data: [ERROR] ${message}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
