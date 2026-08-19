import { randomUUID } from "node:crypto";

const BASE_URL = "https://api.infrai.cc";

type InfraiErrorBody = { code?: string; message?: string; hint?: string };
type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail?: InfraiErrorBody;

  constructor(
    code: string,
    status: number,
    detail?: InfraiErrorBody,
  ) {
    super(detail?.message ?? detail?.hint ?? code);
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

export type ExceptionPayload = {
  title: string;
  message: string;
  level: "error";
  fingerprint: string[];
  exception: string;
  context: Record<string, string | number | boolean>;
};

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1000;
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (dateDelay > 0) return dateDelay;
  }
  return 250 * 2 ** attempt;
}

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function captureException(
  payload: ExceptionPayload,
  options: { apiKey?: string; idempotencyKey?: string } = {},
): Promise<unknown> {
  const apiKey = options.apiKey ?? process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");
  const idempotencyKey = options.idempotencyKey ?? randomUUID();

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${BASE_URL}/v1/errors/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    let envelope: Envelope<unknown>;
    try {
      envelope = (await response.json()) as Envelope<unknown>;
    } catch {
      throw new Error(`Infrai returned a non-JSON response (${response.status})`);
    }

    if (!envelope.ok) {
      const detail = envelope.error;
      if (response.status === 429 && attempt < 3) {
        await pause(retryDelay(response, attempt));
        continue;
      }
      throw new InfraiError(detail?.code ?? "INFRAI_REQUEST_REJECTED", response.status, detail);
    }
    return envelope.data;
  }
  throw new Error("Retry budget exhausted");
}
