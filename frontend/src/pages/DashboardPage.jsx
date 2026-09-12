import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, AlertTriangle, TrendingUp, Activity,
  Search, Filter, ChevronUp, ChevronDown,
  ChevronLeft, ChevronRight, RefreshCw, Plus, X, Download, FileText
} from 'lucide-react'
import TopBar from '../components/TopBar'
import StatCard from '../components/StatCard'
import RiskBadge from '../components/RiskBadge'
import { SkeletonTable, SkeletonCard } from '../components/SkeletonLoader'
import EmptyState from '../components/EmptyState'
import { studentsAPI, analyticsAPI, predictionsAPI, reportsAPI } from '../api/client'

export default function DashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const isStudentsRoute = location.pathname === '/students'

  // Analytics
  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)

  // Students
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const perPage = 20

  // Filters
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('')
  const [year, setYear] = useState('')
  const [riskLevel, setRiskLevel] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [order, setOrder] = useState('asc')

  // Batch predict
  const [batchLoading, setBatchLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({
    name: '', roll_number: '', email: '', department: 'CSE', year: 1,
    attendance_pct: 75, backlogs: 0, grade_trend: 0, fee_delay_days: 0,
    family_income_bracket: 'mid', extracurricular: true, attendance_trend_3m: 0,
  })
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')

  const fetchStats = useCallback(async () => {
    try {
      const res = await analyticsAPI.summary()
      setStats(res.data)
    } catch { /* ignore */ }
    finally { setStatsLoading(false) }
  }, [])

  const fetchStudents = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = { page, per_page: perPage, sort_by: sortBy, order }
      if (search) params.search = search
      if (department) params.department = department
      if (year) params.year = year
      if (riskLevel) params.risk_level = riskLevel
      const res = await studentsAPI.list(params)
      setStudents(res.data.students)
      setTotal(res.data.total)
      setPages(res.data.pages)
    } catch {
      setError('Could not load students. Make sure the backend is running.')
    } finally { setLoading(false) }
  }, [page, perPage, sortBy, order, search, department, year, riskLevel])

  useEffect(() => { fetchStats() }, [fetchStats])
  useEffect(() => { fetchStudents() }, [fetchStudents])

  // Debounced search
  const [searchInput, setSearchInput] = useState('')
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const handleSort = (col) => {
    if (sortBy === col) {
      setOrder(o => o === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(col)
      setOrder('asc')
    }
    setPage(1)
  }

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return null
    return order === 'asc'
      ? <ChevronUp size={12} style={{ opacity: 0.7 }} />
      : <ChevronDown size={12} style={{ opacity: 0.7 }} />
  }

  const handleBatchPredict = async () => {
    setBatchLoading(true)
    try {
      await predictionsAPI.batch(null)
      await fetchStudents()
      await fetchStats()
    } catch { /* ignore */ }
    finally { setBatchLoading(false) }
  }

  const handleAddStudent = async (e) => {
    e.preventDefault()
    setAddError('')
    setAddLoading(true)
    try {
      await studentsAPI.create({
        ...addForm,
        year: parseInt(addForm.year, 10),
        attendance_pct: parseFloat(addForm.attendance_pct),
        backlogs: parseInt(addForm.backlogs, 10),
        grade_trend: parseFloat(addForm.grade_trend),
        fee_delay_days: parseInt(addForm.fee_delay_days, 10),
        attendance_trend_3m: parseFloat(addForm.attendance_trend_3m),
      })
      setShowAdd(false)
      setAddForm({
        name: '', roll_number: '', email: '', department: 'CSE', year: 1,
        attendance_pct: 75, backlogs: 0, grade_trend: 0, fee_delay_days: 0,
        family_income_bracket: 'mid', extracurricular: true, attendance_trend_3m: 0,
      })
      await fetchStudents()
      await fetchStats()
    } catch (err) {
      setAddError(err.response?.data?.error || 'Failed to create student')
    } finally {
      setAddLoading(false)
    }
  }

  const handleExportCSV = async () => {
    try {
      const params = {}
      if (search) params.search = search
      if (department) params.department = department
      if (year) params.year = year
      if (riskLevel) params.risk_level = riskLevel
      
      const res = await studentsAPI.exportCSV(params)
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('link')
      link.href = url
      link.setAttribute('download', 'students_export.csv')
      document.body.appendChild(link)
      link.click()
    } catch (err) {
      console.error("Failed to export CSV", err)
    }
  }

  const handleDownloadHighRiskCSV = async () => {
    try {
      const res = await studentsAPI.exportCSV({ risk_level: 'High' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('link')
      link.href = url
      link.setAttribute('download', 'high_risk_students.csv')
      document.body.appendChild(link)
      link.click()
    } catch (err) {
      console.error("Failed to export High-Risk CSV", err)
    }
  }

  const handleDownloadHighRiskPDF = async () => {
    try {
      const res = await reportsAPI.downloadHighRiskPDF()
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('link')
      link.href = url
      link.setAttribute('download', 'high_risk_report.pdf')
      document.body.appendChild(link)
      link.click()
    } catch (err) {
      console.error("Failed to export High-Risk PDF", err)
    }
  }

  const departments = ['CSE', 'ECE', 'ME', 'CE', 'MBA', 'BCA', 'Commerce', 'Physics']

  const title = isStudentsRoute ? 'Students' : 'Dashboard'

  return (
    <>
      <TopBar
        title={title}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="dropdown" style={{ position: 'relative' }}>
              <button className="btn btn-secondary" onClick={() => document.getElementById('export-menu').classList.toggle('show')}>
                <Download size={14} /> Export
              </button>
              <div id="export-menu" className="dropdown-menu" style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 8, minWidth: 220, zIndex: 10, display: 'none', flexDirection: 'column', gap: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                <button className="btn btn-ghost" style={{ justifyContent: 'flex-start' }} onClick={() => { handleExportCSV(); document.getElementById('export-menu').classList.remove('show'); }}>
                  <FileText size={14} /> Export Filtered (CSV)
                </button>
                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                <button className="btn btn-ghost" style={{ justifyContent: 'flex-start', color: 'var(--risk-high)' }} onClick={() => { handleDownloadHighRiskCSV(); document.getElementById('export-menu').classList.remove('show'); }}>
                  <Download size={14} /> High-Risk Only (CSV)
                </button>
                <button className="btn btn-ghost" style={{ justifyContent: 'flex-start', color: 'var(--risk-high)' }} onClick={() => { handleDownloadHighRiskPDF(); document.getElementById('export-menu').classList.remove('show'); }}>
                  <FileText size={14} /> High-Risk Only (PDF)
                </button>
              </div>
            </div>
            <button
              className="btn btn-secondary"
              onClick={() => setShowAdd(true)}
            >
              <Plus size={14} /> Add Student
            </button>
            <button
              id="batch-predict-btn"
              className="btn btn-primary"
              onClick={handleBatchPredict}
              disabled={batchLoading}
            >
              <RefreshCw size={14} className={batchLoading ? 'spinning' : ''} />
              {batchLoading ? 'Running...' : 'Run All'}
            </button>
          </div>
        }
      />

      {/* Close dropdown on click outside */}
      <div onClick={(e) => {
        if (!e.target.closest('.dropdown')) {
          const menu = document.getElementById('export-menu');
          if (menu) menu.classList.remove('show');
        }
      }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, pointerEvents: 'none' }}>
        <style>{`.dropdown-menu.show { display: flex !important; } .dropdown { pointer-events: auto; }`}</style>
      </div>

      <div className="page-content">
        {/* Stat Cards */}
        {!isStudentsRoute && (
          <div className="stat-grid">
            {statsLoading ? (
              <>
                <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
              </>
            ) : stats ? (
              <>
                <StatCard
                  title="Total Students"
                  value={stats.total_students}
                  icon={Users}
                  color="#14B8A6"
                  subtitle="Across all departments"
                />
                <StatCard
                  title="High Risk"
                  value={stats.risk_distribution?.High || 0}
                  icon={AlertTriangle}
                  color="#EF4444"
                  subtitle="Need immediate attention"
                />
                <StatCard
                  title="Interventions"
                  value={stats.interventions_this_month}
                  icon={Activity}
                  color="#F59E0B"
                  subtitle="This month"
                />
                <StatCard
                  title="Success Rate"
                  value={stats.success_rate}
                  suffix="%"
                  icon={TrendingUp}
                  color="#22C55E"
                  subtitle={`${stats.total_interventions} total interventions`}
                />
              </>
            ) : null}
          </div>
        )}

        {/* Filters */}
        <div className="filter-bar">
          <div style={{ position: 'relative', flex: '1 1 240px' }}>
            <Search size={15} style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text-muted)', pointerEvents: 'none',
            }} />
            <input
              id="student-search"
              className="input"
              placeholder="Search students by name or roll number..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              style={{ paddingLeft: 34 }}
            />
          </div>
          <select
            id="filter-department"
            className="input"
            value={department}
            onChange={e => { setDepartment(e.target.value); setPage(1) }}
          >
            <option value="">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select
            id="filter-year"
            className="input"
            value={year}
            onChange={e => { setYear(e.target.value); setPage(1) }}
          >
            <option value="">All Years</option>
            {[1, 2, 3, 4].map(y => <option key={y} value={y}>Year {y}</option>)}
          </select>
          <select
            id="filter-risk"
            className="input"
            value={riskLevel}
            onChange={e => { setRiskLevel(e.target.value); setPage(1) }}
          >
            <option value="">All Risk Levels</option>
            <option value="High">High Risk</option>
            <option value="Medium">Medium Risk</option>
            <option value="Low">Low Risk</option>
          </select>
        </div>

        {/* Student Table */}
        {loading ? (
          <SkeletonTable rows={8} />
        ) : error ? (
          <EmptyState
            icon="error"
            title="Unable to load students"
            description={error}
            action={<button className="btn btn-primary" onClick={fetchStudents}>Retry</button>}
          />
        ) : students.length === 0 ? (
          <EmptyState
            icon="search"
            title="No students found"
            description="Try adjusting your search or filter criteria, or add a new student."
            action={<button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={14} /> Add Student</button>}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th onClick={() => handleSort('name')}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        Name <SortIcon col="name" />
                      </span>
                    </th>
                    <th onClick={() => handleSort('department')}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        Department <SortIcon col="department" />
                      </span>
                    </th>
                    <th onClick={() => handleSort('year')}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        Year <SortIcon col="year" />
                      </span>
                    </th>
                    <th>Risk Level</th>
                    <th onClick={() => handleSort('attendance_pct')}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        Attendance <SortIcon col="attendance_pct" />
                      </span>
                    </th>
                    <th onClick={() => handleSort('backlogs')}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        Backlogs <SortIcon col="backlogs" />
                      </span>
                    </th>
                    <th>Risk Score</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence mode="popLayout">
                    {students.map((s, i) => {
                      const pred = s.latest_prediction
                      const score = pred?.risk_score || 0
                      const riskColor = pred?.risk_level === 'High' ? 'var(--risk-high)'
                        : pred?.risk_level === 'Medium' ? 'var(--risk-medium)'
                        : 'var(--risk-low)'

                      return (
                        <motion.tr
                          key={s.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15, delay: i * 0.02 }}
                          onClick={() => navigate(`/students/${s.id}`)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td>
                            <div>
                              <p style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</p>
                              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.roll_number}</p>
                            </div>
                          </td>
                          <td>
                            <span style={{
                              fontSize: 12, padding: '3px 10px', borderRadius: 6,
                              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                            }}>{s.department}</span>
                          </td>
                          <td>{s.year}</td>
                          <td><RiskBadge level={pred?.risk_level} /></td>
                          <td>
                            <span style={{
                              color: s.attendance_pct < 60 ? 'var(--risk-high)'
                                : s.attendance_pct < 75 ? 'var(--risk-medium)'
                                : 'var(--text-primary)',
                              fontWeight: 500,
                            }}>
                              {s.attendance_pct?.toFixed(1)}%
                            </span>
                          </td>
                          <td>
                            <span style={{
                              color: s.backlogs > 3 ? 'var(--risk-high)'
                                : s.backlogs > 0 ? 'var(--risk-medium)'
                                : 'var(--text-secondary)',
                              fontWeight: 500,
                            }}>
                              {s.backlogs}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 100 }}>
                              <div className="risk-bar" style={{ flex: 1 }}>
                                <div
                                  className="risk-bar-fill"
                                  style={{ width: `${score}%`, background: riskColor }}
                                />
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 600, color: riskColor, minWidth: 24, textAlign: 'right' }}>
                                {score.toFixed(0)}
                              </span>
                            </div>
                          </td>
                        </motion.tr>
                      )
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="pagination">
              <span>
                Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total} students
              </span>
              <div className="page-buttons">
                <button
                  className="btn btn-ghost"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                <button
                  className="btn btn-ghost"
                  disabled={page >= pages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add Student Modal */}
      <AnimatePresence>
        {showAdd && (
          <div className="modal-overlay" onClick={() => setShowAdd(false)}>
            <motion.div
              className="modal-content"
              onClick={e => e.stopPropagation()}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <div className="modal-header">
                <h3>Add New Student</h3>
                <button className="icon-btn" onClick={() => setShowAdd(false)}>
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAddStudent} className="modal-body form-grid">
                {addError && (
                  <div className="alert error" style={{ gridColumn: '1 / -1' }}>
                    <AlertTriangle size={16} />
                    {addError}
                  </div>
                )}
                
                <div className="form-group">
                  <label>Name</label>
                  <input
                    className="input"
                    required
                    value={addForm.name}
                    onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                
                <div className="form-group">
                  <label>Roll Number</label>
                  <input
                    className="input"
                    required
                    value={addForm.roll_number}
                    onChange={e => setAddForm(f => ({ ...f, roll_number: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    className="input"
                    required
                    value={addForm.email}
                    onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label>Department</label>
                  <select
                    className="input"
                    value={addForm.department}
                    onChange={e => setAddForm(f => ({ ...f, department: e.target.value }))}
                  >
                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label>Year</label>
                  <input
                    type="number"
                    min="1" max="4"
                    className="input"
                    required
                    value={addForm.year}
                    onChange={e => setAddForm(f => ({ ...f, year: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label>Attendance %</label>
                  <input
                    type="number"
                    step="0.1" min="0" max="100"
                    className="input"
                    required
                    value={addForm.attendance_pct}
                    onChange={e => setAddForm(f => ({ ...f, attendance_pct: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label>Backlogs</label>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    required
                    value={addForm.backlogs}
                    onChange={e => setAddForm(f => ({ ...f, backlogs: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label>Grade Trend</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    required
                    value={addForm.grade_trend}
                    onChange={e => setAddForm(f => ({ ...f, grade_trend: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label>Fee Delay (Days)</label>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    required
                    value={addForm.fee_delay_days}
                    onChange={e => setAddForm(f => ({ ...f, fee_delay_days: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label>Income Bracket</label>
                  <select
                    className="input"
                    value={addForm.family_income_bracket}
                    onChange={e => setAddForm(f => ({ ...f, family_income_bracket: e.target.value }))}
                  >
                    <option value="low">Low</option>
                    <option value="mid">Mid</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    id="extracurricular"
                    checked={addForm.extracurricular}
                    onChange={e => setAddForm(f => ({ ...f, extracurricular: e.target.checked }))}
                  />
                  <label htmlFor="extracurricular" style={{ marginBottom: 0 }}>Participates in Extracurricular Activities</label>
                </div>

                <div className="modal-footer" style={{ gridColumn: '1 / -1' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={addLoading}>
                    {addLoading ? 'Adding...' : 'Add Student'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinning { animation: spin 1s linear infinite; }
      `}</style>
    </>
  )
}
