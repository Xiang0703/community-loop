const { supabase } = require('./db');
const logger = require('../utils/logger');

async function createNotification({ user_id, ticket_id, type, title, content }) {
  const { error } = await supabase.from('notifications').insert({
    user_id, ticket_id, type, title: title || '', content: content || '',
  });
  if (error) logger.error('Failed to create notification', { error, user_id, type });
}

async function onCommentAdded({ ticket, commenterId, content }) {
  if (ticket.user_id !== commenterId) {
    const preview = (ticket.title || ticket.description || '').slice(0, 30);
    await createNotification({
      user_id: ticket.user_id, ticket_id: ticket.id, type: 'comment',
      title: '新的评论', content: `你的问题"${preview}"有新的评论`,
    });
  }
}

async function onTicketResolved(ticket) {
  const preview = (ticket.title || ticket.description || '').slice(0, 30);
  await createNotification({
    user_id: ticket.user_id, ticket_id: ticket.id, type: 'resolved',
    title: '问题已解决', content: `你的问题"${preview}"已标记为已解决`,
  });
}

module.exports = { createNotification, onCommentAdded, onTicketResolved };
