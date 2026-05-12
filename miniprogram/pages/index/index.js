const app = getApp();
const api = require('../../utils/api');

const CATEGORIES = [
  { id: null, name: '全部', icon: '' },
  { id: 1, name: '停车', icon: '🚗' },
  { id: 2, name: '报修', icon: '🔧' },
  { id: 3, name: '环境', icon: '🌿' },
  { id: 4, name: '失物', icon: '📦' },
  { id: 5, name: '宠物', icon: '🐾' },
  { id: 6, name: '通知', icon: '📢' },
  { id: 7, name: '其他', icon: '💬' },
];

Page({
  data: {
    categories: CATEGORIES,
    activeCategory: 0,
    tickets: [],
    loading: true,
    showSubmit: false,
    communityName: '选择小区',
  },

  onLoad() {
    if (!app.isLoggedIn()) {
      this.doLogin();
    } else {
      this.loadTickets();
    }
  },

  onPullDownRefresh() {
    this.loadTickets().then(() => wx.stopPullDownRefresh());
  },

  async doLogin() {
    try {
      const { code } = await wx.login();
      const res = await api.login(code);
      app.setSession(res.token, res.user);
      this.loadTickets();
    } catch {
      wx.showToast({ title: '登录失败', icon: 'none' });
    }
  },

  async loadTickets() {
    this.setData({ loading: true });
    try {
      const cid = app.globalData.user?.community_id;
      const params = { community_id: cid, limit: 30 };
      if (this.data.activeCategory > 0) params.category_id = this.data.activeCategory;
      const res = await api.getTickets(params);
      this.setData({ tickets: res.data || [], loading: false });
    } catch {
      this.setData({ loading: false });
    }
  },

  switchCategory(e) {
    const idx = e.currentTarget.dataset.index;
    this.setData({ activeCategory: idx });
    this.loadTickets();
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id || e.detail?.id;
    if (id) wx.navigateTo({ url: '/pages/detail/detail?id=' + id });
  },

  openSubmit() {
    if (!app.globalData.user?.community_id) {
      wx.showToast({ title: '请先选择小区', icon: 'none' });
      return;
    }
    this.setData({ showSubmit: true });
  },

  closeSubmit() { this.setData({ showSubmit: false }); },
  onSubmitSuccess() {
    this.setData({ showSubmit: false });
    this.loadTickets();
  },
});
