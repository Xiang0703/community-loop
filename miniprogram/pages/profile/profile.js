const api = require('../../utils/api');
const app = getApp();

Page({
  data: { user: null, myTickets: [], submittedCount: 0, resolvedCount: 0 },
  onShow() {
    const user = app.globalData.user;
    this.setData({ user });
    if (user) this.loadMyTickets();
  },
  async loadMyTickets() {
    try {
      const res = await api.getMyTickets({ limit: 3 });
      this.setData({ myTickets: res.data || [] });
      const all = await api.getMyTickets({ limit: 100 });
      const tickets = all.data || [];
      this.setData({
        submittedCount: tickets.length,
        resolvedCount: tickets.filter(t => t.status === 'resolved').length,
      });
    } catch {}
  },
  goDetail(e) { wx.navigateTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id }); },
  goMyTickets() { wx.showToast({ title: '全部工单', icon: 'none' }); },
  async doLogin() {
    try {
      const { code } = await wx.login();
      const res = await api.login(code);
      app.setSession(res.token, res.user);
      this.setData({ user: res.user });
      this.loadMyTickets();
    } catch { wx.showToast({ title: '登录失败', icon: 'none' }); }
  },
});
