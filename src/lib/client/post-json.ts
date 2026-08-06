export type JsonResponse = {
  ok?: boolean;
  error?: string;
  [key: string]: unknown;
};

export async function postJson<T extends JsonResponse>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as T | null;
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error ?? "Something went wrong. Please try again.");
  }
  return payload;
}
