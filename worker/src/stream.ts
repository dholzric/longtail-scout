export function formatSseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export class SseEmitter {
  private encoder = new TextEncoder();
  constructor(private writer: WritableStreamDefaultWriter<Uint8Array>) {}

  async emit(event: string, data: unknown): Promise<void> {
    await this.writer.write(this.encoder.encode(formatSseEvent(event, data)));
  }

  async close(): Promise<void> {
    await this.writer.close();
  }
}

export function createSseResponse(): { response: Response; emitter: SseEmitter } {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const emitter = new SseEmitter(writer);
  const response = new Response(readable, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      "x-accel-buffering": "no"
    }
  });
  return { response, emitter };
}
