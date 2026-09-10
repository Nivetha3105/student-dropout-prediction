import { useState, useEffect, useRef } from 'react'
import { Bell, X, CheckCheck } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { notificationsAPI } from '../api/client'

const TYPE_COLORS = {
  danger: 'var(--risk-high)',
  warning: 'var(--risk-medium)',
  info: 'var(--accent)',
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const panelRef = useRef(null)

  const fetchNotifications = async () => {
    try {
      const res = await notificationsAPI.list({ per_page: 10 })
      setNotifications(res.data.notifications)
      setUnreadCount(res.data.unread_count)
    } catch {
      // Silently fail
    }
  }

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000) // poll every 30s
    return () => clearInterval(interval)
  }, [])

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const markAllRead = async () => {
    await notificationsAPI.markAllRead()
    setUnreadCount(0)
    setNotifications(n => n.map(x => ({ ...x, is_read: true })))
  }

  const markOne = async (id) => {
    await notificationsAPI.markRead(id)
    setNotifications(n => n.map(x => x.id === id ? { ...x, is_read: true } : x))
    setUnreadCount(c => Math.max(0, c - 1))
  }

  function formatTime(ts) {
    if (!ts) return ''
    const d = new Date(ts)
    const now = new Date()
    const diff = now - d
    if (diff < 60000) return 'just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return d.toLocaleDateString()
  }

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      <button
        id="notification-bell-btn"
        className="btn btn-ghost"
        onClick={() => setOpen(o => !o)}
        style={{ position: 'relative', padding: '8px 10px' }}
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: 'var(--risk-high)',
              color: '#fff',
              fontSize: 9,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid var(--bg-surface)',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              top: '110%',
              right: 0,
              width: 360,
              maxHeight: 480,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
              zIndex: 200,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 16px',
              borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Notifications</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {unreadCount > 0 && (
                  <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={markAllRead}>
                    <CheckCheck size={13} /> Mark all read
                  </button>
                )}
                <button className="btn btn-ghost" style={{ padding: 4 }} onClick={() => setOpen(false)}>
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* List */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {notifications.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  No notifications
                </div>
              ) : (
                notifications.map(n => (
                  <div
                    key={n.id}
                    onClick={() => !n.is_read && markOne(n.id)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border)',
                      background: n.is_read ? 'transparent' : 'rgba(99,102,241,0.04)',
                      cursor: n.is_read ? 'default' : 'pointer',
                      display: 'flex',
                      gap: 10,
                    }}
                  >
                    <div style={{
                      width: 4,
                      borderRadius: 2,
                      background: n.is_read ? 'transparent' : (TYPE_COLORS[n.type] || 'var(--accent)'),
                      flexShrink: 0,
                    }} />
                    <div style={{ flex: 1 }}>
                      <p style={{
                        fontSize: 13,
                        fontWeight: n.is_read ? 400 : 600,
                        color: 'var(--text-primary)',
                        marginBottom: 3,
                      }}>{n.title}</p>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {n.message}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                        {formatTime(n.created_at)}
                      </p>
                    </div>
                    {!n.is_read && (
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: TYPE_COLORS[n.type] || 'var(--accent)',
                        marginTop: 4, flexShrink: 0,
                      }} />
                    )}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
