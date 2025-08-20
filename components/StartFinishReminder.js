'use client'

import { AlertCircle } from 'lucide-react'

export default function StartFinishReminder({ observations }) {
  // Helper function to check if an observation is a START node
  const isStartObservation = (obs) => {
    return obs.code && (
      obs.code.toLowerCase().includes('start') || 
      obs.code.toLowerCase().includes('begin') ||
      obs.code === 'ST' || 
      obs.code === 'START'
    )
  }

  // Helper function to check if an observation is a FINISH node  
  const isFinishObservation = (obs) => {
    return obs.code && (
      obs.code.toLowerCase().includes('finish') || 
      obs.code.toLowerCase().includes('end') ||
      obs.code === 'FN' || 
      obs.code === 'FINISH'
    )
  }

  // Don't show anything if there are no observations
  if (observations.length === 0) {
    return null
  }

  // Check conditions
  const hasStart = observations.some(isStartObservation)
  const hasFinish = observations.some(isFinishObservation)
  
  // Determine what to show
  let message = null
  
  if (!hasStart && !hasFinish) {
    message = "START and FINISH observation required"
  } else if (hasStart && !hasFinish) {
    message = "FINISH observation required"
  }
  // If both exist, return null (show nothing)
  
  if (!message) {
    return null
  }

  return (
    <div className="bg-orange-50 p-3 rounded border border-orange-200">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0" />
        <div className="text-orange-800 font-medium text-sm">{message}</div>
      </div>
    </div>
  )
}