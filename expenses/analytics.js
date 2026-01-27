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
        if (exp.category === 'Savings') return false;
        const d = getExpenseDateValue(exp);
        if (!d) return false;
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const spent = expensesThisMonth.reduce((sum, e) => sum + (e.amount || 0), 0);
    const percentage = Math.min((spent / income) * 100, 100);
    const remaining = income - spent;

    budgetAmountEl.textContent = `${spent.toLocaleString()} / ${income.toLocaleString()} RSD`;
    progressFill.style.width = `${percentage}%`;

    // Color thresholds
    progressFill.classList.remove('warning', 'danger');
    if (percentage >= 100) {
        progressFill.classList.add('danger');
        budgetStatus.textContent = '⚠️ Budget exceeded!';
        budgetStatus.style.color = '#ef4444';
    } else if (percentage >= 90) {
        progressFill.classList.add('danger');
        budgetStatus.textContent = `⚠️ Only ${remaining.toLocaleString()} RSD remaining`;
        budgetStatus.style.color = '#ef4444';
    } else if (percentage >= 75) {
        progressFill.classList.add('warning');
        budgetStatus.textContent = `⚡ ${remaining.toLocaleString()} RSD remaining`;
        budgetStatus.style.color = '#f59e0b';
    } else {
        budgetStatus.textContent = `✓ ${remaining.toLocaleString()} RSD remaining`;
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

    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);
    
    // Koristimo getCategoryColor funkciju za svaku kategoriju
    const colors = labels.map(cat => getCategoryColor(cat));

    if (categoryChartInstance) {
        categoryChartInstance.destroy();
    }

    if (labels.length === 0) {
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    categoryChartInstance = new Chart(canvas, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 2,
                borderColor: '#fff'
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
                        color: '#333'
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
        insights.push({
            icon: 'fa-repeat',
            iconClass: 'warning',
            title: 'Recurring Subscriptions',
            description: `Found ${subscriptions.length} subscription(s) costing ${totalSubs.toLocaleString()} RSD this month. Review to save money.`
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
            insights.push({
                icon: 'fa-triangle-exclamation',
                iconClass: 'warning',
                title: `High ${topCat} Spending`,
                description: `${topCat} accounts for ${percentage}% of your spending (${topAmount.toLocaleString()} RSD). Consider reducing expenses in this category.`
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
            title: 'On Track!',
            description: `You've spent ${budgetPercentage.toFixed(0)}% of your budget. Keep up the good spending habits!`
        });
    }

    // 4. Savings suggestion
    const savingsTotal = appData.expenses.filter(e => e.category === 'Savings')
        .reduce((sum, e) => sum + (e.amount || 0), 0);
    
    if (savingsTotal === 0 && totalSpent < income * 0.8) {
        insights.push({
            icon: 'fa-piggy-bank',
            iconClass: 'success',
            title: 'Save More',
            description: `You have room in your budget. Consider moving ${((income - totalSpent) * 0.3).toFixed(0).toLocaleString()} RSD to savings.`
        });
    }

    // Render insights
    if (insights.length === 0) {
        insightsList.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No insights available yet. Add more expenses to get personalized recommendations.</p>';
    } else {
        insightsList.innerHTML = insights.map(insight => `
            <div class="insight-item">
                <div class="insight-icon ${insight.iconClass}">
                    <i class="fa-solid ${insight.icon}"></i>
                </div>
                <div class="insight-content">
                    <div class="insight-title">${insight.title}</div>
                    <div class="insight-description">${insight.description}</div>
                </div>
            </div>
        `).join('');
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
