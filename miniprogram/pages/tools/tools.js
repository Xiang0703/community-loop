const api = require('../../utils/api');

Page({
  data: { groups: [], loading: true },

  onShow() {
    this.loadTools();
  },

  async loadTools() {
    this.setData({ loading: true });
    try {
      const res = await api.getAITools();
      this.setData({ groups: res.data || [], loading: false });
    } catch {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  goTool(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/tools/detail?id=' + id });
  },
});
