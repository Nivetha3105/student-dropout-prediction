import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, RefreshCw, FileDown, Plus, X,
  TrendingDown, TrendingUp, AlertTriangle, Shield,
  Calendar, Mail, Hash, Building, BookOpen,
  Clock, DollarSign, Users as UsersIcon, Activity
} from 'lucide-react'
import TopBar from '../components/TopBar'
import RiskBadge from '../components/RiskBadge'
import { SkeletonDetail } from '../components/SkeletonLoader'
import EmptyState from '../components/EmptyState'
import { studentsAPI, predictionsAPI, interventionsAPI, reportsAPI } from '../api/client'

const ACTION_TYPES = [
  'Counseling Session',
  'Academic Support',
  'Fee Waiver / Extension',
  'Family Contact',
  'Attendance Warning',
  'Mentorship Assignment',
  'Medical Referral',
  'Scholarship Assistance',
  'Other',
]

const OUTCOME_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'improved', label: 'Improved' },
  { value: 'no_change', label: 'No Change' },
  { value: 'dropped', label: 'Dropped Out' },
]

export default function StudentDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [student, setStudent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [predLoading, setPredLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)

  // Intervention modal
  const [showModal, setShowModal] = useState(false)
  const [intForm, setIntForm] = useState({
    action_taken: ACTION_TYPES[0],
    notes: '',
    follow_up_date: '',
  })
  const [intLoading, setIntLoading] = useState(false)

  const fetchStudent = useCallback(async () => {
    setLoading(true)
    try {
      const res = await studentsAPI.get(id)
      setStudent(res.data)
    } catch {
      navigate('/dashboard')
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => { fetchStudent() }, [fetchStudent])

  const handlePredict = async () => {
    setPredLoading(true)
    try {
      await predictionsAPI.predict(id)
      await fetchStudent()
    } catch { /* ignore */ }
    finally { setPredLoading(false) }
  }

  const handleDownloadPDF = async () => {
    setPdfLoading(true)
    try {
      const res = await reportsAPI.downloadPDF(id)
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = `risk_report_${student?.roll_number || id}.pdf`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch { /* ignore */ }
    finally { setPdfLoading(false) }
  }

  const handleLogIntervention = async (e) => {
    e.preventDefault()
    setIntLoading(true)
    try {
      await interventionsAPI.create({
        student_id: parseInt(id),
        action_taken: intForm.action_taken,
        notes: intForm.notes,
        follow_up_date: intForm.follow_up_date || undefined,
      })
      setShowModal(false)
      setIntForm({ action_taken: ACTION_TYPES[0], notes: '', follow_up_date: '' })
      await fetchStudent()
    } catch { /* ignore */ }
    finally { setIntLoading(false) }
  }

  const handleUpdateOutcome = async (interventionId, newOutcome) => {
    try {
      await interventionsAPI.update(interventionId, { outcome_status: newOutcome })
      await fetchStudent()
    } catch { /* ignore */ }
  }

  const formatDate = (iso) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    })
  }

  if (loading) {
    return (
      <>
        <TopBar title="Student Detail" />
        <div className="page-content"><SkeletonDetail /></div>
      </>
    )
  }

  if (!student) return null

  const pred = student.latest_prediction
  const riskColor = pred?.risk_level === 'High' ? '#EF4444'
    : pred?.risk_level === 'Medium' ? '#F59E0B' : '#22C55E'

  return (
    <>
      <TopBar
        title={student.name}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => navigate(-1)}>
              <ArrowLeft size={14} /> Back
            </button>
            <button
              id="run-prediction-btn"
              className="btn btn-primary"
              onClick={handlePredict}
              disabled={predLoading}
            >
              <RefreshCw size={14} className={predLoading ? 'spinning' : ''} />
              {predLoading ? 'Predicting...' : 'Run Prediction'}
            </button>
            <button
              id="download-pdf-btn"
              className="btn btn-secondary"
              onClick={handleDownloadPDF}
              disabled={pdfLoading}
            >
              <FileDown size={14} />
              {pdfLoading ? 'Generating...' : 'PDF Report'}
            </button>
          </div>
        }
      />

      <div className="page-content">
        <div className="detail-grid">

          {/* ── Student Info Card ── */}
          <motion.div
            className="card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UsersIcon size={16} color="var(--accent)" /> Student Information
            </h2>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label"><Hash size={11} style={{ verticalAlign: -1, marginRight: 3 }} />Roll Number</span>
                <span className="info-value">{student.roll_number}</span>
              </div>
              <div className="info-item">
                <span className="info-label"><Mail size={11} style={{ verticalAlign: -1, marginRight: 3 }} />Email</span>
                <span className="info-value">{student.email || '—'}</span>
              </div>
              <div className="info-item">
                <span className="info-label"><Building size={11} style={{ verticalAlign: -1, marginRight: 3 }} />Department</span>
                <span className="info-value">{student.department}</span>
              </div>
              <div className="info-item">
                <span className="info-label"><BookOpen size={11} style={{ verticalAlign: -1, marginRight: 3 }} />Year</span>
                <span className="info-value">Year {student.year}</span>
              </div>
              <div className="info-item">
                <span className="info-label"><Activity size={11} style={{ verticalAlign: -1, marginRight: 3 }} />Attendance</span>
                <span className="info-value" style={{
                  color: student.attendance_pct < 60 ? 'var(--risk-high)'
                    : student.attendance_pct < 75 ? 'var(--risk-medium)' : 'var(--risk-low)'
                }}>
                  {student.attendance_pct?.toFixed(1)}%
                </span>
              </div>
              <div className="info-item">
                <span className="info-label"><BookOpen size={11} style={{ verticalAlign: -1, marginRight: 3 }} />Backlogs</span>
                <span className="info-value">{student.backlogs}</span>
              </div>
              <div className="info-item">
                <span className="info-label"><TrendingDown size={11} style={{ verticalAlign: -1, marginRight: 3 }} />Grade Trend</span>
                <span className="info-value" style={{
                  color: student.grade_trend < -0.5 ? 'var(--risk-high)'
                    : student.grade_trend > 0.5 ? 'var(--risk-low)' : 'var(--text-primary)'
                }}>
                  {student.grade_trend > 0 ? '+' : ''}{student.grade_trend?.toFixed(2)}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label"><DollarSign size={11} style={{ verticalAlign: -1, marginRight: 3 }} />Fee Delay</span>
                <span className="info-value">{student.fee_delay_days} days</span>
              </div>
              <div className="info-item">
                <span className="info-label"><DollarSign size={11} style={{ verticalAlign: -1, marginRight: 3 }} />Family Income</span>
                <span className="info-value" style={{ textTransform: 'capitalize' }}>{student.family_income_bracket}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Extracurricular</span>
                <span className="info-value">{student.extracurricular ? 'Active' : 'None'}</span>
              </div>
            </div>
          </motion.div>

          {/* ── Risk Assessment Card ── */}
          <motion.div
            className="card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.08 }}
          >
            <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield size={16} color={riskColor} /> Risk Assessment
            </h2>

            {pred ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                  <RiskBadge level={pred.risk_level} size="lg" />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Risk Score</span>
                      <span style={{ fontSize: 18, fontWeight: 700, color: riskColor }}>
                        {pred.risk_score?.toFixed(0)}/100
                      </span>
                    </div>
                    <div className="risk-bar" style={{ height: 8 }}>
                      <motion.div
                        className="risk-bar-fill"
                        initial={{ width: 0 }}
                        animate={{ width: `${pred.risk_score}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        style={{ background: riskColor }}
                      />
                    </div>
                  </div>
                </div>

                {/* Class probabilities */}
                {pred.probabilities && (
                  <div style={{
                    display: 'flex', gap: 12, marginBottom: 16,
                    padding: '10px 14px', background: 'var(--bg-elevated)',
                    borderRadius: 8, border: '1px solid var(--border)',
                  }}>
                    {Object.entries(pred.probabilities).map(([cls, prob]) => (
                      <div key={cls} style={{ flex: 1, textAlign: 'center' }}>
                        <p style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {cls}
                        </p>
                        <p style={{
                          fontSize: 16, fontWeight: 700,
                          color: cls === 'High' ? '#EF4444' : cls === 'Medium' ? '#F59E0B' : '#22C55E',
                        }}>
                          {(prob * 100).toFixed(1)}%
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  <Clock size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
                  Last predicted: {formatDate(pred.predicted_at)} · via {pred.triggered_by}
                </p>
              </>
            ) : (
              <EmptyState
                title="No prediction yet"
                description="Click 'Run Prediction' to assess this student's risk."
              />
            )}
          </motion.div>

          {/* ── Explainable Risk Factors ── */}
          <motion.div
            className="card full-width"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.16 }}
          >
            <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} color="#F59E0B" /> Key Risk Factors
            </h2>
            <p className="section-subtitle">
              Top contributing factors that explain why this student was flagged (powered by SHAP explainability)
            </p>

            {pred?.top_factors?.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
                {pred.top_factors.map((factor, i) => {
                  const isRisk = factor.impact === 'increases_risk'
                  return (
                    <motion.div
                      key={i}
                      className="factor-card"
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + i * 0.1 }}
                    >
                      <div className={`factor-icon ${isRisk ? 'risk' : 'safe'}`}>
                        {isRisk ? <TrendingDown size={18} /> : <TrendingUp size={18} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                            {factor.display_name}
                          </span>
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12,
                            background: isRisk ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                            color: isRisk ? '#EF4444' : '#22C55E',
                          }}>
                            {isRisk ? '▲ Risk' : '▼ Safe'}
                          </span>
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {factor.explanation}
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                          SHAP value: {factor.shap_value?.toFixed(4)}
                        </p>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            ) : (
              <EmptyState
                title="No risk factors available"
                description="Run a prediction to see explainable risk factors."
              />
            )}
          </motion.div>

          {/* ── Intervention History ── */}
          <motion.div
            className="card full-width"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.24 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 className="section-title" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calendar size={16} color="var(--accent)" /> Intervention History
              </h2>
              <button
                id="log-intervention-btn"
                className="btn btn-primary"
                onClick={() => setShowModal(true)}
              >
                <Plus size={14} /> Log Intervention
              </button>
            </div>

            {student.interventions?.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Action</th>
                      <th>Faculty</th>
                      <th>Notes</th>
                      <th>Outcome</th>
                      <th>Follow-up</th>
                    </tr>
                  </thead>
                  <tbody>
                    {student.interventions.map(iv => (
                      <tr key={iv.id} style={{ cursor: 'default' }}>
                        <td style={{ whiteSpace: 'nowrap' }}>{formatDate(iv.date)}</td>
                        <td style={{ fontWeight: 500 }}>{iv.action_taken}</td>
                        <td>{iv.faculty_name || '—'}</td>
                        <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {iv.notes || '—'}
                        </td>
                        <td>
                          <select
                            className="input"
                            value={iv.outcome_status}
                            onChange={(e) => handleUpdateOutcome(iv.id, e.target.value)}
                            style={{
                              fontSize: 12, padding: '4px 8px', minWidth: 110,
                              color: iv.outcome_status === 'improved' ? 'var(--risk-low)'
                                : iv.outcome_status === 'dropped' ? 'var(--risk-high)'
                                : iv.outcome_status === 'no_change' ? 'var(--risk-medium)'
                                : 'var(--text-secondary)',
                              fontWeight: 600,
                            }}
                          >
                            {OUTCOME_OPTIONS.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>{formatDate(iv.follow_up_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="No interventions logged"
                description="Click 'Log Intervention' to record an action taken for this student."
              />
            )}
          </motion.div>

          {/* ── Prediction History ── */}
          {student.predictions?.length > 1 && (
            <motion.div
              className="card full-width"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.32 }}
            >
              <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={16} color="var(--accent)" /> Prediction History
              </h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Risk Level</th>
                      <th>Score</th>
                      <th>Trigger</th>
                    </tr>
                  </thead>
                  <tbody>
                    {student.predictions.map(p => (
                      <tr key={p.id} style={{ cursor: 'default' }}>
                        <td>{formatDate(p.predicted_at)}</td>
                        <td><RiskBadge level={p.risk_level} /></td>
                        <td style={{ fontWeight: 600 }}>{p.risk_score?.toFixed(1)}</td>
                        <td style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>
                          {p.triggered_by}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Log Intervention Modal ── */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowModal(false)}
          >
            <motion.div
              className="modal-content"
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>Log Intervention</h3>
                <button className="icon-btn" onClick={() => setShowModal(false)}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleLogIntervention} style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="modal-body">
                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label className="label" htmlFor="int-action">Action Type</label>
                    <select
                      id="int-action"
                      className="input"
                      value={intForm.action_taken}
                      onChange={e => setIntForm(f => ({ ...f, action_taken: e.target.value }))}
                    >
                      {ACTION_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label className="label" htmlFor="int-notes">Notes</label>
                    <textarea
                      id="int-notes"
                      className="input"
                      rows={3}
                      placeholder="Describe the intervention details..."
                      value={intForm.notes}
                      onChange={e => setIntForm(f => ({ ...f, notes: e.target.value }))}
                      style={{ resize: 'vertical' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="label" htmlFor="int-followup">Follow-up Date (Optional)</label>
                    <input
                      id="int-followup"
                      className="input"
                      type="date"
                      value={intForm.follow_up_date}
                      onChange={e => setIntForm(f => ({ ...f, follow_up_date: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button
                    id="submit-intervention-btn"
                    type="submit"
                    className="btn btn-primary"
                    disabled={intLoading}
                  >
                    {intLoading ? 'Saving...' : 'Log Intervention'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinning { animation: spin 1s linear infinite; }
      `}</style>
    </>
  )
}
