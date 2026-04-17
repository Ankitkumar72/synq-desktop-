/**
 * Supabase Ghost Client
 * A recursive Proxy that mimics the Supabase Client API.
 * Used during build-time or in environments where Supabase keys are missing.
 * Prevents initialization crashes while allowing the code to execute safely.
 */

export function createGhostClient<T = any>(): T {
  const noop = () => ghost;
  
  const ghost: any = new Proxy(noop, {
    get: (target, prop) => {
      // Handle thenable for async/await support on method calls
      if (prop === 'then') return undefined;
      return ghost;
    },
    apply: async (target, thisArg, argumentsList) => {
      // Default response for Supabase methods like .select(), .getUser(), etc.
      return { data: null, error: null, count: 0 };
    }
  });

  return ghost as T;
}
