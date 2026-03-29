import { supabase } from './supabase';

const CURRENT_USER_ID = 2;

export async function createPendingConversationAndFirstMessage(
  otherUserId: string,
  content: string,
): Promise<{ conversationId: string | null; error: string | null }> {
  const { data: conv, error: convErr } = await supabase
    .from('conversations')
    .insert({
      user_id_1: CURRENT_USER_ID,
      user_id_2: otherUserId,
      status: 'pending',
    })
    .select('id')
    .single();

  if (convErr || !conv?.id) {
    return {
      conversationId: null,
      error: convErr?.message ?? 'Could not create conversation',
    };
  }

  const conversationId = String(conv.id);

  const { error: msgErr } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: CURRENT_USER_ID,
    content,
    created_at: new Date().toISOString(),
  });

  if (msgErr) {
    return { conversationId, error: msgErr.message };
  }

  return { conversationId, error: null };
}
