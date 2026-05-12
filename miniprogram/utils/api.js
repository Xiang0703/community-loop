const app = getApp();
const BASE = 'http://localhost:3001/api';

function request(url, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const header = { 'Content-Type': 'application/json' };
    const token = app.globalData.token;
    if (token) header.Authorization = 'Bearer ' + token;

    wx.request({
      url: BASE + url, method, header, data,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else if (res.statusCode === 401) {
          app.clearSession();
          wx.reLaunch({ url: '/pages/index/index' });
          reject(new Error('登录已过期'));
        } else {
          reject(new Error(res.data?.error || '请求失败'));
        }
      },
      fail(err) { reject(new Error('网络请求失败')); },
    });
  });
}

function buildQuery(params) {
  const qs = [];
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && v !== '') qs.push(k + '=' + encodeURIComponent(v));
  }
  return qs.join('&');
}

module.exports = {
  // AI 工具箱
  getAITools: () => request('/ai-tools'),
  getAITool: (id) => request('/ai-tools/' + id),
  generateAITool: (id, input) => request('/ai-tools/' + id + '/generate', 'POST', { input }),

  login: (code, cid) => request('/auth/login', 'POST', { code, community_id: cid }),
  updateProfile: (data) => request('/auth/profile', 'PUT', data),
  getTickets: (p) => request('/tickets?' + buildQuery(p)),
  getTicket: (id) => request('/tickets/' + id),
  createTicket: (data) => request('/tickets', 'POST', data),
  resolveTicket: (id) => request('/tickets/' + id + '/resolve', 'PUT'),
  addComment: (id, content) => request('/tickets/' + id + '/comments', 'POST', { content }),
  getMyTickets: (p) => request('/tickets/mine/list?' + buildQuery(p)),
  getNotifications: (p) => request('/notifications?' + buildQuery(p)),
  readAll: () => request('/notifications/read-all', 'PUT'),
  getUnreadCount: () => request('/notifications/unread-count'),
};
