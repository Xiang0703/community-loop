const api = require('../../utils/api');
const app = getApp();

const CATS = [
  { id: 1, name: '停车占位', icon: '🚗', bg: '#FFF3E0' },
  { id: 2, name: '报修', icon: '🔧', bg: '#FFEBEE' },
  { id: 3, name: '环境卫生', icon: '🌿', bg: '#E8F5E9' },
  { id: 4, name: '失物招领', icon: '📦', bg: '#E3F2FD' },
  { id: 5, name: '宠物相关', icon: '🐾', bg: '#FFF0EB' },
  { id: 6, name: '小区通知', icon: '📢', bg: '#F5F5F6' },
  { id: 7, name: '其他', icon: '💬', bg: '#E1F5FE' },
];

Component({
  properties: { show: { type: Boolean, value: false } },
  data: { categories: CATS, selectedCategory: 0, description: '', location: '', submitting: false },
  observers: { 'show': function(v) { if (v) this.reset(); } },
  methods: {
    reset() { this.setData({ selectedCategory: 0, description: '', location: '', submitting: false }); },
    selectCat(e) { this.setData({ selectedCategory: Number(e.currentTarget.dataset.id) }); },
    onInput(e) { this.setData({ description: e.detail.value }); },
    onLocInput(e) { this.setData({ location: e.detail.value }); },
    onClose() { this.triggerEvent('close'); },
    noop() {},
    async onSubmit() {
      if (!this.data.description || this.data.description.length < 10) {
        wx.showToast({ title: '描述至少10个字', icon: 'none' }); return;
      }
      this.setData({ submitting: true });
      try {
        await api.createTicket({
          community_id: app.globalData.user.community_id,
          category_id: this.data.selectedCategory || undefined,
          description: this.data.description,
          location_desc: this.data.location,
        });
        wx.showToast({ title: '提交成功', icon: 'success' });
        this.triggerEvent('success');
      } catch { wx.showToast({ title: '提交失败', icon: 'none' }); }
      this.setData({ submitting: false });
    },
  },
});
