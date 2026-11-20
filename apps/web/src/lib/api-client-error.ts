/** Structured API failure - preserves `error_key` after Axios normalization. */
export class ApiClientError extends Error {
  readonly status?: number;
  readonly errorKey?: string;

  constructor(
    message: string,
    opts?: {
      status?: number;
      errorKey?: string;
    },
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = opts?.status;
    this.errorKey = (opts?.errorKey || "").trim() || undefined;
  }
}

export function isApiClientError(err: unknown): err is ApiClientError {
  return err instanceof ApiClientError;
}
