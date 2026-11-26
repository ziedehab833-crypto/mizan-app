/* ============ الثوابت ============ */
const CATS = {
  expense: [
    {n:'طعام وشراب', i:'🍔'}, {n:'مواصلات', i:'🚗'}, {n:'فواتير', i:'🧾'},
    {n:'سكن وإيجار', i:'🏠'}, {n:'صحة', i:'💊'}, {n:'تعليم', i:'📚'},
    {n:'ترفيه', i:'🎮'}, {n:'ملابس', i:'👕'}, {n:'تسوق', i:'🛍️'}, {n:'أخرى', i:'📦'}
  ],
  income: [
    {n:'راتب', i:'💼'}, {n:'عمل حر', i:'💻'}, {n:'استثمار', i:'📈'},
    {n:'هدية', i:'🎁'}, {n:'أخرى', i:'➕'}
  ]
};

const PALETTE = ['#6366f1','#22c55e','#f59e0b','#ef4444','#06b6d4','#a855f7','#ec4899','#84cc16','#f97316','#14b8a6'];

/* ============ الحالة ============ */
const state = {
  tx: [],
  budgets: {},
  month: '',
  type: 'expense'
};

/* ============ أدوات مساعدة ============ */
function ymOf(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
function todayStr(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function iconOf(cat){
  for (const k in CATS){
    const f = CATS[k].find(c => c.n === cat);
    if (f) return f.i;
  }
  return '📦';
}
function fmtDate(s){
  try { return new Date(s + 'T00:00:00').toLocaleDateString('ar-EG-u-nu-latn', {day:'numeric', month:'short'}); }
  catch { return s; }
}
const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
function money(n){ return nf.format(Math.round(n * 100) / 100); }
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

let toastTimer;
function toast(msg, isErr = false){
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.toggle('err', isErr);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/* ============ تحميل البيانات ============ */
async function loadData(){
  try {
    const [tx, budgets] = await Promise.all([
      API.getTransactions(state.month),
      API.getBudgets()
    ]);
    state.tx = tx;
    state.budgets = budgets;
  } catch (e) {
    toast('خطأ في التحميل: ' + e.message, true);
  }
}

async function refresh(){
  await loadData();
  render();
}

/* ============ الرسم ============ */
function renderStats(){
  const income  = state.tx.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0);
  const expense = state.tx.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0);
  const balance = income - expense;
  const rate = income > 0 ? Math.round((income - expense) / income * 100) : 0;

  const bEl = document.getElementById('sBalance');
  bEl.innerHTML = `${money(balance)} <small>ج.م</small>`;
  bEl.style.color = balance < 0 ? 'var(--red)' : 'var(--txt)';

  document.getElementById('sIncome').innerHTML  = `${money(income)} <small>ج.م</small>`;
  document.getElementById('sExpense').innerHTML = `${money(expense)} <small>ج.م</small>`;

  const sEl = document.getElementById('sSave');
  sEl.innerHTML = `${rate}<small>%</small>`;
  sEl.style.color = rate < 0 ? 'var(--red)' : (rate >= 20 ? 'var(--green)' : 'var(--gold)');
}

function renderChart(){
  const canvas = document.getElementById('chart');
  const totals = {};
  state.tx.filter(t => t.type === 'expense')
    .forEach(t => totals[t.category] = (totals[t.category] || 0) + t.amount);

  const entries = Object.entries(totals).sort((a,b) => b[1] - a[1]);
  const total = entries.reduce((s,e) => s + e[1], 0);

  const dpr = window.devicePixelRatio || 1;
  const size = canvas.clientWidth || 190;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);

  const cx = size/2, cy = size/2, R = size/2 - 6, thick = size * 0.16;

  if (total === 0){
    ctx.beginPath();
    ctx.arc(cx, cy, R - thick/2, 0, Math.PI*2);
    ctx.strokeStyle = '#2a3448';
    ctx.lineWidth = thick;
    ctx.stroke();
    ctx.fillStyle = '#8b97ad';
    ctx.font = '600 12px Segoe UI, Tahoma';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('لا توجد بيانات', cx, cy);
  } else {
    let start = -Math.PI/2;
    entries.forEach(([_, val], i) => {
      const angle = (val / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, R - thick/2, start, start + angle);
      ctx.strokeStyle = PALETTE[i % PALETTE.length];
      ctx.lineWidth = thick;
      ctx.lineCap = 'butt';
      ctx.stroke();
      start += angle;
    });
    ctx.fillStyle = '#e8edf7';
    ctx.font = '700 15px Segoe UI, Tahoma';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(money(total), cx, cy - 7);
    ctx.fillStyle = '#8b97ad';
    ctx.font = '500 10.5px Segoe UI, Tahoma';
    ctx.fillText('إجمالي المصروف', cx, cy + 11);
  }

  const lg = document.getElementById('legend');
  if (!entries.length){
    lg.innerHTML = '<div class="empty" style="padding:8px">أضف مصروفاتك لتظهر النسب</div>';
    return;
  }
  lg.innerHTML = entries.map(([name, val], i) => `
    <div class="lg">
      <span class="dot" style="background:${PALETTE[i % PALETTE.length]}"></span>
      <span class="nm">${iconOf(name)} ${name}</span>
      <span class="vl">${money(val)} · ${Math.round(val/total*100)}%</span>
    </div>`).join('');
}

