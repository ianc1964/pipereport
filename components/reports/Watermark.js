// components/reports/Watermark.js
'use client'

export default function Watermark({ enabled, text = 'CONFIDENTIAL' }) {
  if (!enabled) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center opacity-5 rotate-45">
        <div className="text-[200px] font-bold text-gray-900 select-none">
          {text}
        </div>
      </div>
    </div>
  )
}