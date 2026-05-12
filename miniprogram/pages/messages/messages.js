const api = require('../../utils/api');

Page({
  data: { notifications: [], unreadCount: 0 },
  onShow() { this.loadData(); },
  async loadData() {
    try {
      const res = await api.getNotifications({ limit: 50 });
      this.setData({ notifications: res.data || [], unreadCount: res.unreadCount || 0 });
    } catch {}
  },
  async readAll() {
    try {
      await api.readAll();
      this.setData({ unreadCount: 0 });
      this.loadData();
    } catch {}
  },
  goTicket(e) {
    const id = e.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: '/pages/detail/detail?id=' + id });
  },
});
