// ===== Budget Progress Bar =====
function renderBudgetProgress() {
    const budgetAmountEl = document.getElementById('budgetAmount');
    const progressFill = document.getElementById('progressFill');
    const budgetStatus = document.getElementById('budgetStatus');
    
    if (!budgetAmountEl || !progressFill || !budgetStatus) return;

    const income = appData.income || DEFAULT_MONTHLY_INCOME;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const expensesThisMonth = appData.expenses.filter(exp => {
        if (exp.type === 'income' || exp.type === 'savings') return false;
        if (exp.category === 'Savings') return false;
        const d = getExpenseDateValue(exp);
        if (!d) return false;
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const spent = expensesThisMonth.reduce((sum, e) => sum + (e.amount || 0), 0);
    const percentage = Math.min((spent / income) * 100, 100);
    const remaining = income - spent;

    const budgetCurrency = typeof getCurrency === 'function' ? getCurrency() : 'RSD';
    budgetAmountEl.textContent = `${spent.toLocaleString()} / ${income.toLocaleString()} ${budgetCurrency}`;
    progressFill.style.width = `${percentage}%`;

    // Color thresholds
    progressFill.classList.remove('warning', 'danger');
    const currency = typeof getCurrency === 'function' ? getCurrency() : 'RSD';
    const remainingStr = remaining.toLocaleString() + currency;
    if (percentage >= 100) {
        progressFill.classList.add('danger');
        budgetStatus.textContent = typeof t === 'function' ? t('analytics.budgetExceeded') : '⚠️ Budget exceeded!';
        budgetStatus.style.color = '#ef4444';
    } else if (percentage >= 90) {
        progressFill.classList.add('danger');
        budgetStatus.textContent = typeof t === 'function' ? t('analytics.budgetLow', [remainingStr]) : `⚠️ Only ${remainingStr} remaining`;
        budgetStatus.style.color = '#ef4444';
    } else if (percentage >= 75) {
        progressFill.classList.add('warning');
        budgetStatus.textContent = typeof t === 'function' ? t('analytics.budgetWarning', [remainingStr]) : `⚡ ${remainingStr} remaining`;
        budgetStatus.style.color = '#f59e0b';
    } else {
        budgetStatus.textContent = typeof t === 'function' ? t('analytics.budgetOk', [remainingStr]) : `✓ ${remainingStr} remaining`;
        budgetStatus.style.color = '#10b981';
    }
}

// ===== Category Pie Chart =====
let categoryChartInstance = null;

function renderCategoryChart() {
    const canvas = document.getElementById('categoryChart');
    if (!canvas) return;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const expensesThisMonth = appData.expenses.filter(exp => {
        if (exp.type === 'income' || exp.type === 'savings') return false;
        if (exp.category === 'Savings') return false;
        const d = getExpenseDateValue(exp);
        if (!d) return false;
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    // Group by category
    const categoryTotals = {};
    expensesThisMonth.forEach(exp => {
        const cat = exp.category || 'Other';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + (exp.amount || 0);
    });

    const engKeys = Object.keys(categoryTotals);
    const labels = engKeys.map(cat => typeof tCat === 'function' ? tCat(cat) : cat);
    const data = Object.values(categoryTotals);

    // Koristimo getCategoryColor funkciju za svaku kategoriju
    const colors = engKeys.map(cat => getCategoryColor(cat));

    if (categoryChartInstance) {
        categoryChartInstance.destroy();
    }

    const isDark = document.documentElement.classList.contains('dark-theme');

    // Show empty state chart when no data
    let emptyOverlay = canvas.parentElement.querySelector('.chart-empty-overlay');
    if (!emptyOverlay) {
        emptyOverlay = document.createElement('div');
        emptyOverlay.className = 'chart-empty-overlay';
        emptyOverlay.style.cssText = 'display:none;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;pointer-events:none;white-space:nowrap;';
        emptyOverlay.innerHTML = '<div style="font-size:13px;font-weight:500;"></div>';
        canvas.parentElement.style.position = 'relative';
        canvas.parentElement.appendChild(emptyOverlay);
    }

    if (labels.length === 0) {
        emptyOverlay.style.display = 'block';
        emptyOverlay.querySelector('div').textContent = 'No expenses this month';
        emptyOverlay.querySelector('div').style.color = isDark ? '#94a3b8' : '#6b7280';
        categoryChartInstance = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: [''],
                datasets: [{ data: [1], backgroundColor: [isDark ? 'rgba(255,255,255,0.22)' : '#e5e7eb'], borderWidth: 0 }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } }
            }
        });
        return;
    }

    emptyOverlay.style.display = 'none';

    categoryChartInstance = new Chart(canvas, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 2,
                borderColor: isDark ? '#0f1724' : '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: { size: 12, weight: '600' },
                        color: isDark ? '#e2e8f0' : '#333'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${context.label}: ${value.toLocaleString()} RSD (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// ===== Smart Insights =====
function renderInsights() {
    const insightsList = document.getElementById('insightsList');
    if (!insightsList) return;

    const insights = [];
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const expensesThisMonth = appData.expenses.filter(exp => {
        const d = getExpenseDateValue(exp);
        if (!d) return false;
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    // 1. Recurring subscriptions detection
    const subscriptionKeywords = ['netflix', 'spotify', 'apple', 'youtube', 'amazon', 'subscription', 'pretplata', 'monthly'];
    const subscriptions = expensesThisMonth.filter(exp => {
        const desc = (exp.description || '').toLowerCase();
        return subscriptionKeywords.some(kw => desc.includes(kw));
    });

    if (subscriptions.length > 0) {
        const totalSubs = subscriptions.reduce((sum, e) => sum + (e.amount || 0), 0);
        const subsCurrency = typeof getCurrency === 'function' ? getCurrency() : 'RSD';
        insights.push({
            icon: 'fa-repeat',
            iconClass: 'warning',
            title: typeof t === 'function' ? t('analytics.recurringTitle') : 'Recurring Subscriptions',
            description: typeof t === 'function'
                ? t('analytics.recurringDesc', [subscriptions.length, totalSubs.toLocaleString() + subsCurrency])
                : `Found ${subscriptions.length} subscription(s) costing ${totalSubs.toLocaleString()} ${subsCurrency} this month. Review to save money.`
        });
    }

    // 2. High spending category alert
    const categoryTotals = {};
    expensesThisMonth.forEach(exp => {
        if (exp.category === 'Savings') return;
        const cat = exp.category || 'Other';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + (exp.amount || 0);
    });

    const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
    if (sortedCategories.length > 0) {
        const [topCat, topAmount] = sortedCategories[0];
        const totalSpent = Object.values(categoryTotals).reduce((a, b) => a + b, 0);
        const percentage = ((topAmount / totalSpent) * 100).toFixed(0);
        
        if (percentage > 40) {
            const catCurrency = typeof getCurrency === 'function' ? getCurrency() : 'RSD';
            const topCatTr = typeof tCat === 'function' ? tCat(topCat) : topCat;
            insights.push({
                icon: 'fa-triangle-exclamation',
                iconClass: 'warning',
                title: typeof t === 'function' ? t('analytics.highSpendingTitle', [topCatTr]) : `High ${topCatTr} Spending`,
                description: typeof t === 'function'
                    ? t('analytics.highSpendingDesc', [topCatTr, percentage, topAmount.toLocaleString() + catCurrency])
                    : `${topCatTr} accounts for ${percentage}% of your spending (${topAmount.toLocaleString()} ${catCurrency}). Consider reducing expenses in this category.`
            });
        }
    }

    // 3. Budget threshold warning
    const income = appData.income || DEFAULT_MONTHLY_INCOME;
    const totalSpent = expensesThisMonth.filter(e => e.category !== 'Savings').reduce((sum, e) => sum + (e.amount || 0), 0);
    const budgetPercentage = (totalSpent / income) * 100;

    if (budgetPercentage < 50) {
        insights.push({
            icon: 'fa-circle-check',
            iconClass: 'success',
            title: typeof t === 'function' ? t('analytics.onTrackTitle') : 'On Track!',
            description: typeof t === 'function'
                ? t('analytics.onTrackDesc', [budgetPercentage.toFixed(0)])
                : `You've spent ${budgetPercentage.toFixed(0)}% of your budget. Keep up the good spending habits!`
        });
    }

    // 4. Savings suggestion
    const savingsTotal = appData.expenses.filter(e => e.category === 'Savings')
        .reduce((sum, e) => sum + (e.amount || 0), 0);

    if (savingsTotal === 0 && totalSpent < income * 0.8) {
        const saveCurrency = typeof getCurrency === 'function' ? getCurrency() : 'RSD';
        const saveAmount = ((income - totalSpent) * 0.3).toFixed(0);
        insights.push({
            icon: 'fa-piggy-bank',
            iconClass: 'success',
            title: typeof t === 'function' ? t('analytics.saveMoreTitle') : 'Save More',
            description: typeof t === 'function'
                ? t('analytics.saveMoreDesc', [saveAmount + saveCurrency])
                : `You have room in your budget. Consider moving ${saveAmount} ${saveCurrency} to savings.`
        });
    }

    // Render insights
    const isDark = document.documentElement.classList.contains('dark-theme');
    const itemBg = isDark ? 'rgba(255,255,255,0.07)' : '#f8fafc';
    const itemBorder = isDark ? '3px solid #6366f1' : '3px solid #6c63ff';
    const titleColor = isDark ? '#e2e8f0' : '#1e293b';
    const descColor = isDark ? '#94a3b8' : '#64748b';
    const iconColors = { warning: '#f59e0b', success: '#10b981', info: '#6366f1' };

    if (insights.length === 0) {
        insightsList.innerHTML = `<p style="color:${descColor};text-align:center;padding:20px;">${typeof t === 'function' ? t('analytics.noInsights') : 'No insights available yet. Add more expenses to get personalized recommendations.'}</p>`;
    } else {
        insightsList.innerHTML = insights.map(insight => {
            const iconColor = iconColors[insight.iconClass] || '#6366f1';
            return `<div style="display:flex;align-items:flex-start;gap:12px;padding:12px 14px;margin-bottom:10px;background:${itemBg};border-left:${itemBorder};border-radius:8px;">
                <div style="flex-shrink:0;width:32px;height:32px;border-radius:50%;background:${iconColor}22;display:flex;align-items:center;justify-content:center;color:${iconColor};font-size:14px;">
                    <i class="fa-solid ${insight.icon}"></i>
                </div>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:600;font-size:13px;color:${titleColor};margin-bottom:3px;">${insight.title}</div>
                    <div style="font-size:12px;color:${descColor};line-height:1.5;">${insight.description}</div>
                </div>
            </div>`;
        }).join('');
    }
}

// Refresh all analytics
function refreshAnalytics() {
    renderBudgetProgress();
    renderCategoryChart();
    renderInsights();
}

// Initialize analytics on page load
document.addEventListener('DOMContentLoaded', () => {
    refreshAnalytics();
});
