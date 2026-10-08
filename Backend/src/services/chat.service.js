import { chatRepository, messageRepository } from '../repositories/chat.repository.js';
import itemRepository from '../repositories/item.repository.js';
import userRepository from '../repositories/user.repository.js';
import { notify } from './notification.service.js';
import realtime from './realtime.service.js';
import { adminClient } from '../lib/supabase.js';
import { NotFound, Forbidden, BadRequest } from '../lib/errors.js';
import { NOTIFICATION_TYPE, ITEM_STATUS } from '../config/constants.js';
import logger from '../lib/logger.js';

const assertParticipant = (chat, userId) => {
  if (chat.sender_id !== userId && chat.receiver_id !== userId) {
    throw Forbidden('You are not part of this conversation.');
  }
};

const otherParty = (chat, userId) => (chat.sender_id === userId ? chat.receiver : chat.sender);

export const startConversation = async ({ itemId, userId }) => {
  const item = await itemRepository.findById(itemId);
  if (!item) throw NotFound('This item is no longer available.');
  if (item.user_id === userId) throw BadRequest('You cannot start a conversation about your own item.');
  if (item.status !== ITEM_STATUS.ACTIVE) throw BadRequest('This item is not currently available for swapping.');

  return chatRepository.findOrCreate({ itemId, senderId: userId, receiverId: item.user_id });
};

export const listConversations = ({ userId, page, limit, archived }) =>
  chatRepository.listForUser(userId, { page, limit, archived });

export const conversation = async ({ chatId, userId, page, limit }) => {
  const chat = await chatRepository.findById(chatId);
  if (!chat) throw NotFound('Conversation not found.');
  assertParticipant(chat, userId);

  const messages = await messageRepository.listForChat(chatId, { page, limit });
  await messageRepository.markRead(chatId, userId);
  await realtime.messagesRead(chatId, userId);

  return { chat, messages };
};

/**
 * Sends a message.
 * The row is written first, then realtime, then notification — in that order,
 * so a failure in a downstream transport can never lose the message itself.
 */
export const sendMessage = async ({ chatId, senderId, content, attachments = [], messageType = 'text', metadata }) => {
  const chat = await chatRepository.findById(chatId);
  if (!chat) throw NotFound('Conversation not found.');
  assertParticipant(chat, senderId);

  if (!content?.trim() && !attachments.length) {
    throw BadRequest('Write a message or attach a file.');
  }

  const message = await messageRepository.create({
    chat_id: chatId,
    sender_id: senderId,
    content: content?.trim() ?? '',
    attachments,
    message_type: messageType,
    metadata: metadata ?? null,
  });

  // `?? ` never fired for an attachment-only message: ''.slice() is '', not null.
  const preview = content?.trim() ? content.trim().slice(0, 140) : '📎 Attachment';

  /**
   * Everything below happens AFTER the message is saved, so none of it may
   * fail the request. Previously a hiccup in notifications (a slow database
   * call, a push provider error) surfaced to the sender as "Not sent" for a
   * message that had in fact been delivered — they sent it again, and the
   * other person received it twice.
   *
   * Realtime goes first so the recipient sees the message as early as possible.
   */
  await Promise.allSettled([chatRepository.touch(chatId, preview), realtime.messageCreated(chatId, message)]);

  try {
    const recipientId = chat.sender_id === senderId ? chat.receiver_id : chat.sender_id;
    const [sender, { data: authUser }] = await Promise.all([
      userRepository.findById(senderId),
      adminClient.auth.admin.getUserById(recipientId),
    ]);

    await notify({
      userId: recipientId,
      type: NOTIFICATION_TYPE.MESSAGE,
      title: `New message from ${sender?.full_name ?? 'a swapper'}`,
      content: preview,
      actionUrl: `/chats/${chatId}`,
      data: { chatId, itemId: chat.item_id },
      email: authUser?.user?.email
        ? {
            template: 'newMessage',
            to: authUser.user.email,
            props: {
              name: otherParty(chat, senderId)?.full_name,
              senderName: sender?.full_name ?? 'A swapper',
              itemName: chat.item?.name ?? 'your item',
              preview,
              chatId,
            },
          }
        : undefined,
    });
  } catch (error) {
    logger.warn('chat.notify_failed', { chatId, messageId: message.id, error: error.message });
  }

  return message;
};

export const setTyping = async ({ chatId, userId, isTyping }) => {
  const chat = await chatRepository.findById(chatId);
  if (!chat) throw NotFound('Conversation not found.');
  assertParticipant(chat, userId);
  await realtime.typing(chatId, userId, isTyping);
  return { ok: true };
};

export const markRead = async ({ chatId, userId }) => {
  const chat = await chatRepository.findById(chatId);
  if (!chat) throw NotFound('Conversation not found.');
  assertParticipant(chat, userId);
  await messageRepository.markRead(chatId, userId);
  await realtime.messagesRead(chatId, userId);
  return { ok: true };
};

export const archive = async ({ chatId, userId, archived }) => {
  const chat = await chatRepository.findById(chatId);
  if (!chat) throw NotFound('Conversation not found.');
  assertParticipant(chat, userId);
  return chatRepository.setArchived(chatId, archived);
};

export const unreadCount = (userId) => messageRepository.unreadCount(userId);

export default {
  startConversation,
  listConversations,
  conversation,
  sendMessage,
  setTyping,
  markRead,
  archive,
  unreadCount,
};
