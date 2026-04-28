import { useState, useEffect, useRef, useCallback } from "react";
import ScanInputPage from "./pages/ScanInput/ScanInputPage";
import ScanResultsPage from "./pages/ScanResults/ScanResultsPage";
import OsintPage from "./pages/OsintResults/OsintPage";
import DashboardPage from "./pages/Dashboard/DashboardPage";
import HistoryPage from "./pages/History/HistoryPage";
import SmoothScroll from "./components/SmoothScroll";
import ErrorBoundary from "./components/ErrorBoundary";
import LoginPage from "./pages/Login/LoginPage";
import { addSearchHistory } from "./services/searchHistory";

export default function App() {
  const [searchText, setSearchText] = useState("");
  const [view, setView] = useState<'dashboard' | 'input' | 'results' | 'osint' | 'history'>('dashboard');
  const [displayView, setDisplayView] = useState<'dashboard' | 'input' | 'results' | 'osint' | 'history'>('dashboard');
  const [transitionStage, setTransitionStage] = useState<'idle' | 'exiting' | 'pre-enter'>('idle');
  const [user, setUser] = useState<any | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(() => {
    try {
      return Boolean(localStorage.getItem('token'));
    } catch (e) {
      void e;
      return false;
    }
  });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const viewRef = useRef(view);
  const transitionStageRef = useRef(transitionStage);

  const transitionTo = useCallback((next: 'dashboard' | 'input' | 'results' | 'osint' | 'history') => {
    if (next === viewRef.current && transitionStageRef.current === 'idle') return;
    setView(next);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setTransitionStage('exiting');

    timeoutRef.current = setTimeout(() => {
      setDisplayView(next);
      setTransitionStage('pre-enter');
      rafRef.current = requestAnimationFrame(() => setTransitionStage('idle'));
    }, 280);
  }, []);

  useEffect(() => {
    let token = '';
    try {
      token = localStorage.getItem('token') || '';
    } catch (e) {
      void e;
      token = '';
    }
    if (!token) return;

    fetch('/api/auth/session', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Invalid session');
        return await res.json();
      })
      .then((payload) => {
        setUser(payload.user);
      })
      .catch(() => {
        localStorage.removeItem('token');
        setUser(null);
      })
      .finally(() => {
        setCheckingAuth(false);
      });
  }, []);

  useEffect(() => {
    viewRef.current = view;
    transitionStageRef.current = transitionStage;
  }, [view, transitionStage]);

  useEffect(() => {
    const applyState = (state: any) => {
      const nextView = state?.view as any;
      const nextSearch = typeof state?.searchText === 'string' ? state.searchText : '';
      if (nextView === 'dashboard' || nextView === 'input' || nextView === 'results' || nextView === 'osint' || nextView === 'history') {
        setSearchText(nextSearch);
        transitionTo(nextView);
      }
    };

    const parseHashView = () => {
      const raw = (window.location.hash || '').replace(/^#\/?/, '');
      if (raw === 'dashboard' || raw === 'input' || raw === 'results' || raw === 'osint' || raw === 'history') return raw;
      return null;
    };

    const initialFromState = window.history.state;
    const initialFromHash = parseHashView();
    if (initialFromState?.view) {
      applyState(initialFromState);
    } else if (initialFromHash) {
      window.history.replaceState({ view: initialFromHash, searchText: '' }, '', `#/${initialFromHash}`);
      applyState(window.history.state);
    } else {
      window.history.replaceState({ view: 'dashboard', searchText: '' }, '', '#/dashboard');
    }

    const onPopState = (e: PopStateEvent) => {
      applyState(e.state);
    };

    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const navigate = (next: 'dashboard' | 'input' | 'results' | 'osint' | 'history') => {
    window.history.pushState({ view: next, searchText }, '', `#/${next}`);
    transitionTo(next);
  };

  const handleLoginSuccess = (userData: any) => {
    setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
    setView('dashboard');
    setDisplayView('dashboard');
    setTransitionStage('idle');
    localStorage.removeItem('token');
    window.history.replaceState({ view: 'dashboard', searchText: '' }, '', '#/dashboard');
  };

  const handleScan = () => {
    if (searchText.trim()) {
      addSearchHistory(searchText);
      navigate('results');
    }
  };

  if (checkingAuth) return null;

  return (
    <ErrorBoundary>
      {!user ? (
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      ) : (
        <SmoothScroll>
          <div
            className={[
              'page-transition',
              transitionStage === 'exiting' ? 'is-exiting' : '',
              transitionStage === 'pre-enter' ? 'is-preenter' : ''
            ].filter(Boolean).join(' ')}
          >
            {displayView === 'dashboard' && (
                <DashboardPage 
                    onNavigateToScan={() => navigate('input')} 
                    onNavigateToOsint={() => navigate('osint')}
                    onNavigateToHistory={() => navigate('history')}
                    onLogout={handleLogout}
                />
            )}
            {displayView === 'input' && (
              <ScanInputPage 
                value={searchText}
                onChange={setSearchText}
                onScan={handleScan}
                onOsint={() => navigate('osint')}
                onBack={() => navigate('dashboard')}
              />
            )}
            {displayView === 'results' && (
              <ScanResultsPage 
                target={searchText}
                onBack={() => navigate('dashboard')}
                onCancelBack={() => navigate('input')}
              />
            )}
            {displayView === 'osint' && (
              <OsintPage 
                onBack={() => navigate('dashboard')}
              />
            )}
            {displayView === 'history' && (
              <HistoryPage
                onBack={() => navigate('dashboard')}
                onRunQuery={(target) => {
                  setSearchText(target);
                  navigate('results');
                }}
              />
            )}
          </div>
        </SmoothScroll>
      )}
    </ErrorBoundary>
  );
}
