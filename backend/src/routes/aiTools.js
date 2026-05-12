const express = require('express');
const { supabase } = require('../services/db');
const { aiLimiter } = require('../middleware/ratelimit');
const axios = require('axios');
const CircuitBreaker = require('../utils/circuitBreaker');
const logger = require('../utils/logger');

const router = express.Router();
const cb = new CircuitBreaker({ failureThreshold: 5, cooldownMs: 30000 });

router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('ai_tools').select('*').eq('status', 1).order('sort_order');
    if (error) throw error;
    const groups = {};
    const labels = { community: '🏠 社区生活', writing: '✍️ 文案写作', edu: '🎓 学生家长', social: '😄 情绪社交', utility: '🛠 实用工具', biz: '💼 小微商户' };
    for (const t of data || []) {
      if (!groups[t.category]) groups[t.category] = { category: t.category, name: labels[t.category] || t.category, tools: [] };
      groups[t.category].tools.push(t);
    }
    res.json({ data: Object.values(groups) });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('ai_tools').select('*').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ error: '工具不存在' });
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/:id/generate', aiLimiter, async (req, res, next) => {
  try {
    const { input } = req.body;
    if (!input || input.length < 2) return res.status(400).json({ error: '请输入内容' });

    const { data: tool, error: toolErr } = await supabase.from('ai_tools').select('*').eq('id', req.params.id).single();
    if (toolErr || !tool) return res.status(404).json({ error: '工具不存在' });
    if (!cb.canExecute()) return res.status(503).json({ error: 'AI 服务暂时不可用，请稍后重试' });

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) { cb.recordFailure(); return res.status(503).json({ error: 'AI 服务未配置' }); }

    const startTime = Date.now();
    const model = 'deepseek-chat';

    try {
      const response = await axios.post(
        `${process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1'}/chat/completions`,
        { model, messages: [{ role: 'system', content: tool.system_prompt }, { role: 'user', content: input }], temperature: tool.temperature || 0.7, max_tokens: tool.max_tokens || 800 },
        { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 15000 }
      );

      const latency = Date.now() - startTime;
      const output = response.data.choices[0].message.content.trim();
      const tokens = { prompt: response.data.usage?.prompt_tokens || 0, completion: response.data.usage?.completion_tokens || 0 };
      cb.recordSuccess();

      await supabase.from('ai_tools').update({ usage_count: (tool.usage_count || 0) + 1 }).eq('id', tool.id);
      await supabase.from('ai_call_logs').insert({ tool_id: tool.id, scene: 'ai_tool', model, prompt_tokens: tokens.prompt, completion_tokens: tokens.completion, latency_ms: latency, success: 1 });

      logger.info('AI tool generated', { tool: tool.name, latency_ms: latency });
      res.json({ data: { tool_id: tool.id, tool_name: tool.name, input, output, tokens, latency_ms: latency } });
    } catch (err) {
      cb.recordFailure();
      await supabase.from('ai_call_logs').insert({ tool_id: tool.id, scene: 'ai_tool', model, latency_ms: Date.now() - startTime, success: 0, error_msg: String(err.message).slice(0, 500) });
      logger.error('AI tool failed', { tool: tool.name, error: err.message });
      res.status(500).json({ error: 'AI 生成失败，请重试' });
    }
  } catch (err) { next(err); }
});

module.exports = router;
