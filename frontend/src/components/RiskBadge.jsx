export default function RiskBadge({ level, size = 'sm' }) {
  const classMap = {
    High: 'badge badge-high',
    Medium: 'badge badge-medium',
    Low: 'badge badge-low',
  }
  const dotColors = {
    High: '#EF4444',
    Medium: '#F59E0B',
    Low: '#22C55E',
  }

  const cls = classMap[level] || 'badge badge-unknown'
  const dot = dotColors[level]

  return (
    <span className={cls} style={size === 'lg' ? { fontSize: 13, padding: '5px 14px' } : {}}>
      {dot && (
        <span style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: dot,
          display: 'inline-block',
          flexShrink: 0,
        }} />
      )}
      {level || 'Unknown'}
    </span>
  )
}
