import { createClient } from '@supabase/supabase-js'

function makeMissingClient(msg?: string) {
  const message = msg || 'Supabase client not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.';

  // A minimal, chainable stub that mirrors the supabase-js call shape used in this repo.
  const stubQuery = () => ({ data: null, error: { message } });

  const chainable = {
    select: async () => stubQuery(),
    insert: async () => stubQuery(),
    update: async () => stubQuery(),
    delete: async () => stubQuery(),
    eq: () => ({ select: async () => stubQuery(), update: async () => stubQuery() }),
    order: () => ({ select: async () => stubQuery() }),
    limit: () => ({ select: async () => stubQuery() }),
    single: async () => ({ data: null, error: { message } }),
    maybeSingle: async () => ({ data: null, error: { message } }),
  } as any;

  return {
    from: () => chainable,
    rpc: async () => ({ data: null, error: { message } }),
    auth: {
      signIn: async () => ({ error: { message } }),
      signOut: async () => ({ error: { message } }),
    },
    // allow any other property access without throwing
    __missing: true,
  } as any;
}

let _supabase: any = null;
if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  _supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
} else {
  _supabase = makeMissingClient();
}

export const supabase = _supabase;
export { createClient };