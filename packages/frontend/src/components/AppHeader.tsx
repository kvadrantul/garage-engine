import { Link, useLocation } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

function GarageLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="12" height="12" rx="2" fill="#F97316" />
      <rect x="18" y="2" width="12" height="12" rx="2" fill="#F97316" />
      <rect x="2" y="18" width="12" height="12" rx="2" fill="#F97316" />
      <rect x="18" y="18" width="12" height="12" rx="2" fill="#F97316" opacity="0.4" />
    </svg>
  );
}

export function AppHeader({ children }: { children?: React.ReactNode }) {
  const location = useLocation();
  const { theme, toggle } = useTheme();

  const navLink = (to: string, label: string) => {
    const isActive = location.pathname.startsWith(to);
    return (
      <Link
        to={to}
        className={
          isActive
            ? 'text-primary font-medium'
            : 'text-muted-foreground hover:text-foreground transition-colors'
        }
      >
        {label}
      </Link>
    );
  };

  return (
    <header className="bg-card border-b border-border">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/workflows" className="flex items-center gap-2">
            <GarageLogo />
            <span className="text-xl font-bold text-foreground">Garage</span>
            <span className="text-xl font-light text-muted-foreground">Tools</span>
          </Link>
          <nav className="flex items-center gap-4">
            {navLink('/workflows', 'Workflows')}
            {navLink('/executions', 'Executions')}
            {navLink('/credentials', 'Credentials')}
            {navLink('/hitl', 'HITL Requests')}
            {navLink('/custom-nodes', 'Custom Nodes')}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {children}
          <button
            onClick={toggle}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>
    </header>
  );
}
