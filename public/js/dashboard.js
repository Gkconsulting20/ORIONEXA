document.addEventListener('DOMContentLoaded', function() {
    const revenueCtx = document.getElementById('revenueChart');
    const expensesCtx = document.getElementById('expensesChart');
    
    if (revenueCtx) {
        new Chart(revenueCtx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin'],
                datasets: [{
                    label: 'Chiffre d\'Affaires (millions FCFA)',
                    data: [95, 102, 108, 115, 118, 125],
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value + 'M';
                            }
                        }
                    }
                }
            }
        });
    }
    
    if (expensesCtx) {
        new Chart(expensesCtx, {
            type: 'doughnut',
            data: {
                labels: ['Personnel', 'Loyer', 'Fournitures', 'Marketing', 'Autres'],
                datasets: [{
                    data: [45, 20, 15, 12, 8],
                    backgroundColor: [
                        '#3498db',
                        '#e74c3c',
                        '#f39c12',
                        '#27ae60',
                        '#95a5a6'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }
});
