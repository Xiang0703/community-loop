App({
  onLaunch() {
    this.checkLogin();
  },

  globalData: {
    token: '',
    user: null,
    community: null,
    unreadCount: 0,
  },

  checkLogin() {
    const token = wx.getStorageSync('token');
    const user = wx.getStorageSync('user');
    if (token && user) {
      this.globalData.token = token;
      this.globalData.user = user;
    }
  },

  setSession(token, user) {
    this.globalData.token = token;
    this.globalData.user = user;
    wx.setStorageSync('token', token);
    wx.setStorageSync('user', user);
  },

  clearSession() {
    this.globalData.token = '';
    this.globalData.user = null;
    wx.removeStorageSync('token');
    wx.removeStorageSync('user');
  },

  isLoggedIn() {
    return !!this.globalData.token;
  },
});