function renderBudgets(){
  const spent = {};
  state.tx.filter(t => t.type === 'expense')
    .forEach(t => spent[t.category] = (spent[t.category] || 0) + t.amount);

  const rows = CATS.expense
    .map(c => c.n)
    .filter(c => (state.budgets[c] || 0) > 0 || spent[c] > 0);

  const box = document.getElementById('budgets');
  if (!rows.length){
    box.innerHTML = '<div class="empty"><span class="e">🎯</span>حدّد ميزانية لأي فئة عشان تتابع صرفك فيها</div>';
    return;
  }

  box.innerHTML = rows.map(cat => {
    const budget = state.budgets[cat] || 0;
    const used = spent[cat] || 0;
    const pct = budget > 0 ? Math.min(used / budget * 100, 100) : 0;
    const over = budget > 0 && used > budget;
    const color = over ? 'var(--red)' : (pct >= 75 ? 'var(--gold)' : 'var(--green)');

    return `
      <div class="brow">
        <div class="btop">
          <span class="bname">${iconOf(cat)} ${cat}</span>
          <span class="bnum ${over ? 'over' : ''}">
            صُرف ${money(used)} من
            <input class="binput" type="number" min="0" step="1"
                   data-cat="${cat}" value="${budget || ''}" placeholder="0">
            ج.م
          </span>
        </div>
        <div class="bar">
          <div class="fill" style="width:${pct}%;background:${color}"></div>
        </div>
      </div>`;
  }).join('');
}

function renderList(){
  const txs = state.tx;
  document.getElementById('count').textContent = `${txs.length} عملية`;
  const box = document.getElementById('list');

  if (!txs.length){
    box.innerHTML = '<div class="empty"><span class="e">🧾</span>لا توجد عمليات لهذا الشهر</div>';
    return;
  }

  box.innerHTML = txs.map(t => {
    const isIn = t.type === 'income';
    const title = t.note ? t.note : t.category;
    return `
      <div class="item">
        <div class="ico">${iconOf(t.category)}</div>
        <div class="info">
          <div class="t1">${escapeHtml(title)}</div>
          <div class="t2">${t.category} · ${fmtDate(t.date)}</div>
        </div>
        <div class="amt ${isIn ? 'in' : 'out'}">${isIn ? '+' : '−'}${money(t.amount)}</div>
        <button class="del" data-id="${t.id}" title="حذف">✕</button>
      </div>`;
  }).join('');
}

function render(){
  renderStats();
  renderChart();
  renderBudgets();
  renderList();
}

/* ============ واجهة ============ */
function fillCategories(){
  const sel = document.getElementById('fCategory');
  sel.innerHTML = CATS[state.type].map(c => `<option value="${c.n}">${c.i} ${c.n}</option>`).join('');
}

/* ============ الأحداث ============ */
function initEvents(){
  const monthPicker = document.getElementById('monthPicker');

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      state.type = tab.dataset.type;
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      fillCategories();
    });
  });

  document.getElementById('txForm').addEventListener('submit', async e => {
    e.preventDefault();
    const amountEl = document.getElementById('fAmount');
    const amount = parseFloat(amountEl.value);
    if (!amount || amount <= 0) return amountEl.focus();

    const tx = {
      type: state.type,
      amount,
      category: document.getElementById('fCategory').value,
      note: document.getElementById('fNote').value.trim(),
      date: document.getElementById('fDate').value || todayStr()
    };

    try {
      await API.addTransaction(tx);
      const m = tx.date.slice(0, 7);
      if (m !== state.month){
        state.month = m;
        monthPicker.value = m;
      }
      amountEl.value = '';
      document.getElementById('fNote').value = '';
      await refresh();
      amountEl.focus();
      toast('تمت الإضافة ✓');
    } catch (e) {
      toast(e.message, true);
    }
  });

  monthPicker.addEventListener('change', async e => {
    if (!e.target.value) return;
    state.month = e.target.value;
    await refresh();
  });

  document.getElementById('list').addEventListener('click', async e => {
    const btn = e.target.closest('.del');
    if (!btn) return;
    try {
      await API.deleteTransaction(btn.dataset.id);
      await refresh();
      toast('تم الحذف');
    } catch (e) {
      toast(e.message, true);
    }
  });

  document.getElementById('budgets').addEventListener('change', async e => {
    const input = e.target.closest('.binput');
    if (!input) return;
    const cat = input.dataset.cat;
    const val = parseFloat(input.value);
    try {
      if (!val || val <= 0) await API.deleteBudget(cat);
      else await API.setBudget(cat, val);
      state.budgets = await API.getBudgets();
      renderBudgets();
      toast('تم تحديث الميزانية ✓');
    } catch (e) {
      toast(e.message, true);
    }
  });

  document.getElementById('clearAll').addEventListener('click', async () => {
    if (!confirm('متأكد إنك عايز تحذف كل البيانات؟ مش هينفع ترجعها.')) return;
    try {
      await API.clearAll();
      await refresh();
      toast('تم حذف كل البيانات');
    } catch (e) {
      toast(e.message, true);
    }
  });

  let rz;
  window.addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(renderChart, 150);
  });
}

/* ============ التشغيل ============ */
async function init(){
  state.month = ymOf(new Date());
  document.getElementById('monthPicker').value = state.month;
  document.getElementById('fDate').value = todayStr();
  fillCategories();
  initEvents();
  await refresh();
}

init();