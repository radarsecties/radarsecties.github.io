// Aplica o tema escolhido antes da primeira pintura da tela
try { const t = localStorage.getItem('ciquanta:tema'); if (t) document.documentElement.dataset.theme = t; } catch (e) {}
