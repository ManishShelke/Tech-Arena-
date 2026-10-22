import React, { useState, useEffect } from 'react';
import { UserProfile } from './types.ts';
import { Navbar } from './components/Navbar.tsx';
import { QualifierTerminal } from './components/QualifierTerminal.tsx';
import { LeaderboardView } from './components/LeaderboardView.tsx';
import { AdminPanel } from './components/AdminPanel.tsx';
import { AdminLogin } from './components/AdminLogin.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { AppealModal } from './components/AppealModal.tsx';
import { Cpu, Lock } from 'lucide-react';

export const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('ta_token'));
  const [adminToken, setAdminToken] = useState<string | null>(() => localStorage.getItem('ta_admin_token'));
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'arena' | 'leaderboard'>('arena');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'register' | 'code' | 'admin'>('register');
  const [isAppealOpen, setIsAppealOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname || '/');

  // Handle client-side browser history
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Fetch or refresh current participant/admin profile
  const fetchProfile = async (authToken?: string) => {
    const currentToken = authToken || token;
    if (!currentToken) {
      setUser(null);
      return;
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${currentToken}` },
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        localStorage.removeItem('ta_token');
        setToken(null);
        setUser(null);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [token]);

  // Periodic participant heartbeat when signed in
  useEffect(() => {
    if (!token || user?.role === 'admin') return;

    const sendHeartbeat = async () => {
      try {
        await fetch('/api/participants/heartbeat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            difficulty: user?.score && user.score >= 150 ? 'Hard' : user?.score && user.score >= 50 ? 'Intermediate' : 'Easy',
          }),
        });
      } catch {
        // non-blocking
      }
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 10000);
    return () => clearInterval(interval);
  }, [token, user]);

  const handleAuthSuccess = (newToken: string, newUser: UserProfile) => {
    localStorage.setItem('ta_token', newToken);
    setToken(newToken);
    setUser(newUser);
    if (newUser.role === 'admin') {
      localStorage.setItem('ta_admin_token', newToken);
      setAdminToken(newToken);
      navigate('/admin/dashboard');
    } else {
      setActiveTab('arena');
    }
  };

  const handleLogout = async () => {
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // best effort
      }
    }
    localStorage.removeItem('ta_token');
    setToken(null);
    setUser(null);
    setActiveTab('arena');
  };

  const handleAdminLoginSuccess = (newToken: string) => {
    localStorage.setItem('ta_admin_token', newToken);
    setAdminToken(newToken);
    navigate('/admin/dashboard');
  };

  const handleAdminLogout = async () => {
    if (adminToken) {
      try {
        await fetch('/api/admin/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${adminToken}` },
        });
      } catch {
        // best effort
      }
    }
    localStorage.removeItem('ta_admin_token');
    setAdminToken(null);
    navigate('/admin/login');
  };

  // Route: /admin/login
  if (currentPath === '/admin/login') {
    return (
      <AdminLogin
        onSuccess={handleAdminLoginSuccess}
        onNavigateHome={() => navigate('/')}
      />
    );
  }

  // Route: /admin/dashboard or /admin
  if (currentPath === '/admin/dashboard' || currentPath === '/admin') {
    if (adminToken) {
      return (
        <AdminPanel
          token={adminToken}
          onLogout={handleAdminLogout}
          onNavigateHome={() => navigate('/')}
        />
      );
    }
    return (
      <AdminLogin
        onSuccess={handleAdminLoginSuccess}
        onNavigateHome={() => navigate('/')}
      />
    );
  }

  // Participant Arena Route (/)
  return (
    <div className="min-h-screen admin-grid-bg text-[#111808] flex flex-col font-sans selection:bg-[#FFF0BA] selection:text-[#111808]">
      {/* Top Navigation */}
      <Navbar
        user={user}
        activeTab={activeTab === 'arena' ? 'arena' : 'leaderboard'}
        setActiveTab={(tab) => {
          if (tab === 'admin') {
            navigate(adminToken ? '/admin/dashboard' : '/admin/login');
          } else {
            setActiveTab(tab);
          }
        }}
        onOpenAuth={() => {
          setAuthMode('register');
          setIsAuthOpen(true);
        }}
        onOpenAdminAuth={() => {
          navigate(adminToken ? '/admin/dashboard' : '/admin/login');
        }}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'arena' && (
          <QualifierTerminal
            user={user}
            token={token}
            onOpenAuth={() => {
              setAuthMode('register');
              setIsAuthOpen(true);
            }}
            onOpenFileAppeal={() => setIsAppealOpen(true)}
            onProfileUpdated={() => fetchProfile()}
          />
        )}

        {activeTab === 'leaderboard' && <LeaderboardView />}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E5E0D8] bg-[#FAFAF7] py-6 px-4 text-xs text-[#656858]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-white border border-[#E5E0D8] p-0.5 flex items-center justify-center shadow-xs overflow-hidden">
              <img
                src="/assets/aistudio/acd7f777-797e-4ce6-ae26-4077fe5fb474_aeab48d4.png"
                alt="Tech Arena"
                className="w-full h-full object-contain"
              />
            </div>
            <span className="font-heading font-bold text-[#111808]">TECH ARENA 2026</span>
            <span>— Inter-College Technical Championship</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] font-mono">
            <button
              onClick={() => navigate(adminToken ? '/admin/dashboard' : '/admin/login')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F0EEE6] hover:bg-[#E5E0D8] text-[#111808] font-semibold border border-[#E5E0D8] transition-colors cursor-pointer"
            >
              <Lock className="w-3 h-3 text-[#111808]" />
              <span>Chief Proctor Room</span>
            </button>
            <span className="text-[#E5E0D8]">|</span>
            <span className="text-[#656858]">Server: Active</span>
            <span className="text-[#656858]">Anti-Cheat: Enforced</span>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        initialMode={authMode}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* Appeal Modal */}
      {token && (
        <AppealModal
          isOpen={isAppealOpen}
          token={token}
          blockReason={user?.blockReason}
          onClose={() => setIsAppealOpen(false)}
          onSubmitted={() => fetchProfile()}
        />
      )}
    </div>
  );
};
