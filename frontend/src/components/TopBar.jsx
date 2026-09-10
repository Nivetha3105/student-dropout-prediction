import { Sun, Moon, Menu } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { useLayout } from '../context/LayoutContext'
import NotificationBell from './NotificationBell'

export default function TopBar({ title, actions }) {
  const { theme, toggle } = useTheme()
  const { toggleSidebar } = useLayout()

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 30,
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
      padding: '0 24px',
      height: 56,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          className="btn btn-ghost mobile-menu-btn"
          onClick={toggleSidebar}
          aria-label="Open menu"
          style={{ padding: '8px 10px' }}
        >
          <Menu size={18} />
        </button>
        <h1 style={{
          fontSize: 16,
          fontWeight: 600,
          color: 'var(--text-primary)',
        }}>
          {title}
        </h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {actions}

        {/* Theme toggle */}
        <button
          id="theme-toggle-btn"
          className="btn btn-ghost"
          onClick={toggle}
          style={{ padding: '8px 10px' }}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <NotificationBell />
      </div>
    </header>
  )
}
