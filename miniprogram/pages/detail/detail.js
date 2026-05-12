const api = require('../../utils/api');
const app = getApp();

Page({
  data: { ticket: null, comments: [], logs: [], commentText: '', isOwner: false },
  onLoad(opts) {
    if (opts.id) this.loadDetail(opts.id);
  },
  async loadDetail(id) {
    try {
      const res = await api.getTicket(id);
      const d = res.data;
      this.setData({
        ticket: d, comments: d.comments || [], logs: d.logs || [],
        isOwner: d.user_id === app.globalData.user?.id,
      });
    } catch { wx.showToast({ title: '加载失败', icon: 'none' }); }
  },
  onInput(e) { this.setData({ commentText: e.detail.value }); },
  async sendComment() {
    const txt = this.data.commentText.trim();
    if (!txt) return;
    try {
      await api.addComment(this.data.ticket.id, txt);
      this.setData({ commentText: '' });
      this.loadDetail(this.data.ticket.id);
    } catch { wx.showToast({ title: '评论失败', icon: 'none' }); }
  },
  async resolveTicket() {
    wx.showModal({
      title: '确认解决？',
      content: '确定将此问题标记为已解决吗？',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await api.resolveTicket(this.data.ticket.id);
          this.loadDetail(this.data.ticket.id);
        } catch { wx.showToast({ title: '操作失败', icon: 'none' }); }
      },
    });
  },
  statusText(s) {
    const map = { open: '待处理', processing: '处理中', resolved: '已解决', closed: '已关闭' };
    return map[s] || s;
  },
});
