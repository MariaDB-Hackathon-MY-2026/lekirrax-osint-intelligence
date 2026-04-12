import React, { useState } from 'react';
import './OsintPage.css';

interface OsintPageProps {
    onBack: () => void;
}

const OsintPage: React.FC<OsintPageProps> = ({ onBack }) => {
    const [activeTab, setActiveTab] = useState('phishing');
    const [target, setTarget] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const modules = [
        { id: 'phishing', name: 'Phishing Detection', icon: '🎣' },
        { id: 'email', name: 'Email Validation', icon: '📧' },
        { id: 'phone', name: 'Phone Investigation', icon: '📱' },
        { id: 'social', name: 'Social Media Scanner', icon: '👥' },
        { id: 'leak', name: 'Credential Leak', icon: '🔓' }
    ];

    const handleScan = async () => {
        if (!target) return;
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            // Map frontend module IDs to backend module names
            const moduleMap: Record<string, string> = {
                'phishing': 'phishing-detect',
                'email': 'email-validator',
                'phone': 'phone-investigator',
                'social': 'alias-finder', // reusing alias-finder for now
                'leak': 'leak-check'
            };

            const backendModule = moduleMap[activeTab];
            const response = await fetch(`/api/osint/${backendModule}?target=${encodeURIComponent(target)}`);
            
            if (!response.ok) {
                throw new Error('Scan failed');
            }

            const data = await response.json();
            setResult(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="osint-page">
            <header className="osint-header">
                <button className="back-btn" onClick={onBack}>← Back to Dashboard</button>
                <h1>OSINT Intelligence Gathering</h1>
            </header>

            <div className="osint-container">
                <nav className="osint-sidebar">
                    {modules.map(m => (
                        <button 
                            key={m.id} 
                            className={`module-btn ${activeTab === m.id ? 'active' : ''}`}
                            onClick={() => {
                                setActiveTab(m.id);
                                setResult(null);
                                setError(null);
                                setTarget('');
                            }}
                        >
                            <span className="icon">{m.icon}</span>
                            {m.name}
                        </button>
                    ))}
                </nav>

                <main className="osint-content">
                    <div className="input-section">
                        <h2>{modules.find(m => m.id === activeTab)?.name}</h2>
                        <div className="search-box">
                            <input 
                                type="text" 
                                placeholder={`Enter target for ${activeTab}...`}
                                value={target}
                                onChange={(e) => setTarget(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                            />
                            <button onClick={handleScan} disabled={loading}>
                                {loading ? 'Scanning...' : 'Analyze'}
                            </button>
                        </div>
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    {result && (
                        <div className="result-display">
                            <div className="risk-badge" data-risk={result.risk}>
                                Risk Level: {result.risk}
                            </div>
                            <pre>{JSON.stringify(result.data, null, 2)}</pre>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default OsintPage;
