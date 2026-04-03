const STORAGE_KEY = 'expense_transactions';

const CATEGORY_COLORS = {
  Food:      '#4cd964',
  Transport: '#007aff',
  Fun:       '#ff9500',
  Shopping:  '#5856d6',
  Health:    '#ff2d55',
  Other:     '#8e8e93',
};

let transactions = [];
let chartInstance = null;

function loadTransactions() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    transactions = stored ? JSON.parse(stored) : [];
  } catch (e) {
    transactions = [];
  }
}

function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function getTotalBalance() {
  return transactions.reduce((sum, t) => sum + t.amount, 0);
}

function formatCurrency(value) {
  return '$' + value.toFixed(2);
}

function renderBalance() {
  document.getElementById('totalBalance').textContent = formatCurrency(getTotalBalance());
}

function renderTransactions() {
  const list = document.getElementById('transactionList');
  if (transactions.length === 0) {
    list.innerHTML = '<p class="empty-state">No transactions yet.</p>';
    return;
  }

  list.innerHTML = transactions.map((t, i) => `
    <div class="transaction-item">
      <div class="transaction-row">
        <div>
          <div class="transaction-name">${escapeHtml(t.name)}</div>
          <div class="transaction-amount">${formatCurrency(t.amount)}</div>
          <div class="transaction-category">${t.category}</div>
        </div>
        <button class="btn-delete" onclick="deleteTransaction(${i})">Delete</button>
      </div>
    </div>
  `).join('');
}

function renderChart() {
  const ctx = document.getElementById('spendingChart').getContext('2d');

  const categoryTotals = {};
  transactions.forEach(t => {
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
  });

  const labels = Object.keys(categoryTotals);
  const data = Object.values(categoryTotals);
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
        borderColor: '#ffffff',
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

function addTransaction() {
  const nameInput = document.getElementById('itemName');
  const amountInput = document.getElementById('amount');
  const categoryInput = document.getElementById('category');

  const name = nameInput.value.trim();
  const amount = parseFloat(amountInput.value);
  const category = categoryInput.value;

  if (!name) {
    nameInput.focus();
    return;
  }
  if (isNaN(amount) || amount <= 0) {
    amountInput.focus();
    return;
  }

  transactions.unshift({ name, amount, category });
  saveTransactions();
  render();

  nameInput.value = '';
  amountInput.value = '';
  categoryInput.selectedIndex = 0;
  nameInput.focus();
}

function deleteTransaction(index) {
  transactions.splice(index, 1);
  saveTransactions();
  render();
}

function render() {
  renderBalance();
  renderTransactions();
  renderChart();
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

document.getElementById('addBtn').addEventListener('click', addTransaction);

document.getElementById('itemName').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addTransaction();
});
document.getElementById('amount').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addTransaction();
});

loadTransactions();
render();