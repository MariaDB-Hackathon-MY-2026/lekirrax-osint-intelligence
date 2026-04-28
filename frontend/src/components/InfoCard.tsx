import React from 'react';
import type { KeyValueItem, TagItem, CardContentType } from '../types';

interface InfoCardProps {
    title: string;
    type?: CardContentType;
    data?: KeyValueItem[] | TagItem[];
    customContentId?: string;
    children?: React.ReactNode;
    className?: string;
}

const InfoCard: React.FC<InfoCardProps> = ({ title, type, data, customContentId, children, className = '' }) => {
    
    const renderContent = () => {
        if (children) return children;

        if (type === 'kv-list' && Array.isArray(data)) {
            const items = data as KeyValueItem[];
            return (
                <ul className="kv-list">
                    {items.map((item, idx) => (
                        <li key={idx} className="kv-item">
                            <span className="kv-label">{item.label}</span>
                            {item.href ? (
                                <a
                                    className="kv-value kv-link"
                                    href={item.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={item.color ? { color: item.color } : {}}
                                >
                                    {item.value}
                                </a>
                            ) : (
                                <span className="kv-value" style={item.color ? { color: item.color } : {}}>
                                    {item.value}
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            );
        }

        if (type === 'tags' && Array.isArray(data)) {
            const tags = data as TagItem[];
            return (
                <div className="tags-container">
                    {tags.map((tag, idx) => (
                        <span key={idx} className="tag-badge" style={tag.color ? { backgroundColor: tag.color + '40', color: tag.color, border: `1px solid ${tag.color}` } : {}}>
                            {tag.label}
                        </span>
                    ))}
                </div>
            );
        }

        if (type === 'custom') {
            if (customContentId === 'map') {
                return <div className="placeholder-map">Map Visualization (Coming Soon)</div>;
            }
             if (customContentId === 'raw-json') {
                return <pre className="raw-json">{JSON.stringify(data, null, 2)}</pre>;
            }
            return <div className="placeholder-custom">Custom Content: {customContentId}</div>;
        }

        return null;
    };

    return (
        <div className={`info-card ${className}`}>
            <div className="info-card-header">
                <h3>{title}</h3>
            </div>
            <div className="info-card-content">
                {renderContent()}
            </div>
        </div>
    );
};

export default InfoCard;
