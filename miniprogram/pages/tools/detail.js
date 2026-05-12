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

// Quick options by category
const QUICK_OPTS = {
  writing: ['正式', '口语化', '简洁', '详细', '幽默'],
  social: ['温柔', '霸气', '幽默', '真诚', '简短'],
  edu: ['详细版', '简洁版', '小学生版', '中学生版'],
  community: ['正式', '温和', '强硬', '简短'],
  utility: ['详细', '简洁'],
  biz: ['接地气', '专业', '幽默', '简洁'],
};

Page({
  data: {
    tool: null, input: '', output: '', generating: false, tokens: null, latency: null, fav: false,
    quickOpts: [], selectedOpt: '', relatedTools: [], recording: false,
  },

  onLoad(opts) { if (opts.id) this.loadTool(opts.id); },

  async loadTool(id) {
    try {
      const res = await api.getAITool(Number(id));
      const tool = res.data;
      const opts = QUICK_OPTS[tool.category] || ['正式', '口语化', '简洁'];
      this.setData({ tool, fav: isFav(Number(id)), quickOpts: opts, selectedOpt: '' });
      wx.setNavigationBarTitle({ title: tool.name });
      this.loadRelated(tool.category, tool.id);
    } catch { wx.showToast({ title: '加载失败', icon: 'none' }); }
  },

  async loadRelated(cat, excludeId) {
    try {
      const res = await api.getAITools();
      const group = (res.data || []).find(g => g.category === cat);
      if (group) {
        const related = group.tools.filter(t => t.id !== excludeId).slice(0, 4);
        this.setData({ relatedTools: related });
      }
    } catch {}
  },

  onInput(e) { this.setData({ input: e.detail.value }); },

  
  startVoice() {
    this.setData({ recording: true });
    this.recorder = wx.getRecorderManager();
    this.recorder.onStop((res) => {
      this.setData({ recording: false });
      if (!res.tempFilePath) return;
      wx.showLoading({ title: '识别中...' });
      const plugin = requirePlugin('YzsSpeech');
      if (plugin && plugin.recognize) {
        plugin.recognize({
          filePath: res.tempFilePath,
          success: (r) => { wx.hideLoading(); if (r.text) this.setData({ input: (this.data.input + r.text).trim() }); },
          fail: () => { wx.hideLoading(); wx.showToast({ title: '识别失败', icon: 'none' }); },
        });
      } else {
        wx.hideLoading();
        wx.showToast({ title: '语音插件未就绪', icon: 'none' });
      }
    });
    this.recorder.onError(() => { this.setData({ recording: false }); });
    this.recorder.start({ format: 'mp3', duration: 30000, sampleRate: 16000, numberOfChannels: 1, encodeBitRate: 48000 });
  },
  stopVoice() { if (this.data.recording && this.recorder) this.recorder.stop(); },

  selectOpt(e) {
    const opt = e.currentTarget.dataset.opt;
    this.setData({ selectedOpt: opt });
  },

  async generate(extra) {
    const inp = this.data.input;
    if (!inp || inp.length < 2) { wx.showToast({ title: '请输入内容', icon: 'none' }); return; }
    this.setData({ generating: true, output: '' });
    try {
      let prompt = inp;
      if (extra) prompt = extra;
      else if (this.data.selectedOpt) prompt = '【风格要求：' + this.data.selectedOpt + '】' + inp;
      const res = await api.generateAITool(this.data.tool.id, prompt);
      const r = res.data;
      this.setData({ output: r.output, tokens: r.tokens, latency: r.latency_ms, generating: false });
      saveHistory({ toolId: this.data.tool.id, toolName: this.data.tool.name, toolIcon: this.data.tool.icon, input: prompt, output: r.output, time: Date.now() });
    } catch {
      this.setData({ generating: false });
      wx.showToast({ title: '生成失败', icon: 'none' });
    }
  },

  reEdit(action) {
    const actions = { expand: '扩写得更详细', shorten: '缩写得更简短', formal: '改得更正式', casual: '改得更口语化', retry: '换一种表达方式' };
    const ctx = '基于以下内容，' + (actions[action] || '换一种表达方式') + '：\n' + this.data.output;
    this.setData({ input: ctx });
    this.generate(ctx);
  },

  goRelated(e) {
    const id = e.currentTarget.dataset.id;
    wx.redirectTo({ url: '/pages/tools/detail?id=' + id });
  },

  toggleFav() { const f = toggleFav(this.data.tool); this.setData({ fav: f }); wx.showToast({ title: f ? '已收藏' : '已取消', icon: 'none' }); },
  copyExample() { wx.setClipboardData({ data: this.data.tool.input_hint, success: () => wx.showToast({ title: '示例已复制' }) }); },
  copyResult() { wx.setClipboardData({ data: this.data.output, success: () => wx.showToast({ title: '已复制' }) }); },
  regenerate() { this.generate(); },

  
  onShareAppMessage() {
    const t = this.data.tool;
    return { title: '我用【' + t.name + '】生成了：' + (this.data.output || '').slice(0, 40) + '...', path: '/pages/tools/detail?id=' + t.id };
  },
});
