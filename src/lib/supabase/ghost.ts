/**
 * Supabase Ghost Client
 * A recursive Proxy that mimics the Supabase Client API.
 * Used during build-time or in environments where Supabase keys are missing.
 * Prevents initialization crashes while allowing the code to execute safely.
 */

export function createGhostClient<T = unknown>(): T {
  const noop = () => ghost;
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ghost: any = new Proxy(noop, {
    get: (_target, prop) => {
      // Handle thenable for async/await support on method calls
      if (prop === 'then') return undefined;
      // Handle the case where someone checks for the presence of a target or data
      if (prop === 'data' || prop === 'error') return ghost;
      return ghost;
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    apply: async (_target, _thisArg, _argumentsList) => {
      // Return an object that is itself a ghost for its data properties
      // This allows const { data: { session } } = await supabase.auth.getSession() to not crash
      return { 
        data: ghost, 
        error: null, 
        count: 0,
        // Also support session-specific destructuring
        session: ghost,
        user: ghost
      };
    }
  });

  return ghost as unknown as T;
}
