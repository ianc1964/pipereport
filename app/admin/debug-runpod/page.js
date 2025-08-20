// app/admin/debug-runpod/page.js
// Debug page for testing different payload formats with RunPod endpoint
'use client'

import { useState } from 'react'
import { Bug, Send, Loader2, AlertCircle, CheckCircle } from 'lucide-react'

export default function DebugRunPodPage() {
  const [testing, setTesting] = useState(false)
  const [results, setResults] = useState(null)
  const [selectedFormat, setSelectedFormat] = useState('standard')
  const [customPayload, setCustomPayload] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [imageBase64, setImageBase64] = useState(null)

  // The new endpoint
  const ENDPOINT_URL = 'https://api.runpod.ai/v2/voejm0cy20ca2m/runsync'
  const API_KEY = process.env.NEXT_PUBLIC_RUNPOD_API_KEY

  // Different payload formats to test
  const payloadFormats = {
    standard: {
      name: 'Standard Format (current)',
      description: 'Format used by your current endpoint',
      getPayload: (base64) => ({
        input: {
          image: base64
        }
      })
    },
    simplified: {
      name: 'Simplified Format',
      description: 'Just the image without nested input',
      getPayload: (base64) => ({
        image: base64
      })
    },
    withParams: {
      name: 'With Parameters',
      description: 'Include additional parameters',
      getPayload: (base64) => ({
        input: {
          image: base64,
          confidence_threshold: 0.5,
          return_format: 'json'
        }
      })
    },
    base64Only: {
      name: 'Base64 String Only',
      description: 'Send just the base64 string',
      getPayload: (base64) => base64
    },
    custom: {
      name: 'Custom JSON',
      description: 'Enter your own JSON payload',
      getPayload: (base64) => {
        try {
          const parsed = JSON.parse(customPayload || '{}')
          // Replace IMAGE_PLACEHOLDER with actual base64
          const stringified = JSON.stringify(parsed).replace('IMAGE_PLACEHOLDER', base64)
          return JSON.parse(stringified)
        } catch {
          return { input: { image: base64 } }
        }
      }
    }
  }

  // Handle file selection
  const handleFileSelect = async (e) => {
    const file = e.target.files[0]
    if (file) {
      setSelectedFile(file)
      
      // Convert to base64
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = reader.result.split(',')[1]
        setImageBase64(base64)
      }
      reader.readAsDataURL(file)
      
      setResults(null)
    }
  }

  // Test the endpoint with selected format
  const testEndpoint = async () => {
    if (!imageBase64) {
      alert('Please select an image first')
      return
    }

    if (!API_KEY) {
      alert('RunPod API key not configured')
      return
    }

    setTesting(true)
    setResults(null)

    const format = payloadFormats[selectedFormat]
    const payload = format.getPayload(imageBase64.substring(0, 1000)) // Use truncated image for testing

    try {
      console.log('Testing with payload format:', selectedFormat)
      console.log('Payload structure:', JSON.stringify(payload, null, 2).substring(0, 500))

      const startTime = Date.now()
      
      const response = await fetch(ENDPOINT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify(payload)
      })

      const responseTime = Date.now() - startTime
      const responseText = await response.text()
      
      let data
      try {
        data = JSON.parse(responseText)
      } catch {
        data = { raw: responseText }
      }

      setResults({
        status: response.status,
        statusText: response.statusText,
        success: response.ok,
        responseTime,
        headers: Object.fromEntries(response.headers.entries()),
        data,
        payloadFormat: selectedFormat,
        payloadSample: JSON.stringify(payload, null, 2).substring(0, 500)
      })

    } catch (error) {
      setResults({
        success: false,
        error: error.message,
        payloadFormat: selectedFormat,
        payloadSample: JSON.stringify(payload, null, 2).substring(0, 500)
      })
    } finally {
      setTesting(false)
    }
  }

  // Test with minimal payload
  const testMinimal = async () => {
    setTesting(true)
    setResults(null)

    try {
      // Test with absolutely minimal payload
      const response = await fetch(ENDPOINT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
          input: {
            test: 'hello'
          }
        })
      })

      const responseText = await response.text()
      let data
      try {
        data = JSON.parse(responseText)
      } catch {
        data = { raw: responseText }
      }

      setResults({
        status: response.status,
        statusText: response.statusText,
        success: response.ok,
        data,
        payloadFormat: 'minimal test',
        payloadSample: '{ "input": { "test": "hello" } }'
      })

    } catch (error) {
      setResults({
        success: false,
        error: error.message,
        payloadFormat: 'minimal test'
      })
    } finally {
      setTesting(false)
    }
  }

  // Check endpoint health
  const checkHealth = async () => {
    setTesting(true)
    setResults(null)

    try {
      // Try GET request to check if endpoint responds
      const response = await fetch(ENDPOINT_URL.replace('/runsync', '/health'), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${API_KEY}`
        }
      })

      const responseText = await response.text()
      
      setResults({
        status: response.status,
        statusText: response.statusText,
        success: response.ok,
        data: { raw: responseText },
        payloadFormat: 'health check',
        payloadSample: 'GET request to /health'
      })

    } catch (error) {
      setResults({
        success: false,
        error: error.message,
        payloadFormat: 'health check'
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-3">
            <Bug className="w-6 h-6 text-red-600" />
            <h1 className="text-xl font-semibold">RunPod Endpoint Debugger</h1>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Debug endpoint: voejm0cy20ca2m
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Tests */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border">
          <h2 className="text-lg font-semibold mb-4">Quick Tests</h2>
          <div className="flex gap-4">
            <button
              onClick={checkHealth}
              disabled={testing}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              Check Health
            </button>
            <button
              onClick={testMinimal}
              disabled={testing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Test Minimal Payload
            </button>
          </div>
        </div>

        {/* Image Upload */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border">
          <h2 className="text-lg font-semibold mb-4">Test Image</h2>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {selectedFile && (
            <p className="mt-2 text-sm text-gray-600">
              Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>

        {/* Payload Format Selection */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border">
          <h2 className="text-lg font-semibold mb-4">Payload Format</h2>
          
          <div className="space-y-3">
            {Object.entries(payloadFormats).map(([key, format]) => (
              <label key={key} className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  value={key}
                  checked={selectedFormat === key}
                  onChange={(e) => setSelectedFormat(e.target.value)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="font-medium text-sm">{format.name}</div>
                  <div className="text-xs text-gray-500">{format.description}</div>
                </div>
              </label>
            ))}
          </div>

          {selectedFormat === 'custom' && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Custom JSON Payload (use IMAGE_PLACEHOLDER for image)
              </label>
              <textarea
                value={customPayload}
                onChange={(e) => setCustomPayload(e.target.value)}
                placeholder='{"input": {"image": "IMAGE_PLACEHOLDER"}}'
                className="w-full p-2 border rounded-lg font-mono text-xs"
                rows={4}
              />
            </div>
          )}

          <button
            onClick={testEndpoint}
            disabled={testing || !imageBase64}
            className={`mt-4 w-full py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center ${
              testing || !imageBase64
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {testing ? (
              <>
                <Loader2 className="animate-spin w-5 h-5 mr-2" />
                Testing...
              </>
            ) : (
              <>
                <Send className="w-5 h-5 mr-2" />
                Test Endpoint with Image
              </>
            )}
          </button>
        </div>

        {/* Results */}
        {results && (
          <div className="bg-white rounded-lg shadow-sm p-6 border">
            <h2 className="text-lg font-semibold mb-4">Results</h2>
            
            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center space-x-2">
                {results.success ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                )}
                <span className={`font-medium ${results.success ? 'text-green-700' : 'text-red-700'}`}>
                  {results.status ? `HTTP ${results.status} ${results.statusText}` : 'Request Failed'}
                </span>
                {results.responseTime && (
                  <span className="text-sm text-gray-500">({results.responseTime}ms)</span>
                )}
              </div>

              {/* Error */}
              {results.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800">{results.error}</p>
                </div>
              )}

              {/* Payload Used */}
              <details className="bg-gray-50 rounded-lg p-3">
                <summary className="cursor-pointer text-sm font-medium text-gray-700">
                  Payload Sent ({results.payloadFormat})
                </summary>
                <pre className="mt-2 text-xs overflow-auto">
                  {results.payloadSample}
                </pre>
              </details>

              {/* Response Headers */}
              {results.headers && (
                <details className="bg-gray-50 rounded-lg p-3">
                  <summary className="cursor-pointer text-sm font-medium text-gray-700">
                    Response Headers
                  </summary>
                  <pre className="mt-2 text-xs overflow-auto">
                    {JSON.stringify(results.headers, null, 2)}
                  </pre>
                </details>
              )}

              {/* Response Data */}
              {results.data && (
                <details className="bg-gray-50 rounded-lg p-3" open>
                  <summary className="cursor-pointer text-sm font-medium text-gray-700">
                    Response Data
                  </summary>
                  <pre className="mt-2 text-xs overflow-auto max-h-96">
                    {typeof results.data === 'string' 
                      ? results.data 
                      : JSON.stringify(results.data, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
        )}

        {/* Troubleshooting Tips */}
        <div className="mt-8 bg-blue-50 rounded-lg p-6 border border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-2">Troubleshooting "worker exited with exit code 1"</h3>
          <ul className="space-y-1 text-sm text-blue-800">
            <li>• Check RunPod dashboard for detailed logs</li>
            <li>• Verify the endpoint is in "Ready" state</li>
            <li>• Ensure the Docker image has all required dependencies</li>
            <li>• Check if the handler function matches the expected signature</li>
            <li>• Verify GPU memory requirements are met</li>
            <li>• Test with different payload formats above</li>
          </ul>
        </div>
      </div>
    </div>
  )
}