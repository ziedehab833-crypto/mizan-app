/**
 * db.js — طبقة قاعدة البيانات
 * بتلف كل عمليات القراءة والكتابة على data/db.json
 * وبتدي واجهة نظيفة لـ server.js
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

/* ============ تهيئة ============ */
function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function emptyDB() {
  return { tx: [], budgets: {} };
}

/* ============ قراءة/كتابة ============ */
let cache = null; // كاش في الذاكرة لتقليل قراءة القرص

function readDB() {
  if (cache) return cache;
  ensureDir();

  if (!fs.existsSync(DB_FILE)) {
    cache = emptyDB();
    writeDB(cache);
    return cache;
  }

  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const p = JSON.parse(raw);
    cache = {
      tx: Array.isArray(p.tx) ? p.tx : [],
      budgets: (p.budgets && typeof p.budgets === 'object' && !Array.isArray(p.budgets))
        ? p.budgets
        : {}
    };
  } catch (e) {
    console.warn('⚠️ db.json تالف، إنشاء نسخة جديدة:', e.message);
    // نحتفظ بنسخة احتياطية من الملف التالف
    try {
      const backup = `${DB_FILE}.corrupt-${Date.now()}`;
      fs.copyFileSync(DB_FILE, backup);
      console.warn('   تم حفظ نسخة احتياطية في:', backup);
    } catch {}
    cache = emptyDB();
    writeDB(cache);
  }
  return cache;
}

function writeDB(db) {
  ensureDir();
  // كتابة آمنة: نكتب على ملف مؤقت ثم نستبدل
  const tmp = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmp, DB_FILE);
  cache = db;
}

/* ============ العمليات (Transactions) ============ */
function getTransactions(month) {
  const db = readDB();
  let txs = db.tx;
  if (month) {
    txs = txs.filter(t => String(t.date).slice(0, 7) === month);
  }
  return txs.slice().sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (b.id > a.id) ? 1 : -1;
  });
}

function addTransaction({ type, amount, category, note, date }) {
  const db = readDB();

  const tx = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    type,
    amount: Math.round(parseFloat(amount) * 100) / 100,
    category: String(category).slice(0, 50),
    note: String(note || '').slice(0, 200),
    date
  };

  db.tx.push(tx);
  writeDB(db);
  return tx;
}

function deleteTransaction(id) {
  const db = readDB();
  const before = db.tx.length;
  db.tx = db.tx.filter(t => t.id !== id);
  if (db.tx.length === before) return false;
  writeDB(db);
  return true;
}

/* ============ الميزانيات (Budgets) ============ */
function getBudgets() {
  return { ...readDB().budgets };
}

function setBudget(category, amount) {
  const db = readDB();
  const val = parseFloat(amount);

  if (!val || val <= 0) {
    delete db.budgets[category];
  } else {
    db.budgets[category] = Math.round(val * 100) / 100;
  }

  writeDB(db);
  return { ...db.budgets };
}

function deleteBudget(category) {
  const db = readDB();
  delete db.budgets[category];
  writeDB(db);
  return { ...db.budgets };
}

/* ============ حذف الكل ============ */
function clearAll() {
  writeDB(emptyDB());
}

/* ============ تصدير ============ */
module.exports = {
  // عام
  readDB,
  // العمليات
  getTransactions,
  addTransaction,
  deleteTransaction,
  // الميزانيات
  getBudgets,
  setBudget,
  deleteBudget,
  // الكل
  clearAll,
  // مسار الملف (للdebug)
  DB_FILE
};