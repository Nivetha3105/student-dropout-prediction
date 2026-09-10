import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

function useCountUp(end, duration = 1200, start = 0) {
  const [value, setValue] = useState(start)
  const rafRef = useRef(null)

  useEffect(() => {
    const startTime = performance.now()
    const diff = end - start

    function tick(now) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out quad
      const eased = 1 - (1 - progress) * (1 - progress)
      setValue(Math.round(start + diff * eased))
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [end, duration, start])

  return value
}

export default function StatCard({ title, value, subtitle, icon: Icon, color, trend, suffix = '' }) {
  const animated = useCountUp(typeof value === 'number' ? value : 0)
  const display = typeof value === 'number' ? animated : value

  return (
    <motion.div
      className="card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ position: 'relative', overflow: 'hidden' }}
    >
      {/* Background glow */}
      <div style={{
        position: 'absolute',
        top: -30,
        right: -30,
        width: 100,
        height: 100,
        borderRadius: '50%',
        background: color ? `${color}15` : 'transparent',
        filter: 'blur(20px)',
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            {title}
          </p>
          <p className="stat-number" style={{ color: color || 'var(--text-primary)' }}>
            {display}{suffix}
          </p>
          {subtitle && (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
              {subtitle}
            </p>
          )}
          {trend !== undefined && (
            <p style={{
              fontSize: 11,
              marginTop: 4,
              color: trend >= 0 ? 'var(--risk-low)' : 'var(--risk-high)',
              fontWeight: 500,
            }}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% vs last month
            </p>
          )}
        </div>
        {Icon && (
          <div style={{
            padding: 10,
            borderRadius: 10,
            background: color ? `${color}15` : 'var(--bg-elevated)',
            border: `1px solid ${color ? `${color}25` : 'var(--border)'}`,
          }}>
            <Icon size={20} style={{ color: color || 'var(--text-secondary)' }} />
          </div>
        )}
      </div>
    </motion.div>
  )
}
