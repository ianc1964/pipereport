// components/reports/ErrorState.js
'use client'

import { AlertCircle } from 'lucide-react'

export default function ErrorState({ 
  title = 'Unable to Load', 
  message = 'An error occurred',
  icon: Icon = AlertCircle,
  iconColor = 'text-red-500'
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md">
        <Icon className={`w-16 h-16 ${iconColor} mx-auto mb-4`} />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  )
}