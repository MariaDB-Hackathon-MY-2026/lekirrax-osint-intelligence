import React, { useEffect, useMemo, useState } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Line,
  Marker
} from "react-simple-maps";
import './CyberThreatMap.css';

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const WorldGeographies = React.memo(function WorldGeographies() {
    return (
        <Geographies geography={geoUrl}>
            {({ geographies }: any) =>
                geographies.map((geo: any) => (
                    <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        className="map-geography"
                        style={{
                            default: { fill: "#0c171d", stroke: "#00bcd4", strokeWidth: 0.5, outline: "none" },
                            hover: { fill: "#1a2f3a", stroke: "#00e5ff", strokeWidth: 1, outline: "none" },
                            pressed: { fill: "#00e5ff", outline: "none" }
                        }}
                    />
                ))
            }
        </Geographies>
    );
});

interface ThreatData {
    id: string;
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    timestamp: string;
    source: {
        lat: number;
        lng: number;
        country: string;
    };
    destination: {
        lat: number;
        lng: number;
        country: string;
    };
}

interface CyberThreatMapProps {
    filterType?: string;
    onThreatClick?: (threat: ThreatData) => void;
    onError?: (error: string | null) => void;
}

const CyberThreatMap: React.FC<CyberThreatMapProps> = ({ filterType = 'all', onThreatClick, onError }) => {
    const [threats, setThreats] = useState<ThreatData[]>([]);
    const [loading, setLoading] = useState(true);
    const [terminalLines, setTerminalLines] = useState<string[]>([]);
    const [uptimeSeconds, setUptimeSeconds] = useState(0);

    const fetchThreats = async () => {
        try {
            const response = await fetch('/api/dashboard/threat-map');
            if (!response.ok) throw new Error('Failed to fetch threat data');
            const data = await response.json();
            setThreats(data);
            setLoading(false);
            
            const log = `[${new Date().toLocaleTimeString()}] INCOMING_FEED: ${data.length} ACTIVE_NODES DETECTED`;
            setTerminalLines(prev => [log, ...prev].slice(0, 10));
        } catch (err: any) {
            onError?.(err.message);
            setLoading(false);
        }
    };

    useEffect(() => {
        let ws: WebSocket | null = null;
        let fallbackInterval: number | null = null;
        let reconnectTimeout: number | null = null;
        let attempts = 0;
        let disposed = false;

        const startFallbackPolling = () => {
            if (disposed) return;
            if (fallbackInterval) return;
            fetchThreats();
            fallbackInterval = window.setInterval(fetchThreats, 5000);
        };

        const connect = () => {
            if (disposed) return;
            try {
                const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
                const url = `${proto}://${window.location.host}/ws/threat-map`;
                ws = new WebSocket(url);

                ws.onopen = () => {
                    if (disposed) return;
                    attempts = 0;
                    onError?.(null);
                    if (fallbackInterval) {
                        window.clearInterval(fallbackInterval);
                        fallbackInterval = null;
                    }
                };

                ws.onmessage = (event) => {
                    if (disposed) return;
                    try {
                        const msg = JSON.parse(event.data);
                        if (msg?.type === 'threat-map' && Array.isArray(msg.data)) {
                            setThreats(msg.data);
                            setLoading(false);
                            const log = `[${new Date().toLocaleTimeString()}] STREAM_UPDATE: ${msg.data.length} ACTIVE_NODES`;
                            setTerminalLines(prev => [log, ...prev].slice(0, 10));
                            onError?.(null);
                        }
                    } catch (e) {
                        onError?.('Threat stream parse error');
                    }
                };

                ws.onerror = () => {
                    if (disposed) return;
                    onError?.('Threat stream connection error');
                };

                ws.onclose = () => {
                    if (disposed) return;
                    ws = null;
                    startFallbackPolling();
                    attempts += 1;
                    const delay = Math.min(10000, 500 * Math.pow(2, attempts));
                    reconnectTimeout = window.setTimeout(connect, delay);
                };
            } catch (err: any) {
                onError?.(err.message || 'Threat stream failed');
                startFallbackPolling();
            }
        };

        connect();

        return () => {
            disposed = true;
            if (ws) {
                ws.onopen = null;
                ws.onmessage = null;
                ws.onerror = null;
                ws.onclose = null;
                ws.close();
            }
            if (fallbackInterval) window.clearInterval(fallbackInterval);
            if (reconnectTimeout) window.clearTimeout(reconnectTimeout);
        };
    }, []);

    useEffect(() => {
        const id = window.setInterval(() => setUptimeSeconds((s) => s + 1), 1000);
        return () => window.clearInterval(id);
    }, []);

    const filteredThreats = useMemo(() => {
        if (!filterType || filterType === 'all') return threats;
        return threats.filter(t => t.type === filterType);
    }, [threats, filterType]);

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical': return '#ff0055';
            case 'high': return '#ffaa00';
            case 'medium': return '#00e5ff';
            default: return '#00ff9d';
        }
    };

    const heavyMode = useMemo(() => {
        const count = filteredThreats.length;
        return (filterType === 'all' && count > 12) || count > 24;
    }, [filterType, filteredThreats.length]);

    const animatedThreatIds = useMemo(() => {
        if (!heavyMode) return null;
        const weight = (s: ThreatData['severity']) => {
            if (s === 'critical') return 4;
            if (s === 'high') return 3;
            if (s === 'medium') return 2;
            return 1;
        };
        const top = [...filteredThreats]
            .sort((a, b) => weight(b.severity) - weight(a.severity))
            .slice(0, 8)
            .map((t) => t.id);
        return new Set(top);
    }, [filteredThreats, heavyMode]);

    const activeNodes = filteredThreats.length;

    const threatLevel = useMemo(() => {
        const severities = filteredThreats.map((t) => t.severity);
        if (severities.includes('critical')) return 'CRITICAL';
        if (severities.includes('high')) return 'HIGH';
        if (severities.includes('medium')) return 'MEDIUM';
        if (severities.includes('low')) return 'LOW';
        return '—';
    }, [filteredThreats]);

    const threatLevelClass = useMemo(() => {
        const lower = threatLevel.toLowerCase();
        if (lower === 'critical') return 'critical';
        if (lower === 'high') return 'high';
        if (lower === 'medium') return 'medium';
        if (lower === 'low') return 'low';
        return '';
    }, [threatLevel]);

    const uptimeLabel = useMemo(() => {
        const s = uptimeSeconds;
        const hh = String(Math.floor(s / 3600)).padStart(2, '0');
        const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
        const ss = String(s % 60).padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
    }, [uptimeSeconds]);

    if (loading) {
        return (
            <div className="hacking-loader">
                <div className="glitch" data-text="INITIALIZING_SENTINEL_MAP">INITIALIZING_SENTINEL_MAP</div>
                <div className="progress-bar"></div>
            </div>
        );
    }

    return (
        <div className="cyber-map-wrapper">
            <div className="grid-overlay"></div>
            <div className="scanline"></div>
            <div className="terminal-hud left">
                <div className="hud-header">SYS_LOG_FEED</div>
                {terminalLines.map((line, i) => (
                    <div key={i} className="terminal-line">{line}</div>
                ))}
            </div>

            <div className="terminal-hud right">
                <div className="hud-header">NODE_STATISTICS</div>
                <div className="stat-row">
                    THREAT_LEVEL: <span className={`value ${threatLevelClass}`}>{threatLevel}</span>
                </div>
                <div className="stat-row">
                    ACTIVE_NODES: <span className="value">{activeNodes}</span>
                </div>
                <div className="stat-row">ENCRYPTION: <span className="value">AES_256_GCM</span></div>
                <div className="stat-row">UPTIME: <span className="value">{uptimeLabel}</span></div>
            </div>

            <ComposableMap
                projection="geoMercator"
                projectionConfig={{
                    scale: 185,
                    center: [0, 20]
                }}
                className={`hacking-map ${heavyMode ? 'hacking-map-lite' : ''}`}
            >
                <WorldGeographies />

                {filteredThreats.map((threat) => {
                    const color = getSeverityColor(threat.severity);
                    const shouldAnimate = !heavyMode || Boolean(animatedThreatIds?.has(threat.id));
                    const glow = !heavyMode && (threat.severity === 'high' || threat.severity === 'critical') && filteredThreats.length <= 12;
                    const arcClass = shouldAnimate ? `attack-arc${glow ? ' glow' : ''}` : 'attack-arc lite';
                    const pulseClass = shouldAnimate ? 'pulse-node' : 'pulse-node lite';
                    const pingClass = shouldAnimate ? 'ping-ring' : 'ping-ring lite';
                    return (
                        <React.Fragment key={threat.id}>
                            <Line
                                from={[threat.source.lng, threat.source.lat]}
                                to={[threat.destination.lng, threat.destination.lat]}
                                stroke={color}
                                strokeWidth={1.5}
                                style={{ '--color': color } as any}
                                className={arcClass}
                            />

                            <Marker coordinates={[threat.source.lng, threat.source.lat]}>
                                <circle r={2} fill={color} className={pulseClass} />
                            </Marker>

                            <Marker coordinates={[threat.destination.lng, threat.destination.lat]}>
                                <g className="target-marker" onClick={() => onThreatClick?.(threat)}>
                                    <circle r={4} fill="transparent" stroke={color} strokeWidth={1} className={pingClass} />
                                    <circle r={2} fill={color} />
                                </g>
                            </Marker>
                        </React.Fragment>
                    );
                })}
            </ComposableMap>

            <div className="map-footer">
                <div className="footer-item">STATUS: <span className="neon-text">OPERATIONAL</span></div>
                <div className="footer-item">REGION: <span className="neon-text">GLOBAL_SENSE</span></div>
                <div className="footer-item">PROTOCOL: <span className="neon-text">HACK_DETECT_V4</span></div>
            </div>
        </div>
    );
};

export default CyberThreatMap;
