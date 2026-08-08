type SupabaseErrorLike = {
  code?: unknown;
  message?: unknown;
};

type SupabaseReadResult = {
  error: unknown;
};

type SupabaseReadRetryOptions = {
  retryDelaysMs?: readonly number[];
  onRetry?: (
    error: SupabaseErrorLike,
    retryNumber: number,
    delayMs: number,
  ) => void;
};

const DEFAULT_RETRY_DELAYS_MS = [300, 1_200] as const;

export function isSupabaseJwtIssuedAtFutureError(
  error: unknown,
): error is SupabaseErrorLike {
  if (!error || typeof error !== "object") return false;

  const { code, message } = error as SupabaseErrorLike;
  return (
    code === "PGRST303" &&
    typeof message === "string" &&
    /jwt issued at future/i.test(message)
  );
}

/**
 * Retries only idempotent Supabase reads that hit the transient JWT clock-skew
 * failure observed between Supabase's token issuer and PostgREST validator.
 */
export async function retrySupabaseReadOnJwtIssuedAtFuture<
  Result extends SupabaseReadResult,
>(
  read: () => PromiseLike<Result>,
  options: SupabaseReadRetryOptions = {},
): Promise<Result> {
  const retryDelaysMs =
    options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  let result = await read();

  for (const [index, delayMs] of retryDelaysMs.entries()) {
    if (!isSupabaseJwtIssuedAtFutureError(result.error)) return result;

    options.onRetry?.(result.error, index + 1, delayMs);
    if (delayMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
    result = await read();
  }

  return result;
}
