const api = require('../../utils/api');

Page({
  data: { groups: [], favorites: [], history: [], loading: true, showHistory: false },

  onShow() {
    this.loadTools();
    this.loadLocal();
  },

  async loadTools() {
    this.setData({ loading: true });
    try {
      const res = await api.getAITools();
      this.setData({ groups: res.data || [], loading: false });
    } catch {
      this.setData({ loading: false });
    }
  },

  loadLocal() {
    this.setData({
      favorites: wx.getStorageSync('ai_tool_favs') || [],
      history: (wx.getStorageSync('ai_tool_history') || []).slice(0, 20),
    });
  },

  goTool(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/tools/detail?id=' + id });
  },

  goHistory(e) {
    const item = e.currentTarget.dataset.item;
    wx.navigateTo({ url: '/pages/tools/detail?id=' + item.toolId });
  },

  clearHistory() {
    wx.showModal({
      title: '清除历史',
      content: '确定清除所有使用历史吗？',
      success: (res) => {
        if (res.confirm) { wx.removeStorageSync('ai_tool_history'); this.loadLocal(); }
      },
    });
  },

  toggleHistory() {
    this.setData({ showHistory: !this.data.showHistory });
  },
});
