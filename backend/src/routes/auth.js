const express = require('express');
const axios = require('axios');
const { supabase } = require('../services/db');
const { generateToken } = require('../middleware/auth');
const { authLimiter } = require('../middleware/ratelimit');
const { validate } = require('../middleware/validate');
const { loginSchema } = require('./schemas');
const { BadRequestError } = require('../utils/errors');
const logger = require('../utils/logger');

const router = express.Router();

// POST /api/auth/login
router.post('/login', authLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { code, community_id } = req.validated;

    let openid;
    if (process.env.NODE_ENV === 'development' && code === 'dev-test-code') {
      openid = `dev_openid_${Date.now()}`;
    } else {
      const wxRes = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
        params: {
          appid: process.env.WECHAT_APP_ID,
          secret: process.env.WECHAT_APP_SECRET,
          js_code: code,
          grant_type: 'authorization_code',
        },
      });
      if (wxRes.data.errcode) {
        throw new BadRequestError('微信登录失败: ' + wxRes.data.errmsg);
      }
      openid = wxRes.data.openid;
    }

    const { data: existing } = await supabase
      .from('users').select('*').eq('openid', openid).maybeSingle();

    let user = existing;
    if (!user) {
      const { data: created, error: createErr } = await supabase
        .from('users')
        .insert({ openid, community_id: community_id || null, role: 'resident', last_login_at: new Date().toISOString() })
        .select('*').single();
      if (createErr) throw createErr;
      user = created;
    } else {
      await supabase.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id);
    }

    const token = generateToken(user);
    res.json({
      token,
      user: {
        id: user.id, nickname: user.nickname, avatar_url: user.avatar_url,
        role: user.role, community_id: user.community_id,
        building: user.building, room_number: user.room_number,
      },
    });
  } catch (err) { next(err); }
});

// PUT /api/auth/profile
router.put('/profile', require('../middleware/auth').authRequired, async (req, res, next) => {
  try {
    const allowed = ['nickname', 'avatar_url', 'community_id', 'building', 'room_number'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    const { data, error } = await supabase
      .from('users').update(updates).eq('id', req.user.sub)
      .select('id, nickname, avatar_url, role, community_id, building, room_number').single();
    if (error) throw error;
    res.json({ user: data });
  } catch (err) { next(err); }
});

module.exports = router;
