import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// ─── Auth ───────────────────────────────────────
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
  register: (data) => api.post('/auth/register', data),
  updateUser: (id, data) => api.patch(`/auth/users/${id}`, data),
}

// ─── Students ───────────────────────────────────
export const studentsAPI = {
  list: (params) => api.get('/students', { params }),
  get: (id) => api.get(`/students/${id}`),
  create: (data) => api.post('/students', data),
  update: (id, data) => api.patch(`/students/${id}`, data),
  delete: (id) => api.delete(`/students/${id}`),
  bulkUpload: (formData) => api.post('/students/bulk', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  exportCSV: () => api.get('/students/export/csv', { responseType: 'blob' }),
}

// ─── Predictions ────────────────────────────────
export const predictionsAPI = {
  predict: (studentId) => api.post(`/predict/${studentId}`),
  batch: (student_ids) => api.post('/predict/batch', { student_ids }),
}

// ─── Interventions ──────────────────────────────
export const interventionsAPI = {
  list: (params) => api.get('/interventions', { params }),
  create: (data) => api.post('/interventions', data),
  update: (id, data) => api.patch(`/interventions/${id}`, data),
  delete: (id) => api.delete(`/interventions/${id}`),
}

// ─── Analytics ──────────────────────────────────
export const analyticsAPI = {
  summary: () => api.get('/analytics/summary'),
}

// ─── Admin ──────────────────────────────────────
export const adminAPI = {
  users: () => api.get('/admin/users'),
  deactivateUser: (id) => api.delete(`/admin/users/${id}`),
  retrain: (formData) => api.post('/admin/retrain', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 600000, // 10 min for training
  }),
  auditLog: (params) => api.get('/admin/audit-log', { params }),
  modelMetrics: () => api.get('/admin/model-metrics'),
}

// ─── Reports ────────────────────────────────────
export const reportsAPI = {
  downloadPDF: (studentId) => api.get(`/reports/${studentId}/pdf`, { responseType: 'blob' }),
}

// ─── Notifications ──────────────────────────────
export const notificationsAPI = {
  list: (params) => api.get('/notifications', { params }),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
}

export default api
