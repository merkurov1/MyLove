import { pipeline } from '@xenova/transformers';

export const runtime = 'edge';

export async function POST(req: Request) {
  const { text, task, model } = await req.json();
  try {
    const pipe = await pipeline(task, model);
    let result;
    if (task === 'text-generation') {
      result = await pipe(text, { max_new_tokens: 40 });
    } else {
      result = await pipe(text);
    }
    return new Response(JSON.stringify({ result }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
