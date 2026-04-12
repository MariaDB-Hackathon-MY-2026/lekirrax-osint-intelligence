// src/pages/ScanInput/ScanInputPage.tsx
import "./ScanInputPage.css";

interface ScanInputPageProps {
  value?: string;
  onChange?: (value: string) => void;
  onScan?: () => void;
  onOsint?: () => void;
  onBack?: () => void;
}

export default function ScanInputPage({ value, onChange, onScan, onOsint, onBack }: ScanInputPageProps) {
    return (
        <div className="scan-wrapper">
        <div className="scan-card">
            <button className="back-link" onClick={onBack}>← Back to Dashboard</button>
            <h1>LekirraX</h1>
            <p>OSINT & Attack Surface Intelligence Scanner</p>

            <input 
              placeholder="example.com or 1.1.1.1" 
              value={value}
              onChange={(e) => onChange?.(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    onScan?.();
                }
              }}
            />
            <button onClick={onScan}>Start Scan</button>
            <button onClick={onOsint} className="osint-btn">Deep OSINT Investigation</button>
        </div>
        </div>
    );
}