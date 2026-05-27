export interface BrightDataAuth {
  apiKey: string;
}

export class BrightDataError extends Error {
  constructor(public status: number, public bodyExcerpt: string) {
    super(`Bright Data error ${status}: ${bodyExcerpt.slice(0, 200)}`);
  }
}

export async function brightDataFetch(
  endpoint: string,
  body: unknown,
  auth: BrightDataAuth
): Promise<unknown> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${auth.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new BrightDataError(res.status, text);
  }
  return await res.json();
}
