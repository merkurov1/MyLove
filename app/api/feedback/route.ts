import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { conversationId, message, feedbackType, reason, metadata } = await req.json();

    if (!message || !feedbackType) {
      return NextResponse.json({ error: 'message and feedbackType required' }, { status: 400 });
    }

    const payload: any = {
      conversation_id: conversationId || null,
      message_text: message,
      feedback_type: feedbackType,
      reason: reason || null,
      metadata: metadata || null
    };

    const { data, error } = await supabase.from('feedback').insert([payload]).select().single();

    if (error) {
      console.error('[FEEDBACK] insert error', error.message || error);
      return NextResponse.json({ error: 'Failed to store feedback' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: data.id });
  } catch (err: any) {
    console.error('[FEEDBACK] error', err?.message || err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
