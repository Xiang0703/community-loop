Component({
  properties: { ticket: { type: Object, value: {} } },
  methods: {
    timeAgo(d) {
      if (!d) return '';
      const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
      if (s < 60) return '刚刚';
      if (s < 3600) return Math.floor(s/60) + '分钟前';
      if (s < 86400) return Math.floor(s/3600) + '小时前';
      if (s < 604800) return Math.floor(s/86400) + '天前';
      return d.slice(0,10);
    }
  }
});
