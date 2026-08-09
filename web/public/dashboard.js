async function loadData() {
  try {
    const [meRes, lbRes, statsRes] = await Promise.all([
      fetch('/api/me'),
      fetch('/api/leaderboard'),
      fetch('/api/stats')
    ]);

    const me = await meRes.json();
    const lb = await lbRes.json();
    const stats = await statsRes.json();

    // Owner stats
    document.getElementById('balance').textContent = me.balance.toLocaleString();
    document.getElementById('gems').textContent = me.gems.toLocaleString();
    document.getElementById('animals').textContent = me.animalCount;
    document.getElementById('perks').textContent = me.perks.length;

    // Leaderboard
    const lbEl = document.getElementById('leaderboard');
    if (lb && lb.length) {
      lbEl.innerHTML = lb.map((u, i) => `
        <div class="leaderboard-item">
          <span class="leaderboard-rank">#${i + 1}</span>
          <span class="leaderboard-name">${u.user_id}</span>
          <span class="leaderboard-bal">${Number(u.balance).toLocaleString()}</span>
        </div>
      `).join('');
    } else {
      lbEl.innerHTML = '<div class="loading">No leaderboard data</div>';
    }

    // Stats
    document.getElementById('stats').innerHTML = `
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-value">${stats.totalUsers.toLocaleString()}</div>
          <div class="stat-label">Total Users</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${Number(stats.totalBalance).toLocaleString()}</div>
          <div class="stat-label">Total Economy</div>
        </div>
      </div>
    `;
  } catch (err) {
    console.error('Failed to load data:', err);
  }
}

loadData();
setInterval(loadData, 30000);
