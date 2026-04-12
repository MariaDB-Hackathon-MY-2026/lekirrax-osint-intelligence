import React, { useEffect, useState } from 'react';
import { getOsintData } from '../servises/api';
import type { OsintResult } from '../types/osint';
import './OsintCard.css';

interface OsintCardProps {
    module: string;
    target: string;
    title: string;
    icon: string;
    scanId?: number;
}

export const OsintCard: React.FC<OsintCardProps> = ({ module, target, title, icon, scanId }) => {
    const [data, setData] = useState<OsintResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        setError(null);
        
        getOsintData(module, target, scanId)
            .then(res => {
                if(mounted) {
                    setData(res);
                    setLoading(false);
                }
            })
            .catch(err => {
                if(mounted) {
                    setError(err.message);
                    setLoading(false);
                }
            });
            
        return () => { mounted = false; };
    }, [module, target, scanId]);

    const renderContent = () => {
        if (!data || !data.data) return null;

        // Custom rendering based on module could go here, 
        // but for now we'll do a generic key-value summary + JSON dump
        const keys = Object.keys(data.data).slice(0, 4); // Show first 4 keys as summary

        return (
            <div>
                {keys.map(key => {
                    const val = data.data[key];
                    let displayVal = val;
                    
                    if (Array.isArray(val)) {
                        if (val.length === 0) displayVal = 'None';
                        else if (typeof val[0] === 'string' || typeof val[0] === 'number') {
                            displayVal = val.join(', ');
                        } else {
                            displayVal = `${val.length} items`;
                        }
                    } else if (typeof val === 'object' && val !== null) {
                         return null; // Skip complex objects
                    }

                    const strVal = String(displayVal);
                    const truncated = strVal.length > 25 ? strVal.substring(0, 25) + '...' : strVal;

                    return (
                        <div className="key-value-row" key={key}>
                            <span className="key-label">{key.replace(/_/g, ' ')}</span>
                            <span className="value-text" title={strVal}>{truncated}</span>
                        </div>
                    );
                })}
                
                {expanded && (
                    <div className="json-view">
                        {JSON.stringify(data.data, null, 2)}
                    </div>
                )}
                
                <button 
                    className="expand-btn"
                    onClick={() => setExpanded(!expanded)}
                >
                    {expanded ? 'Show Less' : 'View Details'}
                </button>
            </div>
        );
    };

    return (
        <div className="osint-card">
            <div className="osint-header">
                <div className="osint-title-group">
                    <span className="osint-icon">{icon}</span>
                    <h3 className="osint-title">{title}</h3>
                </div>
                {!loading && !error && data && (
                    <span className={`risk-badge risk-${data.risk.toLowerCase()}`}>
                        {data.risk}
                    </span>
                )}
            </div>

            <div className="osint-content">
                {loading && <div className="osint-loading">Scanning...</div>}
                {error && <div className="osint-error">Failed: {error}</div>}
                {!loading && !error && renderContent()}
            </div>
        </div>
    );
};
