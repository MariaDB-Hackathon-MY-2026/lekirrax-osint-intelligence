import "./ScanInputPage.css";
import { useEffect, useMemo, useState } from "react";
import {
  clearSearchHistory,
  querySearchHistory,
  removeSearchHistoryItem,
  type SearchHistorySort
} from "../../services/searchHistory";

interface ScanInputPageProps {
  value?: string;
  onChange?: (value: string) => void;
  onScan?: () => void;
  onOsint?: () => void;
  onBack?: () => void;
}

export default function ScanInputPage({ value, onChange, onScan, onOsint, onBack }: ScanInputPageProps) {
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyFilter, setHistoryFilter] = useState('');
    const [sort, setSort] = useState<SearchHistorySort>('recent');
    const [tick, setTick] = useState(0);

    const items = useMemo(() => {
        return querySearchHistory({ text: historyFilter, sort, limit: 50 });
    }, [historyFilter, sort, tick]);

    useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            if (e.key === 'lekirrax.searchHistory.v1') setTick((x) => x + 1);
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    return (
        <div className="scan-wrapper">
            <div className="scan-card">
                <button className="back-link" onClick={onBack} type="button">
                    ← Back to Dashboard
                </button>

                <div className="scan-header">
                    <div className="scan-kicker">OPERATOR CONSOLE</div>
                    <h1 className="scan-title">LekirraX</h1>
                    <p className="scan-subtitle">OSINT & Attack Surface Intelligence Scanner</p>
                </div>

                <div className="scan-form">
                    <label className="scan-label" htmlFor="scan-target">
                        Target (domain or IP)
                    </label>
                    <input
                        id="scan-target"
                        className="scan-input"
                        placeholder="example.com or 1.1.1.1"
                        value={value}
                        onChange={(e) => onChange?.(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                onScan?.();
                            }
                        }}
                        onFocus={() => setHistoryOpen(true)}
                        autoComplete="off"
                        spellCheck={false}
                        inputMode="url"
                    />
                    <div className="scan-hint">Press Enter to start scan</div>
                    <div className="scan-history">
                        <div className="scan-history-bar">
                            <button
                                type="button"
                                className="scan-history-toggle"
                                onClick={() => setHistoryOpen((x) => !x)}
                            >
                                History
                            </button>
                            <input
                                className="scan-history-filter"
                                placeholder="Filter history..."
                                value={historyFilter}
                                onChange={(e) => setHistoryFilter(e.target.value)}
                            />
                            <select
                                className="scan-history-sort"
                                value={sort}
                                onChange={(e) => setSort(e.target.value as SearchHistorySort)}
                                aria-label="History sort"
                            >
                                <option value="recent">Recent</option>
                                <option value="oldest">Oldest</option>
                                <option value="alpha">A–Z</option>
                            </select>
                            <button
                                type="button"
                                className="scan-history-clear"
                                onClick={() => {
                                    clearSearchHistory();
                                    setTick((x) => x + 1);
                                }}
                                disabled={items.length === 0}
                            >
                                Clear all
                            </button>
                        </div>

                        {historyOpen && (
                            <div className="scan-history-panel" role="list" aria-label="Search history">
                                {items.length === 0 ? (
                                    <div className="scan-history-empty">No saved searches</div>
                                ) : (
                                    items.map((item) => (
                                        <div key={item.id} className="scan-history-item" role="listitem">
                                            <button
                                                type="button"
                                                className="scan-history-query"
                                                onClick={() => {
                                                    onChange?.(item.query);
                                                    setHistoryOpen(false);
                                                }}
                                                title={item.query}
                                            >
                                                {item.query}
                                            </button>
                                            <div className="scan-history-meta">
                                                <span className="scan-history-time">
                                                    {new Date(item.lastUsedAt).toLocaleString()}
                                                </span>
                                                <span className="scan-history-count">
                                                    ×{item.count}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                className="scan-history-remove"
                                                aria-label={`Remove ${item.query}`}
                                                onClick={() => {
                                                    removeSearchHistoryItem(item.id);
                                                    setTick((x) => x + 1);
                                                }}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="scan-actions">
                    <button className="scan-btn primary" onClick={onScan} type="button">
                        Start Scan
                    </button>
                    <button className="scan-btn secondary" onClick={onOsint} type="button">
                        Deep OSINT Investigation
                    </button>
                </div>
            </div>
        </div>
    );
}
