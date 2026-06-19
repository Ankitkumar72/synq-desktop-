/**
 * Supabase Ghost Client
 * A recursive Proxy that mimics the Supabase Client API.
 * Used during build-time or in environments where Supabase keys are missing.
 * Prevents initialization crashes while allowing the code to execute safely.
 */

export function createGhostClient<T = unknown>(): T {
  const noop = () => {};
  
  // nonThenableGhost lacks the 'then' property entirely, so JS engine stops unwrapping promises.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nonThenableGhost: any = new Proxy(noop, {
    get: (_target, prop) => {
      if (prop === '__isGhost') return true;
      if (prop === 'then') return undefined; // NOT thenable
      if (prop === 'error') return null;
      if (prop === 'data' || prop === 'session' || prop === 'user') return nonThenableGhost;

      const stringProps = ['id', 'email', 'name', 'full_name', 'plan_tier', 'status', 'title', 'content', 'description'];
      if (typeof prop === 'string' && stringProps.includes(prop)) return '';
      
      if (prop === 'count') return 0;
      if (prop === 'created_at' || prop === 'updated_at' || prop === 'due_date' || prop === 'start_date') return new Date().toISOString();
      if (prop === 'roles' || prop === 'permissions' || prop === 'tasks' || prop === 'notes') return [];
      if (prop === 'isAdmin' || prop === 'isPro' || prop === 'pinned') return false;

      return nonThenableGhost;
    },
    apply: () => nonThenableGhost
  });

  // ghost acts as the entry point and provides a 'then' method that resolves to nonThenableGhost
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ghost: any = new Proxy(noop, {
    get: (_target, prop) => {
      if (prop === '__isGhost') return true;
      
      // Provide a then method that resolves with the nonThenableGhost
      if (prop === 'then') {
        return (resolve: any) => resolve(nonThenableGhost);
      }
      
      if (prop === 'error') return null;
      if (prop === 'data' || prop === 'session' || prop === 'user') return ghost;

      const stringProps = ['id', 'email', 'name', 'full_name', 'plan_tier', 'status', 'title', 'content', 'description'];
      if (typeof prop === 'string' && stringProps.includes(prop)) return '';
      
      if (prop === 'count') return 0;
      if (prop === 'created_at' || prop === 'updated_at' || prop === 'due_date' || prop === 'start_date') return new Date().toISOString();
      if (prop === 'roles' || prop === 'permissions' || prop === 'tasks' || prop === 'notes') return [];
      if (prop === 'isAdmin' || prop === 'isPro' || prop === 'pinned') return false;

      return ghost;
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    apply: (_target, _thisArg, _argumentsList) => {
      return ghost;
    }
  });

  return ghost as unknown as T;
}
