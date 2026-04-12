import ScanLayout from "../ScanLayout/ScanLayout";
import ScanResultsPage from "../../pages/ScanResults/ScanResultsPage";
import ParticleBackground from "../../components/background/ParticleBackground";

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
        <ParticleBackground />
        <div style={{ position: "relative", zIndex: 1 }}>
            {children}
        </div>
        </>
    );
    }