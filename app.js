const STORAGE_KEY  = 'expense_transactions';
const THEME_KEY    = 'expense_theme';
const LIMIT_KEY    = 'expense_limit';

const CATEGORY_COLORS = {
  Food:      '#4cd964',
  Transport: '#007aff',
  Fun:       '#ff9500',
  Shopping:  '#5856d6',
  Health:    '#ff2d55',
  Other:     '#8e8e93',
};

let transactions  = [];
let chartInstance = null;

// ── Current month offset for monthly view (0 = this month, -1 = last month …)
let monthOffset = 0;

// ────────────────────────────────────────────────
// Persistence
// ────────────────────────────────────────────────

function loadTransactions() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    transactions = stored ? JSON.parse(stored) : [];
    // ensure every transaction has a date
    transactions = transactions.map(t => ({
      ...t,
      date: t.date || new Date().toISOString()
    }));
  } catch (e) {
    transactions = [];
  }
}

function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

// ────────────────────────────────────────────────
// Dark / Light Mode
// ────────────────────────────────────────────────

function loadTheme() {
  if (localStorage.getItem(THEME_KEY) === 'dark') {
    document.body.classList.add('dark');
  }
}

function toggleTheme() {
  document.body.classList.toggle('dark');
  localStorage.setItem(THEME_KEY, document.body.classList.contains('dark') ? 'dark' : 'light');
  // Re-render chart so colours stay correct
  renderChart();
}

document.getElementById('themeToggle').addEventListener('click', toggleTheme);

// ────────────────────────────────────────────────
// Spending Limit
// ────────────────────────────────────────────────

function getLimit() {
  const val = parseFloat(document.getElementById('spendLimit').value);
  return isNaN(val) || val <= 0 ? null : val;
}

function isOverLimit(amount) {
  const limit = getLimit();
  return limit !== null && amount > limit;
}

function updateLimitStatus() {
  const statusEl = document.getElementById('limitStatus');
  const limit = getLimit();
  if (limit === null) {
    statusEl.style.display = 'none';
    return;
  }
  const total = getTotalBalance();
  statusEl.style.display = 'inline-block';
  if (total > limit) {
    statusEl.textContent = '⚠ Over limit';
    statusEl.className = 'limit-status over';
  } else {
    statusEl.textContent = '✓ Within limit';
    statusEl.className = 'limit-status ok';
  }
}

document.getElementById('spendLimit').addEventListener('input', () => {
  localStorage.setItem(LIMIT_KEY, document.getElementById('spendLimit').value);
  updateLimitStatus();
  renderTransactions();
});

function loadLimit() {
  const saved = localStorage.getItem(LIMIT_KEY);
  if (saved) document.getElementById('spendLimit').value = saved;
}

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────

function getTotalBalance() {
  return transactions.reduce((sum, t) => sum + t.amount, 0);
}

function formatCurrency(value) {
  return '$' + value.toFixed(2);
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ────────────────────────────────────────────────
// Render: Balance
// ────────────────────────────────────────────────

function renderBalance() {
  document.getElementById('totalBalance').textContent = formatCurrency(getTotalBalance());
  updateLimitStatus();
}

// ────────────────────────────────────────────────
// Render: Transactions list
// ────────────────────────────────────────────────

function renderTransactions() {
  const list = document.getElementById('transactionList');
  if (transactions.length === 0) {
    list.innerHTML = '<p class="empty-state">No transactions yet.</p>';
    return;
  }

  list.innerHTML = transactions.map((t, i) => {
    const over  = isOverLimit(t.amount);
    const cls   = over ? ' over-limit' : '';
    const badge = over ? '<span class="over-limit-badge">OVER LIMIT</span>' : '';
    return `
      <div class="transaction-item${cls}">
        <div class="transaction-row">
          <div>
            <div class="transaction-name">${escapeHtml(t.name)}${badge}</div>
            <div class="transaction-amount">${formatCurrency(t.amount)}</div>
            <div class="transaction-category">${t.category}</div>
          </div>
          <button class="btn-delete" onclick="deleteTransaction(${i})">Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

// ────────────────────────────────────────────────
// Render: Pie Chart
// ────────────────────────────────────────────────

function renderChart() {
  const ctx = document.getElementById('spendingChart').getContext('2d');

  const categoryTotals = {};
  transactions.forEach(t => {
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
  });

  const labels = Object.keys(categoryTotals);
  const data   = Object.values(categoryTotals);
  const colors = labels.map(l => CATEGORY_COLORS[l] || '#8e8e93');

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  if (labels.length === 0) {
    document.getElementById('chartLegend').innerHTML = '';
    return;
  }

  chartInstance = new Chart(ctx, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: document.body.classList.contains('dark') ? '#2c2c2e' : '#ffffff',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${formatCurrency(ctx.parsed)}`
          }
        }
      }
    }
  });

  document.getElementById('chartLegend').innerHTML = labels.map((l, i) => `
    <span class="legend-item">
      <span class="legend-dot" style="background:${colors[i]}"></span>${l}
    </span>
  `).join('');
}

