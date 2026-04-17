/**
 * Supabase Ghost Client
 * A recursive Proxy that mimics the Supabase Client API.
 * Used during build-time or in environments where Supabase keys are missing.
 * Prevents initialization crashes while allowing the code to execute safely.
 */

export function createGhostClient<T = unknown>(): T {
  const noop = () => ghost;
  
  const ghost = new Proxy(noop, {
    get: (_target, prop) => {
      // Handle thenable for async/await support on method calls
      if (prop === 'then') return undefined;
      return ghost;
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    apply: async (_target, _thisArg, _argumentsList) => {
      // Default response for Supabase methods like .select(), .getUser(), etc.
      return { data: null, error: null, count: 0 };
    }
  });

  return ghost as unknown as T;
}
