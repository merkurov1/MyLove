// Ambient shims to silence missing type declarations while dev dependencies
// are installed. These are minimal and intentionally permissive.

declare const process: any;

declare module 'next/server' {
  export type NextRequest = any;
  export const NextResponse: any;
}

declare module '@supabase/supabase-js' {
  export function createClient(...args: any[]): any;
}

declare module '@ai-sdk/openai';
