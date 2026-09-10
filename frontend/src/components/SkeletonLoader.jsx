export function SkeletonCard() {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="skeleton" style={{ height: 12, width: '40%' }} />
      <div className="skeleton" style={{ height: 32, width: '60%' }} />
      <div className="skeleton" style={{ height: 10, width: '50%' }} />
    </div>
  )
}

export function SkeletonRow() {
  return (
    <tr>
      {[1, 2, 3, 4, 5, 6].map(i => (
        <td key={i}>
          <div className="skeleton" style={{ height: 14, width: i === 1 ? '80%' : '60%' }} />
        </td>
      ))}
    </tr>
  )
}

export function SkeletonTable({ rows = 6 }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {['Name', 'Dept', 'Year', 'Risk', 'Attendance', 'Updated'].map(h => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function SkeletonDetail() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="skeleton" style={{ height: 20, width: '30%' }} />
        <div className="skeleton" style={{ height: 14, width: '50%' }} />
        <div className="skeleton" style={{ height: 14, width: '40%' }} />
      </div>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="skeleton" style={{ height: 14, width: '25%', marginBottom: 8 }} />
        {[1, 2, 3].map(i => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div className="skeleton" style={{ height: 10, width: '35%' }} />
            <div className="skeleton" style={{ height: 10, flex: 1 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
