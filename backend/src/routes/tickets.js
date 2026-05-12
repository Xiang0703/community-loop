const express = require('express');
const { nanoid } = require('nanoid');
const { supabase } = require('../services/db');
const { authRequired, optionalAuth } = require('../middleware/auth');
const { generalLimiter } = require('../middleware/ratelimit');
const { validate } = require('../middleware/validate');
const { createTicketSchema, addCommentSchema } = require('./schemas');
const { classifyTicket, getCategoryId } = require('../services/aiService');
const { onCommentAdded, onTicketResolved } = require('../services/notificationService');
const { NotFoundError, ForbiddenError } = require('../utils/errors');
const logger = require('../utils/logger');

const router = express.Router();

// GET /api/tickets
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { community_id, category_id, status, page = 1, limit = 20 } = req.query;
    if (!community_id) return res.status(400).json({ error: '请指定小区', code: 'BAD_REQUEST' });

    let query = supabase.from('tickets')
      .select('id, ticket_no, title, description, images, location_desc, ai_category, ai_priority, ai_tags, status, comment_count, created_at, updated_at, user_id, category:categories(id, name, icon), user:users!tickets_user_id_fkey(id, nickname, avatar_url, building, room_number)')
      .eq('community_id', community_id)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (category_id) query = query.eq('category_id', category_id);
    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ data: data || [], pagination: { page: Number(page), limit: Number(limit), total: count } });
  } catch (err) { next(err); }
});

// POST /api/tickets
router.post('/', authRequired, generalLimiter, validate(createTicketSchema), async (req, res, next) => {
  try {
    const { community_id, category_id, description, location_desc, images } = req.validated;
    const user_id = req.user.sub;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const ticket_no = 'TK' + dateStr + nanoid(6).toUpperCase();

    let categoryName = '';
    if (category_id) {
      const { data: cat } = await supabase.from('categories').select('name').eq('id', category_id).maybeSingle();
      categoryName = cat?.name || '';
    }

    const aiResult = await classifyTicket(description, categoryName);
    let finalCategoryId = category_id;
    if (aiResult?.category && !category_id) {
      finalCategoryId = await getCategoryId(aiResult.category);
    }

    const { data: ticket, error } = await supabase.from('tickets').insert({
      ticket_no, user_id, community_id,
      category_id: finalCategoryId || null,
      title: description.slice(0, 50), description,
      images: images || [], location_desc: location_desc || '',
      ai_category: aiResult?.category || null,
      ai_priority: aiResult?.priority || 'normal',
      ai_tags: aiResult?.tags || [],
      status: 'open',
    }).select('*').single();

    if (error) throw error;

    await supabase.from('ticket_logs').insert({ ticket_id: ticket.id, action: 'created', user_id });
    logger.info('Ticket created', { ticket_no, user_id, community_id });
    res.status(201).json({ data: ticket });
  } catch (err) { next(err); }
});

// GET /api/tickets/:id
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data: ticket, error } = await supabase.from('tickets')
      .select('*, category:categories(id, name, icon), user:users!tickets_user_id_fkey(id, nickname, avatar_url, building, room_number)')
      .eq('id', id).single();
    if (error || !ticket) return next(new NotFoundError('工单不存在'));

    const { data: comments } = await supabase.from('ticket_comments')
      .select('id, content, created_at, user:users(id, nickname, avatar_url)')
      .eq('ticket_id', id).order('created_at', { ascending: true });

    const { data: logs } = await supabase.from('ticket_logs')
      .select('*').eq('ticket_id', id).order('created_at', { ascending: true });

    res.json({ data: { ...ticket, comments: comments || [], logs: logs || [] } });
  } catch (err) { next(err); }
});

// POST /api/tickets/:id/comments
router.post('/:id/comments', authRequired, validate(addCommentSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content } = req.validated;
    const user_id = req.user.sub;

    const { data: ticket, error: getErr } = await supabase
      .from('tickets').select('id, user_id, title, description, comment_count').eq('id', id).single();
    if (getErr || !ticket) return next(new NotFoundError('工单不存在'));

    const { data: comment, error } = await supabase.from('ticket_comments')
      .insert({ ticket_id: Number(id), user_id, content })
      .select('id, content, created_at, user:users(id, nickname, avatar_url)').single();
    if (error) throw error;

    await supabase.from('tickets').update({ comment_count: (ticket.comment_count || 0) + 1 }).eq('id', id);
    await supabase.from('ticket_logs').insert({ ticket_id: Number(id), action: 'commented', user_id });
    await onCommentAdded({ ticket, commenterId: user_id, content });
    res.status(201).json({ data: comment });
  } catch (err) { next(err); }
});

// PUT /api/tickets/:id/resolve
router.put('/:id/resolve', authRequired, async (req, res, next) => {
  try {
    const { id } = req.params;
    const user_id = req.user.sub;
    const { data: ticket, error: getErr } = await supabase
      .from('tickets').select('id, user_id, status, title, description').eq('id', id).single();
    if (getErr || !ticket) return next(new NotFoundError('工单不存在'));
    if (ticket.user_id !== user_id) return next(new ForbiddenError('只有提交人可以标记已解决'));
    if (ticket.status === 'resolved') return res.json({ data: { message: '已经是已解决状态' } });

    const now = new Date().toISOString();
    await supabase.from('tickets').update({ status: 'resolved', resolved_at: now, resolved_by: user_id }).eq('id', id);
    await supabase.from('ticket_logs').insert({ ticket_id: Number(id), action: 'resolved', user_id });
    await onTicketResolved(ticket);
    res.json({ data: { status: 'resolved', resolved_at: now } });
  } catch (err) { next(err); }
});

// GET /api/tickets/mine/list
router.get('/mine/list', authRequired, async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    let query = supabase.from('tickets').select('*')
      .eq('user_id', req.user.sub)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ data: data || [] });
  } catch (err) { next(err); }
});

module.exports = router;
