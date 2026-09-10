import { Users, Search, AlertTriangle } from 'lucide-react'

const ICONS = {
  students: Users,
  search: Search,
  error: AlertTriangle,
}

export default function EmptyState({ icon = 'students', title, description, action }) {
  const Icon = ICONS[icon] || Users

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 20px',
      textAlign: 'center',
      gap: 12,
    }}>
      <div style={{
        width: 64,
        height: 64,
        borderRadius: 16,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
      }}>
        <Icon size={28} style={{ color: 'var(--text-muted)' }} />
      </div>
      <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</p>
      {description && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 360 }}>
          {description}
        </p>
      )}
      {action && (
        <div style={{ marginTop: 8 }}>
          {action}
        </div>
      )}
    </div>
  )
}
