'use client'

// /app/test-fingerprint/page.js
// Simple test page to verify device fingerprinting is working

import { useState, useEffect } from 'react'
import DeviceFingerprint from '@/lib/device-fingerprint'

export default function TestFingerprintPage() {
  const [fingerprint, setFingerprint] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [components, setComponents] = useState({})

  useEffect(() => {
    testFingerprint()
  }, [])

  async function testFingerprint() {
    console.log('=== Starting Fingerprint Test ===')
    
    try {
      // Check if DeviceFingerprint exists
      console.log('DeviceFingerprint class type:', typeof DeviceFingerprint)
      
      if (typeof DeviceFingerprint === 'undefined') {
        throw new Error('DeviceFingerprint class not found - check /lib/device-fingerprint.js')
      }

      // Create instance
      const fingerprinter = new DeviceFingerprint()
      console.log('Fingerprinter instance created:', fingerprinter)

      // Generate fingerprint
      console.log('Generating fingerprint...')
      const result = await fingerprinter.generate()
      
      console.log('=== Fingerprint Generated Successfully ===')
      console.log('Hash:', result.hash)
      console.log('Confidence:', result.confidence)
      console.log('Components:', result.components)
      
      setFingerprint(result.hash)
      setComponents(result.components || {})
      setError(null)
      
    } catch (err) {
      console.error('=== Fingerprint Test Failed ===')
      console.error('Error:', err)
      setError(err.message || 'Failed to generate fingerprint')
      setFingerprint(null)
    } finally {
      setLoading(false)
    }
  }

  // Simple hash function for testing
  async function simpleFingerprint() {
    const data = {
      screen: `${window.screen.width}x${window.screen.height}`,
      colorDepth: window.screen.colorDepth,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      cores: navigator.hardwareConcurrency || 'unknown',
      memory: navigator.deviceMemory || 'unknown',
      plugins: navigator.plugins.length,
      timestamp: Date.now()
    }
    
    const str = JSON.stringify(data)
    const encoder = new TextEncoder()
    const dataBuffer = encoder.encode(str)
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    
    return {
      hash: hashHex,
      data: data
    }
  }

  async function testSimpleFingerprint() {
    setLoading(true)
    try {
      const result = await simpleFingerprint()
      console.log('Simple fingerprint:', result)
      setFingerprint(result.hash)
      setComponents(result.data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Device Fingerprint Test</h1>
        
        {loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-700">Generating fingerprint...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-700 font-semibold">Error:</p>
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {fingerprint && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <p className="text-green-700 font-semibold">Fingerprint Generated Successfully!</p>
            <p className="text-xs text-gray-600 mt-2 font-mono break-all">{fingerprint}</p>
          </div>
        )}

        <div className="mt-6 space-y-4">
          <button
            onClick={testFingerprint}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Test Full Fingerprint
          </button>
          
          <button
            onClick={testSimpleFingerprint}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 ml-4"
          >
            Test Simple Fingerprint
          </button>
        </div>

        {Object.keys(components).length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Fingerprint Components</h2>
            <div className="space-y-2">
              {Object.entries(components).map(([key, value]) => (
                <div key={key} className="flex border-b pb-2">
                  <span className="font-medium w-1/3">{key}:</span>
                  <span className="text-gray-600 w-2/3 break-all">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 bg-gray-100 rounded-lg p-4">
          <p className="text-sm text-gray-600">
            Open the browser console (F12) to see detailed logs.
          </p>
          <p className="text-sm text-gray-600 mt-2">
            Try opening this page in different browsers or incognito mode to see different fingerprints.
          </p>
        </div>
      </div>
    </div>
  )
}