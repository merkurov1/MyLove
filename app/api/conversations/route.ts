// app/api/conversations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';

/**
 * GET /api/conversations
 * Возвращает список всех разговоров с последним сообщением
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();

    // Получаем все разговоры, отсортированные по дате обновления
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('id, title, created_at, updated_at')
      .order('updated_at', { ascending: false });

    if (convError) {
      console.error('[conversations] Error fetching conversations:', convError);
      return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
    }

    // Для каждого разговора получаем последнее сообщение
    const conversationsWithLastMessage = await Promise.all(
      (conversations || []).map(async (conv) => {
        const { data: messages } = await supabase
          .from('messages')
          .select('content, role, created_at')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1);

        return {
          ...conv,
          lastMessage: messages?.[0] || null,
        };
      })
    );

    return NextResponse.json({
      conversations: conversationsWithLastMessage,
      total: conversationsWithLastMessage.length,
    });
  } catch (error: any) {
    console.error('[conversations] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/conversations?id=<conversation_id>
 * Возвращает все сообщения конкретного разговора
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversationId } = body;

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId required' }, { status: 400 });
    }

    const supabase = createClient();

    // Получаем информацию о разговоре
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Получаем все сообщения разговора
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('[conversations] Error fetching messages:', messagesError);
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }

    return NextResponse.json({
      conversation,
      messages: messages || [],
    });
  } catch (error: any) {
    console.error('[conversations] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
