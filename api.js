/* طبقة الاتصال بالسيرفر */
const API = {
  async request(url, options = {}) {
    const r = await fetch(url, options);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `خطأ ${r.status}`);
    return data;
  },

  getTransactions(month) {
    const q = month ? `?month=${encodeURIComponent(month)}` : '';
    return this.request(`/api/transactions${q}`);
  },

  addTransaction(tx) {
    return this.request('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tx)
    });
  },

  deleteTransaction(id) {
    return this.request(`/api/transactions/${id}`, { method: 'DELETE' });
  },

  getBudgets() {
    return this.request('/api/budgets');
  },

  setBudget(category, amount) {
    return this.request(`/api/budgets/${encodeURIComponent(category)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount })
    });
  },

  deleteBudget(category) {
    return this.request(`/api/budgets/${encodeURIComponent(category)}`, { method: 'DELETE' });
  },

  clearAll() {
    return this.request('/api/all', { method: 'DELETE' });
  }
};