// ────────────────────────────────────────────────
// Add / Delete
// ────────────────────────────────────────────────

function addTransaction() {
  const nameInput     = document.getElementById('itemName');
  const amountInput   = document.getElementById('amount');
  const categoryInput = document.getElementById('category');

  const name     = nameInput.value.trim();
  const amount   = parseFloat(amountInput.value);
  const category = categoryInput.value;

  if (!name)                    { nameInput.focus();   return; }
  if (isNaN(amount) || amount <= 0) { amountInput.focus(); return; }

  transactions.unshift({ name, amount, category, date: new Date().toISOString() });
  saveTransactions();
  render();

  nameInput.value        = '';
  amountInput.value      = '';
  categoryInput.selectedIndex = 0;
  nameInput.focus();
}

function deleteTransaction(index) {
  transactions.splice(index, 1);
  saveTransactions();
  render();
}

// ────────────────────────────────────────────────
// Tab Switching
// ────────────────────────────────────────────────

function switchTab(tab) {
  const isTransactions = tab === 'transactions';
  document.getElementById('viewTransactions').style.display = isTransactions ? '' : 'none';
  document.getElementById('viewMonthly').style.display      = isTransactions ? 'none' : '';
  document.getElementById('tabTransactions').classList.toggle('active', isTransactions);
  document.getElementById('tabMonthly').classList.toggle('active', !isTransactions);
  if (!isTransactions) renderMonthlySummary();
}
window.switchTab = switchTab;
// ────────────────────────────────────────────────
// Monthly Summary
// ────────────────────────────────────────────────

function getMonthlyTransactions(offset) {
  const now     = new Date();
  const year    = now.getFullYear();
  const month   = now.getMonth() + offset;   // JS handles overflow/underflow
  const target  = new Date(year, month, 1);
  const tYear   = target.getFullYear();
  const tMonth  = target.getMonth();

  return transactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === tYear && d.getMonth() === tMonth;
  });
}

function renderMonthlySummary() {
  // Label
  const now   = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const label  = target.toLocaleString('default', { month: 'long', year: 'numeric' });
  document.getElementById('monthLabel').textContent = label;

  // Disable "next" if we're already at current month
  document.getElementById('nextMonth').disabled = monthOffset >= 0;
  document.getElementById('nextMonth').style.opacity = monthOffset >= 0 ? '0.3' : '1';

  const monthly = getMonthlyTransactions(monthOffset);
  const limit   = getLimit();

  // Stats
  const total   = monthly.reduce((s, t) => s + t.amount, 0);
  const overCnt = limit ? monthly.filter(t => t.amount > limit).length : 0;

  document.getElementById('statCount').textContent = monthly.length;
  document.getElementById('statTotal').textContent = formatCurrency(total);
  document.getElementById('statOver').textContent  = overCnt;

  // Category breakdown
  const breakdown = document.getElementById('monthBreakdown');
  if (monthly.length === 0) {
    breakdown.innerHTML = '<p class="no-data">No transactions this month.</p>';
    return;
  }

  const catTotals = {};
  monthly.forEach(t => {
    catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
  });

  const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  const max    = sorted[0][1];

  breakdown.innerHTML = sorted.map(([cat, val]) => {
    const pct   = max > 0 ? (val / max * 100).toFixed(1) : 0;
    const color = CATEGORY_COLORS[cat] || '#8e8e93';
    return `
      <div class="breakdown-row">
        <span class="breakdown-cat">${cat}</span>
        <div class="breakdown-bar-wrap">
          <div class="breakdown-bar" style="width:${pct}%; background:${color}"></div>
        </div>
        <span class="breakdown-val">${formatCurrency(val)}</span>
      </div>
    `;
  }).join('');
}

document.getElementById('prevMonth').addEventListener('click', () => {
  monthOffset--;
  renderMonthlySummary();
});

document.getElementById('nextMonth').addEventListener('click', () => {
  if (monthOffset < 0) { monthOffset++; renderMonthlySummary(); }
});

// ────────────────────────────────────────────────
// Main render
// ────────────────────────────────────────────────

function render() {
  renderBalance();
  renderTransactions();
  renderChart();
}

// ────────────────────────────────────────────────
// Event listeners
// ────────────────────────────────────────────────

document.getElementById('addBtn').addEventListener('click', addTransaction);

document.getElementById('itemName').addEventListener('keydown', e => {
  if (e.key === 'Enter') addTransaction();
});
document.getElementById('amount').addEventListener('keydown', e => {
  if (e.key === 'Enter') addTransaction();
});

// ────────────────────────────────────────────────
// Boot
// ────────────────────────────────────────────────

loadTheme();
loadTransactions();
loadLimit();
render();
