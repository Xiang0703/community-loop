Component({
  properties: { categories: { type: Array, value: [] }, selected: { type: Number, value: 0 } },
  methods: {
    select(e) { this.triggerEvent('select', { id: Number(e.currentTarget.dataset.id) }); },
  },
});
