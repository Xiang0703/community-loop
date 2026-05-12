const api = require('../../utils/api');

Page({
  data: {
    tool: null, input: '', output: '', generating: false, tokens: null, latency: null
  },

  onLoad(opts) {
    if (opts.id) this.loadTool(opts.id);
  },

  async loadTool(id) {
    try {
      const res = await api.getAITool(id);
      this.setData({ tool: res.data });
      wx.setNavigationBarTitle({ title: res.data.name });
    } catch { wx.showToast({ title: '加载失败', icon: 'none' }); }
  },

  onInput(e) { this.setData({ input: e.detail.value }); },

  async generate() {
    if (!this.data.input || this.data.input.length < 2) {
      wx.showToast({ title: '请输入内容', icon: 'none' }); return;
    }
    this.setData({ generating: true, output: '' });
    try {
      const res = await api.generateAITool(this.data.tool.id, this.data.input);
      this.setData({
        output: res.data.output,
        tokens: res.data.tokens,
        latency: res.data.latency_ms,
        generating: false,
      });
    } catch {
      this.setData({ generating: false });
      wx.showToast({ title: '生成失败，请重试', icon: 'none' });
    }
  },

  copyResult() {
    wx.setClipboardData({ data: this.data.output, success: () => wx.showToast({ title: '已复制' }) });
  },

  regenerate() { this.generate(); },
});
