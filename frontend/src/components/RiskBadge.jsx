import { AlertTriangle, AlertCircle, CheckCircle, HelpCircle } from 'lucide-react'

export default function RiskBadge({ level, size = 'sm' }) {
  const classMap = {
    High: 'badge badge-high',
    Medium: 'badge badge-medium',
    Low: 'badge badge-low',
  }

  const IconMap = {
    High: AlertTriangle,
    Medium: AlertCircle,
    Low: CheckCircle,
  }

  const cls = classMap[level] || 'badge badge-unknown'
  const Icon = IconMap[level] || HelpCircle

  return (
    <span className={cls} style={size === 'lg' ? { fontSize: 13, padding: '5px 14px' } : {}}>
      <Icon size={size === 'lg' ? 14 : 12} style={{ flexShrink: 0 }} />
      {level || 'Unknown'}
    </span>
  )
}

