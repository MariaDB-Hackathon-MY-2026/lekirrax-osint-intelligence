import React, { useEffect, useState, useRef, useMemo } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';

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
    filterType?: string; // 'all' or specific type
    onThreatClick?: (threat: ThreatData) => void;
    onError?: (error: string) => void;
}

const CyberThreatMap: React.FC<CyberThreatMapProps> = ({ filterType = 'all', onThreatClick, onError }) => {
    const globeEl = useRef<any>(null);
    const [threats, setThreats] = useState<ThreatData[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchThreats = async () => {
        try {
            const response = await fetch('/api/dashboard/threat-map');
            if (!response.ok) {
                throw new Error('Failed to fetch threat data');
            }
            const data = await response.json();
            setThreats(data);
            setLoading(false);
        } catch (err: any) {
            console.error("Threat map error:", err);
            onError?.(err.message);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchThreats();
        const interval = setInterval(fetchThreats, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, []);

    // Auto-rotate
    useEffect(() => {
        if (globeEl.current) {
            globeEl.current.controls().autoRotate = true;
            globeEl.current.controls().autoRotateSpeed = 0.5;
        }
    }, [loading]);

    const filteredThreats = useMemo(() => {
        if (!filterType || filterType === 'all') return threats;
        return threats.filter(t => t.type === filterType);
    }, [threats, filterType]);

    // Color mapping
    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical': return '#ef4444'; // Red
            case 'high': return '#f97316'; // Orange
            case 'medium': return '#eab308'; // Yellow
            default: return '#3b82f6'; // Blue
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full w-full bg-[#0B0C10] text-cyan-400 font-mono">
                <div className="animate-pulse">INITIALIZING GLOBAL THREAT SENSORS...</div>
            </div>
        );
    }

    return (
        <div className="relative w-full h-full bg-[#0B0C10] overflow-hidden rounded-xl border border-gray-800">
             <Globe
                ref={globeEl}
                globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
                bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
                backgroundColor="#0B0C10" // Match dark theme
                
                // Arcs (Attack Vectors)
                arcsData={filteredThreats}
                arcStartLat={(d: any) => (d as ThreatData).source.lat}
                arcStartLng={(d: any) => (d as ThreatData).source.lng}
                arcEndLat={(d: any) => (d as ThreatData).destination.lat}
                arcEndLng={(d: any) => (d as ThreatData).destination.lng}
                arcColor={(d: any) => getSeverityColor((d as ThreatData).severity)}
                arcDashLength={0.4}
                arcDashGap={4}
                arcDashInitialGap={() => Math.random() * 5}
                arcDashAnimateTime={2000}
                arcStroke={0.5}

                // Points (Sources/Targets)
                pointsData={filteredThreats.flatMap(t => [
                    { ...t.source, type: 'source', severity: t.severity, threatId: t.id },
                    { ...t.destination, type: 'destination', severity: t.severity, threatId: t.id }
                ])}
                pointLat="lat"
                pointLng="lng"
                pointColor={(d: any) => getSeverityColor((d as any).severity)}
                pointAltitude={0.01}
                pointRadius={0.5}
                
                // Rings (Ripple Effect)
                ringsData={filteredThreats.flatMap(t => [
                    { ...t.source, color: getSeverityColor(t.severity) },
                    { ...t.destination, color: getSeverityColor(t.severity) }
                ])}
                ringLat="lat"
                ringLng="lng"
                ringColor={(d: any) => (d as any).color}
                ringMaxRadius={5}
                ringPropagationSpeed={3}
                ringRepeatPeriod={1000}

                // Interaction
                onPointClick={(point: any) => {
                    const threat = threats.find(t => t.id === point.threatId);
                    if (threat && onThreatClick) onThreatClick(threat);
                }}
                
                // Atmosphere
                atmosphereColor="#00bcd4" // Cyan atmosphere
                atmosphereAltitude={0.15}
            />
            
            {/* Overlay Grid or UI elements could go here */}
            <div className="absolute bottom-4 right-4 text-xs text-gray-500 font-mono">
                LIVE THREAT FEED // {filteredThreats.length} ACTIVE
            </div>
        </div>
    );
};

export default CyberThreatMap;
