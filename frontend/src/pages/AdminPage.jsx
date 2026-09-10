import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, ShieldCheck, Upload, RefreshCw, Trash2,
  Plus, X, FileText, ChevronLeft, ChevronRight,
  CheckCircle, AlertCircle, Database, Activity
} from 'lucide-react'
import TopBar from '../components/TopBar'
import { SkeletonTable, SkeletonCard } from '../components/SkeletonLoader'
import EmptyState from '../components/EmptyState'
import { useAuth } from '../context/AuthContext'
import { adminAPI, authAPI, studentsAPI } from '../api/client'

const TABS = [
  { id: 'users', label: 'Faculty Management', icon: Users },
  { id: 'upload', label: 'Bulk Upload', icon: Upload },
  { id: 'model', label: 'Model & Retrain', icon: Database },
  { id: 'audit', label: 'Audit Log', icon: FileText },
]

export default function AdminPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('users')

  if (user?.role !== 'admin') {
    return (
      <>
        <TopBar title="Admin Panel" />
        <div className="page-content">
          <EmptyState
            icon="error"
            title="Access Denied"
            description="You need admin privileges to access this panel."
          />
        </div>
      </>
    )
  }

  return (
    <>
      <TopBar title="Admin Panel" />
      <div className="page-content">
        {/* Tab Navigation */}
        <div className="tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <t.icon size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'users' && <UsersTab />}
        {tab === 'upload' && <UploadTab />}
        {tab === 'model' && <ModelTab />}
        {tab === 'audit' && <AuditTab />}
      </div>
    </>
  )
}


