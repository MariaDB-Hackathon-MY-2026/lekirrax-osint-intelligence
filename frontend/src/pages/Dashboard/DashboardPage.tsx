import React, { useState } from 'react';
import CyberThreatMap from '../../components/CyberThreatMap';
import './DashboardPage.css';
import Logo from '../../picture/Logo.png';
import HistoryNavButton from '../../components/HistoryNavButton';

interface DashboardPageProps {
    onNavigateToScan: () => void;
    onNavigateToOsint: () => void;
    onNavigateToHistory: () => void;
    onLogout: () => void;
}

const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigateToScan, onNavigateToOsint, onNavigateToHistory, onLogout }) => {
    const [selectedThreat, setSelectedThreat] = useState<any | null>(null);
    const [filter, setFilter] = useState<string>('all');
    const [error, setError] = useState<string | null>(null);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            localStorage.removeItem('token');
            onLogout();
        } catch (err) {
            console.error('Logout failed:', err);
        } finally {
            setIsLoggingOut(false);
        }
    };

    const threatTypes = ['all', 'DDoS', 'Phishing', 'Malware', 'SQL Injection', 'Brute Force'];

    return (
        <div className="dashboard-page">
            <header className="dashboard-header">
                <div className="brand">
                    <span className="logo-icon">
                        <img src={Logo} alt="LekirraX Logo" />
                    </span>
                    <h1>LekirraX <span className="subtitle">| Cyber Intelligence Center</span></h1>
                </div>
                
                <div className="header-actions">
                    <div className="live-indicator">
                        <span className="pulse-dot"></span>
                        LIVE THREAT FEED
                    </div>
                    <HistoryNavButton className="history-btn" onNavigate={onNavigateToHistory} />
                    <button 
                        className="logout-btn" 
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                    >
                        {isLoggingOut ? 'TERMINATING...' : 'LOGOUT'}
                    </button>
                </div>
            </header>

            <main className="dashboard-content">
                <div className="mission-control">
                    <button className="mission-card" onClick={onNavigateToScan}>
                        <div className="card-icon">🌐</div>
                        <div className="card-content">
                            <h3>Web-Check</h3>
                            <p>Deep scan domains & infrastructure</p>
                        </div>
                        <div className="card-arrow">→</div>
                    </button>
                    <button className="mission-card" onClick={onNavigateToOsint}>
                        <div className="card-icon"></div>
                        <div className="card-content">
                            <h3>OSINT Toolkit</h3>
                            <p>Investigate identities & digital footprints</p>
                        </div>
                        <div className="card-arrow">→</div>
                    </button>
                </div>

                <div className="map-controls">
                    <h3>Threat Filter</h3>
                    <div className="filter-buttons">
                        {threatTypes.map(type => (
                            <button 
                                key={type} 
                                className={`filter-btn ${filter === type ? 'active' : ''}`}
                                onClick={() => setFilter(type)}
                            >
                                {type.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="map-container">
                    {error && (
                        <div className="map-error" role="alert">
                            {error}
                        </div>
                    )}
                    <CyberThreatMap 
                        filterType={filter === 'all' ? undefined : filter}
                        onThreatClick={(threat) => setSelectedThreat(threat)}
                        onError={(err) => setError(err || null)}
                    />
                </div>

                {selectedThreat && (
                    <div className="threat-modal-overlay" onClick={() => setSelectedThreat(null)}>
                        <div className="threat-modal" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>THREAT DETECTED</h2>
                                <button className="close-btn" onClick={() => setSelectedThreat(null)}>×</button>
                            </div>
                            <div className="modal-body">
                                <div className="threat-row">
                                    <span className="label">ID:</span>
                                    <span className="value mono">{selectedThreat.id}</span>
                                </div>
                                <div className="threat-row">
                                    <span className="label">TYPE:</span>
                                    <span className="value highlight">{selectedThreat.type}</span>
                                </div>
                                <div className="threat-row">
                                    <span className="label">SEVERITY:</span>
                                    <span className={`value badge ${selectedThreat.severity}`}>{selectedThreat.severity.toUpperCase()}</span>
                                </div>
                                <div className="threat-row">
                                    <span className="label">TIMESTAMP:</span>
                                    <span className="value mono">{new Date(selectedThreat.timestamp).toLocaleString()}</span>
                                </div>
                                <hr className="divider"/>
                                <div className="geo-info">
                                    <div>
                                        <h4>SOURCE</h4>
                                        <p>{selectedThreat.source.lat.toFixed(2)}, {selectedThreat.source.lng.toFixed(2)}</p>
                                    </div>
                                    <div className="arrow">➔</div>
                                    <div>
                                        <h4>TARGET</h4>
                                        <p>{selectedThreat.destination.lat.toFixed(2)}, {selectedThreat.destination.lng.toFixed(2)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default DashboardPage;
