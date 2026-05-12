const { z } = require('zod');

const loginSchema = z.object({
  code: z.string().min(1, '登录凭证不能为空'),
  community_id: z.number().int().optional(),
});

const createTicketSchema = z.object({
  community_id: z.number().int(),
  category_id: z.number().int().optional(),
  description: z.string().min(10, '问题描述至少10个字').max(500, '问题描述最多500字'),
  location_desc: z.string().max(255).optional(),
  images: z.array(z.string()).max(3).optional(),
});

const addCommentSchema = z.object({
  content: z.string().min(1, '评论不能为空').max(500, '评论最多500字'),
});

module.exports = { loginSchema, createTicketSchema, addCommentSchema };
