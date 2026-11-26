const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// إنشاء مجلد البيانات لو مش موجود
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadDB() {
  try {
    if (!fs.existsSync(DB_FILE)) return { tx: [], budgets: {} };
    const p = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    return {
      tx: Array.isArray(p.tx) ? p.tx : [],
      budgets: (p.budgets && typeof p.budgets === 'object') ? p.budgets : {}
    };
  } catch (e) {
    console.warn('⚠️ فشل تحميل البيانات، إنشاء نسخة جديدة', e.message);
    return { tx: [], budgets: {} };
  }
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

let db = loadDB();

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ============ API ============

// جلب العمليات (فلترة اختيارية بالشهر)
app.get('/api/transactions', (req, res) => {
  const { month } = req.query;
  let txs = db.tx;
  if (month) txs = txs.filter(t => String(t.date).slice(0, 7) === month);
  txs = txs.slice().sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (b.id > a.id) ? 1 : -1;
  });
  res.json(txs);
});

// إضافة عملية
app.post('/api/transactions', (req, res) => {
  const { type, amount, category, note, date } = req.body || {};
  if (!['income', 'expense'].includes(type)) return res.status(400).json({ error: 'نوع غير صالح' });
  const amt = parseFloat(amount);
  if (!amt || amt <= 0) return res.status(400).json({ error: 'مبلغ غير صالح' });
  if (!category) return res.status(400).json({ error: 'الفئة مطلوبة' });
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'تاريخ غير صالح' });

  const tx = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    type,
    amount: Math.round(amt * 100) / 100,
    category: String(category).slice(0, 50),
    note: String(note || '').slice(0, 200),
    date
  };
  db.tx.push(tx);
  saveDB(db);
  res.status(201).json(tx);
});

// حذف عملية
app.delete('/api/transactions/:id', (req, res) => {
  const before = db.tx.length;
  db.tx = db.tx.filter(t => t.id !== req.params.id);
  if (db.tx.length === before) return res.status(404).json({ error: 'العملية غير موجودة' });
  saveDB(db);
  res.json({ ok: true });
});

// جلب الميزانيات
app.get('/api/budgets', (req, res) => res.json(db.budgets));

// تحديث ميزانية فئة
app.put('/api/budgets/:category', (req, res) => {
  const cat = req.params.category;
  const val = parseFloat(req.body && req.body.amount);
  if (!val || val <= 0) delete db.budgets[cat];
  else db.budgets[cat] = Math.round(val * 100) / 100;
  saveDB(db);
  res.json(db.budgets);
});

// حذف ميزانية فئة
app.delete('/api/budgets/:category', (req, res) => {
  delete db.budgets[req.params.category];
  saveDB(db);
  res.json(db.budgets);
});

// حذف كل البيانات
app.delete('/api/all', (req, res) => {
  db = { tx: [], budgets: {} };
  saveDB(db);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`✅ ميزان شغّال على http://localhost:${PORT}`);
});