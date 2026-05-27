import type { SseEvent } from "./types";

export async function* readSse(resp: Response): AsyncGenerator<SseEvent> {
  if (!resp.body) throw new Error("No body");
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) return;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const evLine = chunk.split("\n").find(l => l.startsWith("event: "));
      const dataLine = chunk.split("\n").find(l => l.startsWith("data: "));
      if (!evLine || !dataLine) continue;
      const event = evLine.slice(7) as SseEvent["event"];
      const data = JSON.parse(dataLine.slice(6));
      yield { event, data } as SseEvent;
    }
  }
}
