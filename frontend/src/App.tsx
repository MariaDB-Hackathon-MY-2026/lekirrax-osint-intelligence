import { useState } from "react";
import Particle3DTextBackground from "./components/Particle3DTextBackground";
import ScanInputPage from "./pages/ScanInput/ScanInputpage";
import ScanResultsPage from "./pages/ScanResults/ScanResultsPage";
import OsintPage from "./pages/OsintResults/OsintPage";
import DashboardPage from "./pages/Dashboard/DashboardPage";
import SmoothScroll from "./components/SmoothScroll";

export default function App() {
  const [searchText, setSearchText] = useState("");
  const [view, setView] = useState<'dashboard' | 'input' | 'results' | 'osint'>('dashboard');

  const handleScan = () => {
    if (searchText.trim()) {
      setView('results');
    }
  };

  const handleOsint = () => {
      setView('osint');
  };

  return (
    <SmoothScroll>
      {/* Background is always present but might be covered by other pages */}
      <Particle3DTextBackground text={searchText} />
      
      {view === 'dashboard' ? (
        <DashboardPage 
          onNavigateToScan={() => setView('input')} 
          onNavigateToOsint={() => setView('osint')}
        />
      ) : view === 'input' ? (
        <ScanInputPage 
          value={searchText} 
          onChange={setSearchText} 
          onScan={handleScan}
          onOsint={handleOsint}
          onBack={() => setView('dashboard')}
        />
      ) : view === 'results' ? (
        <ScanResultsPage target={searchText} onBack={() => setView('input')} />
      ) : (
        <OsintPage onBack={() => setView('dashboard')} />
      )}
    </SmoothScroll>
  );
}
