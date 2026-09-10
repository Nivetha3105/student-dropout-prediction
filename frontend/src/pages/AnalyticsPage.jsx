import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  AreaChart, Area,
} from 'recharts'
import { BarChart3, TrendingUp, Users, Activity } from 'lucide-react'
import TopBar from '../components/TopBar'
import StatCard from '../components/StatCard'
import { SkeletonCard } from '../components/SkeletonLoader'
import { analyticsAPI } from '../api/client'

const RISK_COLORS = { High: '#EF4444', Medium: '#F59E0B', Low: '#22C55E', Unknown: '#6B7280' }

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="custom-tooltip">
      <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, color: 'var(--text-primary)' }}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.name}:</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    analyticsAPI.summary()
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <>
        <TopBar title="Analytics" />
        <div className="page-content">
          <div className="stat-grid">
            <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
          <div className="chart-grid">
            <div className="card" style={{ height: 350 }}><div className="skeleton" style={{ height: '100%' }} /></div>
            <div className="card" style={{ height: 350 }}><div className="skeleton" style={{ height: '100%' }} /></div>
          </div>
        </div>
      </>
    )
  }

  if (!data) return null

  // Pie data
  const riskPie = Object.entries(data.risk_distribution || {})
    .filter(([k]) => k !== 'Unknown')
    .map(([name, value]) => ({ name, value, color: RISK_COLORS[name] }))

  // Trend data
  const trendData = data.prediction_trend || []

  // Department breakdown
  const deptData = data.department_breakdown || []

  // Intervention by action
  const actionData = data.intervention_by_action || []

  return (
    <>
      <TopBar title="Analytics" />
      <div className="page-content">
        {/* Summary Stats */}
        <div className="stat-grid">
          <StatCard
            title="Total Students"
            value={data.total_students}
            icon={Users}
            color="#6366F1"
          />
          <StatCard
            title="High Risk Students"
            value={data.risk_distribution?.High || 0}
            icon={Activity}
            color="#EF4444"
          />
          <StatCard
            title="Intervention Success"
            value={data.success_rate}
            suffix="%"
            icon={TrendingUp}
            color="#22C55E"
          />
          <StatCard
            title="Total Interventions"
            value={data.total_interventions}
            icon={BarChart3}
            color="#F59E0B"
          />
        </div>

        {/* Charts Row 1 */}
        <div className="chart-grid">
          {/* Risk Distribution Pie */}
          <motion.div
            className="card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h3 className="section-title">Risk Distribution</h3>
            <div style={{ height: 300, display: 'flex', alignItems: 'center' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={riskPie}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {riskPie.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    formatter={(value) => (
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Prediction Trend */}
          <motion.div
            className="card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h3 className="section-title">Risk Trend (Last 6 Months)</h3>
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="gradHigh" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradMedium" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradLow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend formatter={(v) => <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v}</span>} />
                  <Area type="monotone" dataKey="High" stroke="#EF4444" fill="url(#gradHigh)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Medium" stroke="#F59E0B" fill="url(#gradMedium)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Low" stroke="#22C55E" fill="url(#gradLow)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        {/* Charts Row 2 */}
        <div className="chart-grid">
          {/* Department Breakdown */}
          <motion.div
            className="card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h3 className="section-title">Risk by Department</h3>
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptData} layout="vertical" barCategoryGap={6}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} />
                  <YAxis dataKey="department" type="category" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} width={60} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend formatter={(v) => <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v}</span>} />
                  <Bar dataKey="High" stackId="a" fill="#EF4444" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Medium" stackId="a" fill="#F59E0B" />
                  <Bar dataKey="Low" stackId="a" fill="#22C55E" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Intervention Success by Action Type */}
          <motion.div
            className="card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h3 className="section-title">Intervention Outcomes by Type</h3>
            {actionData.length > 0 ? (
              <div style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={actionData} layout="vertical" barCategoryGap={6}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} />
                    <YAxis dataKey="action" type="category" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} width={100} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend formatter={(v) => <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v}</span>} />
                    <Bar dataKey="improved" stackId="a" fill="#22C55E" name="Improved" />
                    <Bar dataKey="pending" stackId="a" fill="#6B7280" name="Pending" />
                    <Bar dataKey="no_change" stackId="a" fill="#F59E0B" name="No Change" />
                    <Bar dataKey="dropped" stackId="a" fill="#EF4444" name="Dropped" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No intervention data yet
              </div>
            )}
          </motion.div>
        </div>

        {/* Year Distribution */}
        {data.year_distribution?.length > 0 && (
          <motion.div
            className="card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            style={{ maxWidth: 500 }}
          >
            <h3 className="section-title">Students by Year</h3>
            <div style={{ display: 'flex', gap: 12 }}>
              {data.year_distribution.map(y => (
                <div key={y.year} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{
                    height: 80,
                    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                    marginBottom: 8,
                  }}>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${(y.count / Math.max(...data.year_distribution.map(d => d.count))) * 100}%` }}
                      transition={{ duration: 0.6, delay: 0.6 + y.year * 0.1 }}
                      style={{
                        width: '100%', maxWidth: 48, borderRadius: '6px 6px 0 0',
                        background: `linear-gradient(to top, var(--accent), rgba(99,102,241,0.4))`,
                      }}
                    />
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{y.count}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Year {y.year}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </>
  )
}
