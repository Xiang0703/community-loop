const logger = require('../utils/logger');

function createMemoryDb() {
  const store = {
    communities: [{ id: 1, name: '阳光花园', city: '北京', district: '朝阳区' }],
    users: [],
    categories: [
      { id: 1, name: '停车占位', icon: '🚗' }, { id: 2, name: '报修', icon: '🔧' },
      { id: 3, name: '环境卫生', icon: '🌿' }, { id: 4, name: '失物招领', icon: '📦' },
      { id: 5, name: '宠物相关', icon: '🐾' }, { id: 6, name: '小区通知', icon: '📢' },
      { id: 7, name: '其他', icon: '💬' },
    ],
    tickets: [], ticket_comments: [], ticket_logs: [], notifications: [],
    ai_prompt_templates: [{
      id: 1, scene: 'classify', version: 1, is_active: 1,
      system_prompt: '你是社区事务分类助手。请判断类别：停车占位/报修/环境卫生/失物招领/宠物相关/小区通知/其他。',
      user_prompt_template: '用户描述：{{description}}\n用户选定分类：{{category}}\n只返回JSON：{"category":"分类","priority":"优先级","tags":["标签"]}',
      model: 'deepseek-chat', temperature: 0.3, max_tokens: 300,
    }],
  };
  let ids = { users: 1, tickets: 1, ticket_comments: 1, ticket_logs: 1, notifications: 1 };
  const now = () => new Date().toISOString();

  function tbl(name) {
    const rows = store[name];
    if (!rows) throw new Error('Table not found: ' + name);

    function filtered(filters, order, lim, off) {
      let r = [...rows];
      for (const f of filters) r = r.filter(f);
      if (order) r.sort((a, b) => {
        const va = a[order.k], vb = b[order.k];
        return order.a ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
      });
      const total = r.length;
      if (off != null) r = r.slice(off);
      if (lim != null) r = r.slice(0, lim);
      return { result: r, total };
    }

    // Chain builder
    function chain(filters, order, lim, off) {
      const c = { _f: filters, _ord: order, _lim: lim, _off: off };

      return {
        eq: (k, v) => chain([...c._f, r => r[k] === v], c._ord, c._lim, c._off),
        ilike: (k, v) => chain([...c._f, r => String(r[k] || '').toLowerCase().includes(String(v).toLowerCase())], c._ord, c._lim, c._off),
        order: (k, opts) => chain(c._f, { k, a: !opts || opts.ascending !== false }, c._lim, c._off),
        limit: (n) => chain(c._f, c._ord, n, c._off),
        range: (f, t) => chain(c._f, c._ord, t - f + 1, f),
        select: () => chain(c._f, c._ord, c._lim, c._off),
        then: (resolve) => {
          const { result, total } = filtered(c._f, c._ord, c._lim, c._off);
          resolve({ data: result, error: null, count: total });
        },
        maybeSingle: () => {
          const { result } = filtered(c._f, c._ord, 1, c._off);
          return Promise.resolve({ data: result[0] || null, error: null });
        },
        single: () => {
          const { result } = filtered(c._f, c._ord, 1, c._off);
          if (!result[0]) { const e = new Error('Not found'); e.code = 'PGRST116'; throw e; }
          return { data: result[0], error: null };
        },
        insert: (recs) => {
          const arr = Array.isArray(recs) ? recs : [recs];
          const inserted = arr.map(r => {
            const idVal = ids[name] = (ids[name] || 0) + 1;
            const row = { id: idVal, ...r };
            if (!row.created_at) row.created_at = now();
            rows.push(row);
            return row;
          });
          const result = inserted.length === 1 ? inserted[0] : inserted;
          return {
            select: () => chain([rr => rr.id === result.id], null, null, null),
            then: (resolve) => resolve({ data: result, error: null }),
            single: () => ({ data: result, error: null }),
          };
        },
        update: (upd) => {
          const { result } = filtered(c._f, c._ord, c._lim, c._off);
          result.forEach(r => Object.assign(r, upd, { updated_at: now() }));
          return {
            eq: (k, v) => chain([rr => rr[k] === v], null, null, null),
            then: (resolve) => resolve({ data: result[0] || null, error: null }),
          };
        },
      };
    }

    return chain([], null, null, null);
  }

  return { from: (name) => tbl(name) };
}

module.exports = { createMemoryDb };
