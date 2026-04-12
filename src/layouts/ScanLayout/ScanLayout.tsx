import "./ScanLayout.css";

export default function ScanLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="scan-layout">
        <header className="scan-header">
            <h1>LekirraX — Scan Results</h1>
        </header>

        <main className="scan-content">{children}</main>
        </div>
    );
    }