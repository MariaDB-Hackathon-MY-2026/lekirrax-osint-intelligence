import React, { useEffect, useState } from 'react';
import './ScanningAnimation.css';

interface ScanningAnimationProps {
    target: string;
}

const LOG_MESSAGES = [
    "Initializing reconnaissance modules...",
    "Resolving DNS records...",
    "Analyzing A/AAAA records...",
    "Pinging host for availability...",
    "Tracing route hops...",
    "Identifying server location...",
    "Scanning open ports (TCP/UDP)...",
    "Detecting firewall signatures...",
    "Checking SSL/TLS certificate chain...",
    "Enumerating subdomains...",
    "Analyzing HTTP headers...",
    "Calculating risk score...",
    "Aggregating intelligence data...",
    "Finalizing report..."
];

const ScanningAnimation: React.FC<ScanningAnimationProps> = ({ target }) => {
    const [logIndex, setLogIndex] = useState(0);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        // Log rotation
        const logInterval = setInterval(() => {
            setLogIndex((prev) => (prev + 1) % LOG_MESSAGES.length);
        }, 800);

        // Progress simulation (0 to 90% then wait for real completion)
        const progressInterval = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 90) return prev;
                return prev + Math.random() * 5;
            });
        }, 500);

        return () => {
            clearInterval(logInterval);
            clearInterval(progressInterval);
        };
    }, []);

    return (
        <div className="scanning-overlay">
            <div className="scanner-ring">
                <div className="scanner-core">
                    <span className="scanner-icon">⌖</span>
                </div>
            </div>

            <div className="scan-status">
                <div className="scan-target-label">TARGET</div>
                <div className="scan-target-value">{target}</div>
                
                <div className="terminal-logs">
                    <span className="prompt">{">"}</span> {LOG_MESSAGES[logIndex]}
                </div>

                <div className="progress-bar">
                    <div 
                        className="progress-fill" 
                        style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                </div>
            </div>
        </div>
    );
};

export default ScanningAnimation;