/* ─── Users Tab ─────────────────────────────────── */
function UsersTab() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'faculty', department: '' })
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await adminAPI.users()
      setUsers(res.data.users)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchUsers() }, [])

  const handleAdd = async (e) => {
    e.preventDefault()
    setAddError('')
    setAddLoading(true)
    try {
      await authAPI.register(form)
      setShowAdd(false)
      setForm({ name: '', email: '', password: '', role: 'faculty', department: '' })
      await fetchUsers()
    } catch (err) {
      setAddError(err.response?.data?.error || 'Failed to create user')
    } finally {
      setAddLoading(false)
    }
  }

  const handleDeactivate = async (id) => {
    if (!confirm('Deactivate this user?')) return
    try {
      await adminAPI.deactivateUser(id)
      await fetchUsers()
    } catch { /* ignore */ }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 className="section-title" style={{ marginBottom: 0 }}>Users ({users.length})</h3>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={14} /> Add User
        </button>
      </div>

      {loading ? <SkeletonTable rows={4} /> : users.length === 0 ? (
        <EmptyState title="No users" description="Create a user account to get started." />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Department</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ cursor: 'default' }}>
                  <td style={{ fontWeight: 600 }}>{u.name}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{u.email}</td>
                  <td>
                    <span style={{
                      fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 600,
                      textTransform: 'capitalize',
                      background: u.role === 'admin' ? 'rgba(99,102,241,0.12)' : 'var(--bg-elevated)',
                      color: u.role === 'admin' ? 'var(--accent)' : 'var(--text-secondary)',
                      border: `1px solid ${u.role === 'admin' ? 'rgba(99,102,241,0.25)' : 'var(--border)'}`,
                    }}>{u.role}</span>
                  </td>
                  <td>{u.department || '—'}</td>
                  <td>
                    <span style={{
                      fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 600,
                      background: u.is_active ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                      color: u.is_active ? '#22C55E' : '#EF4444',
                      border: `1px solid ${u.is_active ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                    }}>{u.is_active ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td>
                    {u.is_active && (
                      <button className="btn btn-danger" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => handleDeactivate(u.id)}>
                        <Trash2 size={12} /> Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add User Modal */}
      <AnimatePresence>
        {showAdd && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAdd(false)}>
            <motion.div className="modal" initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.97 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>Add New User</h3>
                <button className="btn btn-ghost" onClick={() => setShowAdd(false)} style={{ padding: 6 }}><X size={16} /></button>
              </div>
              {addError && (
                <div className="login-error" style={{ marginBottom: 14 }}>
                  <AlertCircle size={14} /> {addError}
                </div>
              )}
              <form onSubmit={handleAdd}>
                <div style={{ marginBottom: 14 }}>
                  <label className="label">Name</label>
                  <input className="input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Dr. John Doe" />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label className="label">Email</label>
                  <input className="input" type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="john@dropout.edu" />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label className="label">Password</label>
                  <input className="input" type="password" required value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Minimum 6 characters" />
                </div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                  <div style={{ flex: 1 }}>
                    <label className="label">Role</label>
                    <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                      <option value="faculty">Faculty</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="label">Department</label>
                    <input className="input" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="CSE" />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={addLoading}>
                    {addLoading ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}


/* ─── Upload Tab ────────────────────────────────── */
function UploadTab() {
  const fileRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)

  const handleFile = async (file) => {
    if (!file || !file.name.endsWith('.csv')) {
      setResult({ error: 'Please upload a CSV file' })
      return
    }
    setUploading(true)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await studentsAPI.bulkUpload(formData)
      setResult(res.data)
    } catch (err) {
      setResult({ error: err.response?.data?.error || 'Upload failed' })
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    handleFile(file)
  }

  const handleExport = async () => {
    try {
      const res = await studentsAPI.exportCSV()
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = 'students_export.csv'
      link.click()
      window.URL.revokeObjectURL(url)
    } catch { /* ignore */ }
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <h3 className="section-title">Bulk Student Upload</h3>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
        Upload a CSV file with student data. Required columns: name, roll_number, department, year.
      </p>

      <div
        className={`upload-area ${dragging ? 'dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" accept=".csv" hidden onChange={e => handleFile(e.target.files[0])} />
        <Upload size={32} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
          {uploading ? 'Uploading...' : 'Drop CSV file here or click to browse'}
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Supports .csv files up to 16MB
        </p>
      </div>

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            marginTop: 16, padding: 16, borderRadius: 10,
            background: result.error ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)',
            border: `1px solid ${result.error ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            {result.error ? <AlertCircle size={16} color="#EF4444" /> : <CheckCircle size={16} color="#22C55E" />}
            <span style={{ fontWeight: 600, color: result.error ? '#EF4444' : '#22C55E', fontSize: 14 }}>
              {result.error ? 'Upload Failed' : 'Upload Successful'}
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {result.error || result.message}
          </p>
          {result.errors?.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
              {result.errors.slice(0, 5).map((err, i) => <p key={i}>• {err}</p>)}
            </div>
          )}
        </motion.div>
      )}

      <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
        <h3 className="section-title">Export Data</h3>
        <button className="btn btn-secondary" onClick={handleExport}>
          <FileText size={14} /> Export All Students as CSV
        </button>
      </div>
    </div>
  )
}


/* ─── Model Tab ─────────────────────────────────── */
function ModelTab() {
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [retraining, setRetraining] = useState(false)
  const [retrainResult, setRetrainResult] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    adminAPI.modelMetrics()
      .then(res => setMetrics(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleRetrain = async (file) => {
    setRetraining(true)
    setRetrainResult(null)
    try {
      const formData = new FormData()
      if (file) formData.append('file', file)
      const res = await adminAPI.retrain(formData)
      setRetrainResult(res.data)
      // Refresh metrics
      const mRes = await adminAPI.modelMetrics()
      setMetrics(mRes.data)
    } catch (err) {
      setRetrainResult({ error: err.response?.data?.error || 'Retraining failed' })
    } finally {
      setRetraining(false)
    }
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Activity size={16} color="var(--accent)" /> Model Performance
      </h3>

      {loading ? (
        <div className="card"><SkeletonCard /></div>
      ) : metrics ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Model', value: metrics.model_type?.replace('Classifier', '') || 'Random Forest' },
              { label: 'Accuracy', value: `${(metrics.accuracy * 100).toFixed(1)}%`, color: '#22C55E' },
              { label: 'CV Mean', value: `${(metrics.cv_accuracy_mean * 100).toFixed(1)}%`, color: '#6366F1' },
              { label: 'Trees', value: metrics.n_estimators || 200 },
              { label: 'SHAP', value: metrics.shap_available ? 'Enabled' : 'Disabled', color: metrics.shap_available ? '#22C55E' : '#F59E0B' },
            ].map((m, i) => (
              <div key={i} className="card" style={{ padding: 14, textAlign: 'center' }}>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{m.label}</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: m.color || 'var(--text-primary)' }}>{m.value}</p>
              </div>
            ))}
          </div>

          {/* Per-class metrics */}
          {metrics.precision && (
            <div className="card" style={{ marginBottom: 20 }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>Per-Class Metrics</h4>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Class</th><th>Precision</th><th>Recall</th><th>F1 Score</th></tr>
                  </thead>
                  <tbody>
                    {Object.keys(metrics.precision).map(cls => (
                      <tr key={cls} style={{ cursor: 'default' }}>
                        <td style={{ fontWeight: 600 }}>{cls}</td>
                        <td>{(metrics.precision[cls] * 100).toFixed(1)}%</td>
                        <td>{(metrics.recall[cls] * 100).toFixed(1)}%</td>
                        <td>{(metrics.f1[cls] * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Feature importances */}
          {metrics.feature_importances && (
            <div className="card" style={{ marginBottom: 20 }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>Feature Importances</h4>
              {Object.entries(metrics.feature_importances)
                .sort((a, b) => b[1] - a[1])
                .map(([feat, imp]) => (
                  <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 160 }}>{feat}</span>
                    <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${imp * 100 / 0.3}%` }}
                        transition={{ duration: 0.8 }}
                        style={{ height: '100%', borderRadius: 3, background: 'var(--accent)' }}
                      />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', minWidth: 40, textAlign: 'right' }}>
                      {(imp * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
            </div>
          )}
        </>
      ) : (
        <EmptyState title="No model metrics" description="Train the model to see performance metrics." />
      )}

      {/* Retrain */}
      <div className="card">
        <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Retrain Model</h4>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          Optionally upload a new training CSV, or retrain with existing data.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <input ref={fileRef} type="file" accept=".csv" hidden onChange={e => handleRetrain(e.target.files[0])} />
          <button className="btn btn-secondary" onClick={() => fileRef.current?.click()} disabled={retraining}>
            <Upload size={14} /> Upload CSV & Retrain
          </button>
          <button className="btn btn-primary" onClick={() => handleRetrain(null)} disabled={retraining}>
            <RefreshCw size={14} className={retraining ? 'spinning' : ''} />
            {retraining ? 'Retraining...' : 'Retrain with Current Data'}
          </button>
        </div>

        {retrainResult && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              marginTop: 16, padding: 14, borderRadius: 8,
              background: retrainResult.error ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)',
              border: `1px solid ${retrainResult.error ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`,
            }}
          >
            <p style={{ fontWeight: 600, fontSize: 13, color: retrainResult.error ? '#EF4444' : '#22C55E', marginBottom: 4 }}>
              {retrainResult.error ? 'Retraining Failed' : 'Model Retrained Successfully'}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {retrainResult.error || retrainResult.message}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  )
}


/* ─── Audit Tab ─────────────────────────────────── */
function AuditTab() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    setLoading(true)
    adminAPI.auditLog({ page, per_page: 30 })
      .then(res => {
        setLogs(res.data.logs)
        setPages(res.data.pages)
        setTotal(res.data.total)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page])

  const formatDate = (iso) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    })
  }

  return (
    <>
      <h3 className="section-title">Audit Log ({total} entries)</h3>

      {loading ? <SkeletonTable rows={8} /> : logs.length === 0 ? (
        <EmptyState title="No audit entries" description="Actions will appear here as users interact with the system." />
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Entity</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id} style={{ cursor: 'default' }}>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: 12 }}>
                      {formatDate(l.timestamp)}
                    </td>
                    <td style={{ fontWeight: 500 }}>{l.user_name}</td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>
                        {l.action}
                      </span>
                    </td>
                    <td>
                      {l.entity_type && (
                        <span style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 4,
                          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                          textTransform: 'capitalize',
                        }}>{l.entity_type}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <span>Page {page} of {pages}</span>
            <div className="page-buttons">
              <button className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft size={14} /> Prev
              </button>
              <button className="btn btn-ghost" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
