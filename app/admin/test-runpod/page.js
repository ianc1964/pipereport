// app/admin/test-runpod/page.js
// Test page for comparing old and new RunPod endpoints
'use client'

import { useState } from 'react'
import { Shield, Upload, Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'

export default function TestRunPodPage() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [testing, setTesting] = useState(false)
  const [results, setResults] = useState({
    old: null,
    new: null
  })
  const [errors, setErrors] = useState({
    old: null,
    new: null
  })

  // Endpoint configurations
  const endpoints = {
    old: {
      name: 'Current (l2jz5k4v050nfr)',
      url: 'https://api.runpod.ai/v2/l2jz5k4v050nfr/runsync'
    },
    new: {
      name: 'New (voejm0cy20ca2m)',
      url: 'https://api.runpod.ai/v2/voejm0cy20ca2m/runsync'
    }
  }

  // Convert file to base64
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = reader.result.split(',')[1]
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      setSelectedFile(file)
      setPreviewUrl(URL.createObjectURL(file))
      setResults({ old: null, new: null })
      setErrors({ old: null, new: null })
    }
  }

  // Test a single endpoint
  const testEndpoint = async (endpointKey) => {
    const endpoint = endpoints[endpointKey]
    const apiKey = process.env.NEXT_PUBLIC_RUNPOD_API_KEY

    if (!apiKey) {
      return {
        success: false,
        error: 'RunPod API key not configured in environment variables'
      }
    }

    try {
      const imageBase64 = await fileToBase64(selectedFile)
      
      const startTime = Date.now()
      
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          input: { image: imageBase64 }
        })
      })

      const responseTime = Date.now() - startTime
      const data = await response.json()

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${JSON.stringify(data)}`)
      }

      // Parse results
      const modelOutput = data?.output?.output || {}
      const detections = modelOutput.detections || []
      const ocrTexts = modelOutput.ocr?.texts || []
      const extractedData = modelOutput.ocr?.extracted_data || {}

      return {
        success: true,
        responseTime,
        detections: detections.length,
        texts: ocrTexts.length,
        extractedDistance: extractedData.distance || 'Not found',
        topObject: detections[0] ? {
          class: detections[0].class,
          confidence: (detections[0].confidence * 100).toFixed(1) + '%'
        } : null,
        topText: ocrTexts[0] ? {
          text: ocrTexts[0].text,
          confidence: (ocrTexts[0].confidence * 100).toFixed(1) + '%'
        } : null,
        rawResponse: data
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  // Run tests on both endpoints
  const runTests = async () => {
    if (!selectedFile) {
      alert('Please select an image first')
      return
    }

    setTesting(true)
    setResults({ old: null, new: null })
    setErrors({ old: null, new: null })

    // Test both endpoints in parallel
    const [oldResult, newResult] = await Promise.all([
      testEndpoint('old'),
      testEndpoint('new')
    ])

    if (oldResult.success) {
      setResults(prev => ({ ...prev, old: oldResult }))
    } else {
      setErrors(prev => ({ ...prev, old: oldResult.error }))
    }

    if (newResult.success) {
      setResults(prev => ({ ...prev, new: newResult }))
    } else {
      setErrors(prev => ({ ...prev, new: newResult.error }))
    }

    setTesting(false)
  }

  // Result display component
  const ResultCard = ({ title, result, error, endpoint }) => (
    <div className="bg-white rounded-lg shadow-sm p-6 border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">{title}</h3>
        {result && (
          <span className="text-sm text-gray-500">
            {result.responseTime}ms
          </span>
        )}
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start space-x-2">
            <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Error</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      ) : result ? (
        <div className="space-y-4">
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xs text-blue-600 font-medium">Objects Detected</p>
              <p className="text-2xl font-bold text-blue-900">{result.detections}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3">
              <p className="text-xs text-purple-600 font-medium">Text Regions</p>
              <p className="text-2xl font-bold text-purple-900">{result.texts}</p>
            </div>
          </div>

          {/* Top detection */}
          {result.topObject && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-600 font-medium mb-1">Top Object</p>
              <p className="font-medium">{result.topObject.class}</p>
              <p className="text-sm text-gray-500">Confidence: {result.topObject.confidence}</p>
            </div>
          )}

          {/* Top text */}
          {result.topText && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-600 font-medium mb-1">Top Text</p>
              <p className="font-medium">"{result.topText.text}"</p>
              <p className="text-sm text-gray-500">Confidence: {result.topText.confidence}</p>
            </div>
          )}

          {/* Extracted distance */}
          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-xs text-green-600 font-medium mb-1">Extracted Distance</p>
            <p className="font-medium">{result.extractedDistance}</p>
          </div>

          {/* Raw response (collapsible) */}
          <details className="bg-gray-50 rounded-lg p-3">
            <summary className="cursor-pointer text-sm font-medium text-gray-700">
              View Raw Response
            </summary>
            <pre className="mt-2 text-xs overflow-auto max-h-96">
              {JSON.stringify(result.rawResponse, null, 2)}
            </pre>
          </details>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-400">
          <AlertCircle className="w-12 h-12 mx-auto mb-2" />
          <p className="text-sm">No results yet</p>
        </div>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-3">
            <Shield className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-semibold">RunPod Endpoint Tester</h1>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Compare the current and new RunPod endpoints side by side
          </p>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Upload section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8 border">
          <h2 className="text-lg font-semibold mb-4">Test Image</h2>
          
          <div className="space-y-4">
            {/* File input */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
              {previewUrl ? (
                <div className="space-y-4">
                  <img 
                    src={previewUrl} 
                    alt="Test" 
                    className="max-h-64 mx-auto rounded-lg"
                  />
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-2">{selectedFile.name}</p>
                    <label className="inline-block cursor-pointer text-sm text-blue-600 hover:text-blue-700">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      Choose different image
                    </label>
                  </div>
                </div>
              ) : (
                <label className="block cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <div className="text-center">
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      PNG, JPG up to 10MB
                    </p>
                  </div>
                </label>
              )}
            </div>

            {/* Test button */}
            <button
              onClick={runTests}
              disabled={!selectedFile || testing}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                !selectedFile || testing
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {testing ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="animate-spin w-5 h-5 mr-2" />
                  Testing both endpoints...
                </span>
              ) : (
                'Run Tests'
              )}
            </button>
          </div>
        </div>

        {/* Results section */}
        <div className="grid lg:grid-cols-2 gap-8">
          <ResultCard
            title={endpoints.old.name}
            result={results.old}
            error={errors.old}
            endpoint="old"
          />
          
          <ResultCard
            title={endpoints.new.name}
            result={results.new}
            error={errors.new}
            endpoint="new"
          />
        </div>

        {/* Comparison summary */}
        {results.old && results.new && (
          <div className="mt-8 bg-white rounded-lg shadow-sm p-6 border">
            <h3 className="font-semibold text-lg mb-4">Comparison Summary</h3>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-gray-600">Response Time</span>
                <span className={`text-sm font-medium ${
                  results.new.responseTime < results.old.responseTime ? 'text-green-600' : 'text-orange-600'
                }`}>
                  New is {Math.abs(results.new.responseTime - results.old.responseTime)}ms {
                    results.new.responseTime < results.old.responseTime ? 'faster' : 'slower'
                  }
                </span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-gray-600">Objects Detected</span>
                <span className="text-sm font-medium">
                  Old: {results.old.detections} | New: {results.new.detections}
                </span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-gray-600">Text Regions</span>
                <span className="text-sm font-medium">
                  Old: {results.old.texts} | New: {results.new.texts}
                </span>
              </div>

              {results.new.detections === results.old.detections && 
               results.new.texts === results.old.texts && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <p className="text-sm text-green-800">
                      Both endpoints produce similar results. The new endpoint appears to be working correctly!
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}