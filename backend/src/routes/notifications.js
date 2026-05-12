const express = require('express');
const { supabase } = require('../services/db');
const { authRequired } = require('../middleware/auth');
const router = express.Router();

router.get('/', authRequired, async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const user_id = req.user.sub;
    const { data, error } = await supabase.from('notifications')
      .select('*').eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    if (error) throw error;
    const { count } = await supabase.from('notifications')
      .select('*', { count: 'exact', head: true }).eq('user_id', user_id).eq('is_read', 0);
    res.json({ data: data || [], unreadCount: count || 0 });
  } catch (err) { next(err); }
});

router.put('/read-all', authRequired, async (req, res, next) => {
  try {
    await supabase.from('notifications').update({ is_read: 1 }).eq('user_id', req.user.sub).eq('is_read', 0);
    res.json({ data: { message: 'ok' } });
  } catch (err) { next(err); }
});

router.get('/unread-count', authRequired, async (req, res, next) => {
  try {
    const { count } = await supabase.from('notifications')
      .select('*', { count: 'exact', head: true }).eq('user_id', req.user.sub).eq('is_read', 0);
    res.json({ count: count || 0 });
  } catch (err) { next(err); }
});

module.exports = router;
