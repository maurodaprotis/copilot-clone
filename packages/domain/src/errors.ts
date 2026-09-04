/** Client-facing domain errors → HTTP 4xx at the API boundary. */
export class ClientError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "ClientError";
    this.code = code;
    this.status = status;
  }

  toJSON(): { error: string; message: string } {
    return { error: this.code, message: this.message };
  }
}

export function isClientError(value: unknown): value is ClientError {
  if (value instanceof ClientError) return true;
  if (typeof value !== "object" || value === null) return false;
  const v = value as { name?: unknown; code?: unknown; status?: unknown; message?: unknown };
  return (
    v.name === "ClientError" &&
    typeof v.code === "string" &&
    typeof v.status === "number" &&
    typeof v.message === "string"
  );
}
