import React from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  const [stats, setStats] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => { setStats(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (!stats) return null;

  return (
    <div className="dashboard">
      <h1>Tri-Link Dashboard</h1>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.sponsors}</div>
          <div className="stat-label">Total Sponsors</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">¥{stats.monthly}</div>
          <div className="stat-label">Monthly Income</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.githubStars ?? '—'}</div>
          <div className="stat-label">GitHub Stars</div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
