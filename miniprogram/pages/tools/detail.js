const api = require('../../utils/api');

function getHistory() { return wx.getStorageSync('ai_tool_history') || []; }
function saveHistory(item) {
  const list = getHistory(); list.unshift(item);
  if (list.length > 50) list.length = 50;
  wx.setStorageSync('ai_tool_history', list);
}
function getFavs() { return wx.getStorageSync('ai_tool_favs') || []; }
function isFav(id) { return getFavs().some(f => f.id === id); }
function toggleFav(tool) {
  let list = getFavs();
  const idx = list.findIndex(f => f.id === tool.id);
  if (idx >= 0) list.splice(idx, 1); else list.push({ id: tool.id, name: tool.name, icon: tool.icon });
  wx.setStorageSync('ai_tool_favs', list);
  return idx < 0;
}

Page({
  data: { tool: null, input: '', output: '', generating: false, tokens: null, latency: null, fav: false },

  onLoad(opts) { if (opts.id) this.loadTool(opts.id); },

  async loadTool(id) {
    try {
      const res = await api.getAITool(Number(id));
      this.setData({ tool: res.data, fav: isFav(Number(id)) });
      wx.setNavigationBarTitle({ title: res.data.name });
    } catch { wx.showToast({ title: '加载失败', icon: 'none' }); }
  },

  onInput(e) { this.setData({ input: e.detail.value }); },

  async generate() {
    const inp = this.data.input;
    if (!inp || inp.length < 2) { wx.showToast({ title: '请输入内容', icon: 'none' }); return; }
    this.setData({ generating: true, output: '' });
    try {
      const res = await api.generateAITool(this.data.tool.id, inp);
      const r = res.data;
      this.setData({ output: r.output, tokens: r.tokens, latency: r.latency_ms, generating: false });
      saveHistory({ toolId: this.data.tool.id, toolName: this.data.tool.name, toolIcon: this.data.tool.icon, input: inp, output: r.output, time: Date.now() });
    } catch {
      this.setData({ generating: false });
      wx.showToast({ title: '生成失败', icon: 'none' });
    }
  },

  toggleFav() { const f = toggleFav(this.data.tool); this.setData({ fav: f }); wx.showToast({ title: f ? '已收藏' : '已取消', icon: 'none' }); },
  copyResult() { wx.setClipboardData({ data: this.data.output, success: () => wx.showToast({ title: '已复制' }) }); },
  regenerate() { this.generate(); },

  onShareAppMessage() {
    const t = this.data.tool;
    return { title: '我用【' + t.name + '】生成了：' + (this.data.output || '').slice(0, 40) + '...', path: '/pages/tools/detail?id=' + t.id };
  },
});
