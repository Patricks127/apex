/**
 * components/PtAthleteCheckins.tsx
 *
 * PT view of an athlete's workout check-ins.
 * Shows effort level, discomfort zones, and notes left by the athlete.
 *
 * Add this to the PT's athlete detail page / ficha do aluno.
 *
 * Usage:
 *   <PtAthleteCheckins studentId={athlete.id} />
 */

'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface CheckinRow {
  session_id: string
  session_title: string
  performed_at: string
  effort: string | null
  discomfort_zones: string[] | null
  note: string | null
  n_sets: number
  volume_kg: number
  avg_rpe: number | null
  completion: number | null
}

const EFFORT_LABELS: Record<string, { label: string; color: string }> = {
  leve: { label: 'Leve 😌', color: 'text-green-600 bg-green-50' },
  moderado: { label: 'Moderado 💪', color: 'text-yellow-600 bg-yellow-50' },
  puxado: { label: 'Puxado 🔥', color: 'text-orange-600 bg-orange-50' },
  maximo: { label: 'Máximo 💥', color: 'text-red-600 bg-red-50' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-PT', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export function PtAthleteCheckins({ studentId }: { studentId: string }) {
  const [rows, setRows] = useState<CheckinRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .rpc('get_athlete_checkins', { p_student_id: studentId, p_limit: 20 })
      .then(({ data, error }) => {
        if (!error && data) setRows(data as CheckinRow[])
        setLoading(false)
      })
  }, [studentId])

  if (loading) {
    return <p className="text-sm text-gray-400 py-4">A carregar check-ins…</p>
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>Sem treinos registados ainda</p>
      </div>
    )
  }

  const rowsWithCheckin = rows.filter(r => r.effort || r.note || (r.discomfort_zones?.length ?? 0) > 0)

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 uppercase tracking-wide">
        Feedback dos treinos
      </h3>

      {rows.map((row) => {
        const hasCheckin = row.effort || row.note || (row.discomfort_zones?.length ?? 0) > 0
        const effortInfo = row.effort ? EFFORT_LABELS[row.effort] : null

        return (
          <div
            key={row.session_id}
            className="rounded-xl border border-gray-100 dark:border-gray-800 p-4"
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-sm">{row.session_title}</p>
                <p className="text-xs text-gray-400">{formatDate(row.performed_at)}</p>
              </div>
              <div className="text-right text-xs text-gray-400">
                {row.n_sets > 0 && <p>{row.n_sets} séries</p>}
                {row.volume_kg > 0 && <p>{row.volume_kg.toLocaleString('pt-PT')} kg</p>}
                {row.avg_rpe && <p>RPE {row.avg_rpe}</p>}
                {row.completion != null && (
                  <p>{Math.round(row.completion * 100)}% concluído</p>
                )}
              </div>
            </div>

            {/* Check-in data */}
            {hasCheckin ? (
              <div className="mt-3 flex flex-col gap-2">
                {effortInfo && (
                  <span className={`inline-flex self-start text-xs px-2 py-1 rounded-full font-medium ${effortInfo.color}`}>
                    {effortInfo.label}
                  </span>
                )}

                {(row.discomfort_zones?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    <span className="text-xs text-gray-500">Desconforto:</span>
                    {row.discomfort_zones!.map((zone) => (
                      <span
                        key={zone}
                        className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full"
                      >
                        {zone}
                      </span>
                    ))}
                  </div>
                )}

                {row.note && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 italic border-l-2 border-gray-200 pl-3">
                    "{row.note}"
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-2 text-xs text-gray-400 italic">Sem feedback deixado</p>
            )}
          </div>
        )
      })}

      <p className="text-xs text-center text-gray-300 mt-2">
        Últimos {rows.length} treinos · {rowsWithCheckin.length} com feedback
      </p>
    </div>
  )
}
