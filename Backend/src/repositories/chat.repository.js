import { db, unwrap, range } from './base.repository.js';

const PARTY = (alias, fk) => `${alias}:users!chats_${fk}_fkey(id, full_name, avatar_url, is_verified, last_seen_at)`;
const CHAT_FIELDS = `
  id, item_id, sender_id, receiver_id, last_message_at, last_message_preview,
  is_archived, created_at,
  item:items(id, name, images, estimated_cost, status),
  ${PARTY('sender', 'sender_id')},
  ${PARTY('receiver', 'receiver_id')}
`;

export const chatRepository = {
  async findOrCreate({ itemId, senderId, receiverId }) {
    const existing = unwrap(
      await db
        .from('chats')
        .select(CHAT_FIELDS)
        .eq('item_id', itemId)
        .or(
          `and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),` +
            `and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`,
        )
        .maybeSingle(),
      'find chat',
    );
    if (existing) return existing;

    return unwrap(
      await db
        .from('chats')
        .insert({ item_id: itemId, sender_id: senderId, receiver_id: receiverId })
        .select(CHAT_FIELDS)
        .single(),
      'create chat',
    );
  },

  async findById(id) {
    return unwrap(await db.from('chats').select(CHAT_FIELDS).eq('id', id).maybeSingle(), 'find chat');
  },

  async listForUser(userId, { page, limit, archived = false }) {
    const { from, to, page: safePage, limit: safeLimit } = range({ page, limit });
    const { data, count } = unwrap(
      await db
        .from('chats')
        .select(CHAT_FIELDS, { count: 'exact' })
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .eq('is_archived', archived)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .range(from, to),
      'list chats',
    );
    return { items: data ?? [], total: count ?? 0, page: safePage, limit: safeLimit };
  },

  async touch(id, preview) {
    await db
      .from('chats')
      .update({ last_message_at: new Date().toISOString(), last_message_preview: preview })
      .eq('id', id);
  },

  async setArchived(id, archived) {
    return unwrap(
      await db.from('chats').update({ is_archived: archived }).eq('id', id).select(CHAT_FIELDS).single(),
      'archive chat',
    );
  },
};

const MESSAGE_FIELDS = `
  id, chat_id, sender_id, content, attachments, message_type, metadata,
  is_read, read_at, created_at,
  sender:users!messages_sender_id_fkey(id, full_name, avatar_url)
`;

export const messageRepository = {
  async create(payload) {
    return unwrap(await db.from('messages').insert(payload).select(MESSAGE_FIELDS).single(), 'send message');
  },

  async listForChat(chatId, { page, limit }) {
    const { from, to, page: safePage, limit: safeLimit } = range({ page, limit });
    const { data, count } = unwrap(
      await db
        .from('messages')
        .select(MESSAGE_FIELDS, { count: 'exact' })
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .range(from, to),
      'list messages',
    );
    // Newest-first from the database for correct pagination, oldest-first for rendering.
    return { items: (data ?? []).reverse(), total: count ?? 0, page: safePage, limit: safeLimit };
  },

  async markRead(chatId, readerId) {
    unwrap(
      await db
        .from('messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('chat_id', chatId)
        .neq('sender_id', readerId)
        .eq('is_read', false),
      'mark messages read',
    );
  },

  /**
   * One query instead of two. The old version fetched every chat id, then sent
   * them all back in an IN (...) list — for an active trader with hundreds of
   * conversations that URL outgrew PostgREST's limit and the badge silently
   * stopped updating.
   */
  async unreadCount(userId) {
    const { count } = unwrap(
      await db
        .from('messages')
        .select('id, chat:chats!inner(sender_id, receiver_id)', { count: 'exact', head: true })
        .neq('sender_id', userId)
        .eq('is_read', false)
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`, { referencedTable: 'chats' }),
      'count unread',
    );
    return count ?? 0;
  },

  async recent(limit = 50) {
    return unwrap(
      await db
        .from('messages')
        .select(`${MESSAGE_FIELDS}, chat:chats(id, item:items(id, name))`)
        .order('created_at', { ascending: false })
        .limit(limit),
      'recent messages',
    );
  },
};

export default { chatRepository, messageRepository };
