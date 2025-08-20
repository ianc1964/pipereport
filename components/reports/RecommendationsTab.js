// components/reports/RecommendationsTab.js
// Recommendations builder and manager with AI integration

import { useState, useEffect } from 'react'
import { 
  Plus,
  GripVertical,
  Edit2,
  Trash2,
  Save,
  X,
  AlertTriangle,
  Clock,
  PoundSterling,
  Target,
  Shield,
  Eye,
  Bot
} from 'lucide-react'
import { 
  createRecommendation, 
  updateRecommendation, 
  deleteRecommendation,
  reorderRecommendations 
} from '../../lib/reports'
import GenerateRecommendationsButton from './GenerateRecommendationsButton'

// Add this function near the top after the imports and before the component
const renderNarrativeText = (text) => {
  if (!text) return null;
  
  // Convert markdown-style formatting to JSX
  const formatText = (text) => {
    // Split text into paragraphs
    const paragraphs = text.split('\n\n').filter(p => p.trim());
    
    return paragraphs.map((paragraph, index) => {
      // Process inline formatting
      let formattedParagraph = paragraph
        // Bold text (**text**)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Italic text (*text*)
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Convert newlines to spaces within paragraphs
        .replace(/\n/g, ' ');
      
      return (
        <p 
          key={index} 
          className="mb-4 text-sm text-gray-700 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: formattedParagraph }}
        />
      );
    });
  };
  
  return (
    <div className="prose prose-sm max-w-none">
      {formatText(text)}
    </div>
  );
};

export default function RecommendationsTab({ report, onUpdate, isReadOnly }) {
  const [recommendations, setRecommendations] = useState(report.recommendations || [])
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    category: 'short_term',
    priority: 'medium',
    title: '',
    description: '',
    detailed_action: '',
    estimated_cost_min: '',
    estimated_cost_max: '',
    estimated_duration: '',
    deadline_days: ''
  })
  const [saving, setSaving] = useState(false)
  const [draggedItem, setDraggedItem] = useState(null)

  // Handle AI-generated recommendations
  const handleAIRecommendations = async (aiRecommendations) => {
    console.log('🤖 Processing AI recommendations:', aiRecommendations)
    
    try {
      const createdRecommendations = []
      
      // Create each AI recommendation in the database
      for (const aiRec of aiRecommendations) {
        const newRec = await createRecommendation(report.id, aiRec)
        createdRecommendations.push(newRec)
      }
      
      // Update local state
      setRecommendations(prev => [...prev, ...createdRecommendations])
      
      // Notify parent component
      onUpdate()
      
      console.log(`✅ Created ${createdRecommendations.length} AI recommendations`)
      
    } catch (error) {
      console.error('❌ Error creating AI recommendations:', error)
      alert('Failed to save AI recommendations. Please try again.')
    }
  }

  // Auto-suggest recommendations based on critical observations (legacy function)
  const suggestRecommendations = () => {
    const suggestions = []
    const observations = report.observations_snapshot || []
    
    // Find critical observations
    const criticalObs = observations.filter(o => o.severity >= 4)
    
    if (criticalObs.length > 0) {
      // Group by code
      const byCode = {}
      criticalObs.forEach(obs => {
        if (!byCode[obs.code]) byCode[obs.code] = []
        byCode[obs.code].push(obs)
      })
      
      // Create suggestions
      Object.entries(byCode).forEach(([code, obs]) => {
        suggestions.push({
          category: 'immediate',
          priority: 'critical',
          title: `Address ${code} Issues`,
          description: `${obs.length} critical ${code} defects found requiring immediate attention.`,
          observation_ids: obs.map(o => o.id)
        })
      })
    }
    
    return suggestions
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    
    try {
      if (editingId) {
        // Update existing
        const updated = await updateRecommendation(editingId, formData)
        setRecommendations(prev => prev.map(r => r.id === editingId ? updated : r))
      } else {
        // Create new
        const newRec = await createRecommendation(report.id, formData)
        setRecommendations(prev => [...prev, newRec])
      }
      
      resetForm()
      onUpdate()
    } catch (error) {
      console.error('Error saving recommendation:', error)
      alert('Failed to save recommendation')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (rec) => {
    setFormData({
      category: rec.category,
      priority: rec.priority,
      title: rec.title,
      description: rec.description,
      detailed_action: rec.detailed_action || '',
      estimated_cost_min: rec.estimated_cost_min || '',
      estimated_cost_max: rec.estimated_cost_max || '',
      estimated_duration: rec.estimated_duration || '',
      deadline_days: rec.deadline_days || ''
    })
    setEditingId(rec.id)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this recommendation?')) return
    
    try {
      await deleteRecommendation(id)
      setRecommendations(prev => prev.filter(r => r.id !== id))
      onUpdate()
    } catch (error) {
      console.error('Error deleting recommendation:', error)
      alert('Failed to delete recommendation')
    }
  }

  const resetForm = () => {
    setFormData({
      category: 'short_term',
      priority: 'medium',
      title: '',
      description: '',
      detailed_action: '',
      estimated_cost_min: '',
      estimated_cost_max: '',
      estimated_duration: '',
      deadline_days: ''
    })
    setEditingId(null)
    setShowForm(false)
  }

  const handleDragStart = (e, index) => {
    setDraggedItem(index)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleDrop = async (e, dropIndex) => {
    e.preventDefault()
    if (draggedItem === null) return
    
    const newRecs = [...recommendations]
    const draggedRec = newRecs[draggedItem]
    
    // Remove from old position
    newRecs.splice(draggedItem, 1)
    // Insert at new position
    newRecs.splice(dropIndex, 0, draggedRec)
    
    setRecommendations(newRecs)
    setDraggedItem(null)
    
    // Update positions in database
    try {
      await reorderRecommendations(report.id, newRecs.map(r => r.id))
      onUpdate()
    } catch (error) {
      console.error('Error reordering recommendations:', error)
    }
  }

  const getCategoryIcon = (category) => {
    const icons = {
      immediate: <AlertTriangle className="h-4 w-4" />,
      short_term: <Clock className="h-4 w-4" />,
      long_term: <Target className="h-4 w-4" />,
      preventive: <Shield className="h-4 w-4" />,
      monitoring: <Eye className="h-4 w-4" />
    }
    return icons[category] || null
  }

  const getCategoryLabel = (category) => {
    const labels = {
      immediate: 'Immediate Action',
      short_term: 'Short Term',
      long_term: 'Long Term',
      preventive: 'Preventive',
      monitoring: 'Monitoring'
    }
    return labels[category] || category
  }

  const getPriorityColor = (priority) => {
    const colors = {
      critical: 'text-red-600 bg-red-50',
      high: 'text-orange-600 bg-orange-50',
      medium: 'text-yellow-600 bg-yellow-50',
      low: 'text-green-600 bg-green-50'
    }
    return colors[priority] || 'text-gray-600 bg-gray-50'
  }

  // Check if AI generation should be available
  const shouldShowAIGeneration = !isReadOnly && (report.observations_snapshot?.length > 0)
  const hasCriticalObservations = report.stats?.critical_observations > 0

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Recommendations</h3>
          <p className="text-sm text-gray-500 mt-1">
            {recommendations.length} recommendation{recommendations.length !== 1 ? 's' : ''} • 
            {recommendations.filter(r => r.priority === 'critical').length} critical
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* AI Generation Button */}
          {shouldShowAIGeneration && (
            <GenerateRecommendationsButton
              report={report}
              onRecommendationsGenerated={handleAIRecommendations}
              existingRecommendations={recommendations}
              disabled={false}
            />
          )}
          
          {/* Manual Add Button */}
          {!isReadOnly && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Recommendation
            </button>
          )}
        </div>
      </div>

      {/* AI Suggestions Banner (enhanced) */}
      {!isReadOnly && recommendations.length === 0 && hasCriticalObservations && (
        <div className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <Bot className="h-5 w-5 text-blue-500 mt-0.5" />
            </div>
            <div className="ml-3 flex-1">
              <h4 className="text-sm font-medium text-blue-800">
                AI-Powered Repair Recommendations Available
              </h4>
              <p className="text-sm text-blue-700 mt-1">
                {report.stats.critical_observations} critical observations detected. 
                Let our AI drainage engineer analyze your findings and generate professional repair recommendations.
              </p>
              <div className="mt-3">
                <GenerateRecommendationsButton
                  report={report}
                  onRecommendationsGenerated={handleAIRecommendations}
                  existingRecommendations={recommendations}
                  disabled={false}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alternative AI Banner for existing recommendations */}
      {!isReadOnly && recommendations.length > 0 && shouldShowAIGeneration && (
        <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Bot className="h-5 w-5 text-gray-500 mr-2" />
              <span className="text-sm text-gray-700">
                Need additional recommendations? Let AI analyze your inspection data.
              </span>
            </div>
            <GenerateRecommendationsButton
              report={report}
              onRecommendationsGenerated={handleAIRecommendations}
              existingRecommendations={recommendations}
              disabled={false}
            />
          </div>
        </div>
      )}

      {/* Recommendation Form */}
      {showForm && !isReadOnly && (
        <div className="mb-6 bg-gray-50 rounded-lg p-6">
          <h4 className="text-md font-medium text-gray-900 mb-4">
            {editingId ? 'Edit Recommendation' : 'New Recommendation'}
          </h4>
          
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="immediate">Immediate Action</option>
                  <option value="short_term">Short Term (1-3 months)</option>
                  <option value="long_term">Long Term (3-12 months)</option>
                  <option value="preventive">Preventive Measure</option>
                  <option value="monitoring">Ongoing Monitoring</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                maxLength={200}
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                required
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Detailed Action Plan (optional)
              </label>
              <textarea
                value={formData.detailed_action}
                onChange={(e) => setFormData(prev => ({ ...prev, detailed_action: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cost Range (optional)
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    value={formData.estimated_cost_min}
                    onChange={(e) => setFormData(prev => ({ ...prev, estimated_cost_min: e.target.value }))}
                    placeholder="Min"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span>-</span>
                  <input
                    type="number"
                    value={formData.estimated_cost_max}
                    onChange={(e) => setFormData(prev => ({ ...prev, estimated_cost_max: e.target.value }))}
                    placeholder="Max"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration (optional)
                </label>
                <input
                  type="text"
                  value={formData.estimated_duration}
                  onChange={(e) => setFormData(prev => ({ ...prev, estimated_duration: e.target.value }))}
                  placeholder="e.g., 2-3 weeks"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Complete Within (days)
                </label>
                <input
                  type="number"
                  value={formData.deadline_days}
                  onChange={(e) => setFormData(prev => ({ ...prev, deadline_days: e.target.value }))}
                  placeholder="e.g., 30"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {editingId ? 'Update' : 'Create'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      
      {/* Recommendations List */}
      <div className="space-y-6">
        {recommendations.map((rec, index) => {
          // Check if this is an AI narrative recommendation
          const isNarrative = rec.is_ai_narrative || rec.detailed_action?.length > 500;
          
          // Check if title already starts with "Section" to avoid duplication
          const titleAlreadyHasSection = rec.title.toLowerCase().startsWith('section');
          const sectionNumber = index + 1;
          
          if (isNarrative) {
            // Render as narrative text
            return (
              <div
                key={rec.id}
                className="bg-white border rounded-lg shadow-sm"
              >
                {/* Header with badges and controls */}
                <div className="border-b border-gray-200 px-6 py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(rec.category)}`}>
                          {getCategoryIcon(rec.category)}
                          <span className="ml-1">{getCategoryLabel(rec.category)}</span>
                        </div>
                        <span className={`ml-3 px-3 py-1 rounded-full text-xs font-medium ${
                          rec.priority === 'critical' ? 'bg-red-100 text-red-800' :
                          rec.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                          rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {rec.priority.charAt(0).toUpperCase() + rec.priority.slice(1)} Priority
                        </span>
                        <div className="ml-3 inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs">
                          <Bot className="h-3 w-3 mr-1" />
                          AI Generated
                        </div>
                      </div>
                      
                      <h3 className="text-lg font-medium text-gray-900">
                        {titleAlreadyHasSection ? rec.title : `Section ${sectionNumber}: ${rec.title}`}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                    </div>
                    
                    {!isReadOnly && (
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => handleEdit(rec)}
                          className="text-gray-400 hover:text-gray-600 p-1"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(rec.id)}
                          className="text-gray-400 hover:text-red-600 p-1"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Narrative content */}
                <div className="px-6 py-6">
                  {renderNarrativeText(rec.detailed_action)}
                </div>
                
                {/* Footer with metadata */}
                {(rec.estimated_cost_min || rec.estimated_cost_max || rec.estimated_duration || rec.deadline_days) && (
                  <div className="border-t border-gray-200 px-6 py-3 bg-gray-50">
                    <div className="flex items-center text-xs text-gray-500 space-x-6">
                      {(rec.estimated_cost_min || rec.estimated_cost_max) && (
                        <span className="flex items-center">
                          <PoundSterling className="h-3 w-3 mr-1" />
                          £{rec.estimated_cost_min || '0'} - £{rec.estimated_cost_max || '?'}
                        </span>
                      )}
                      {rec.estimated_duration && (
                        <span className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {rec.estimated_duration}
                        </span>
                      )}
                      {rec.deadline_days && (
                        <span className="flex items-center">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Complete within {rec.deadline_days} days
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          } else {
            // Render as traditional card (existing logic)
            return (
              <div
                key={rec.id}
                draggable={!isReadOnly}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
                className={`bg-white border rounded-lg p-4 ${!isReadOnly ? 'cursor-move hover:shadow-md transition-shadow' : ''}`}
              >
                <div className="flex items-start">
                  {!isReadOnly && (
                    <GripVertical className="h-5 w-5 text-gray-400 mr-3 mt-0.5" />
                  )}
                  
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <div className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${getPriorityColor(rec.priority)}`}>
                        {getCategoryIcon(rec.category)}
                        <span className="ml-1">{getCategoryLabel(rec.category)}</span>
                      </div>
                      <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                        rec.priority === 'critical' ? 'bg-red-100 text-red-800' :
                        rec.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                        rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {rec.priority.charAt(0).toUpperCase() + rec.priority.slice(1)} Priority
                      </span>
                      {rec.deadline_days && (
                        <span className="ml-2 text-xs text-gray-500">
                          Complete within {rec.deadline_days} days
                        </span>
                      )}
                    </div>
                    
                    <h4 className="text-md font-medium text-gray-900 mb-1">
                      {titleAlreadyHasSection ? rec.title : `Section ${sectionNumber}: ${rec.title}`}
                    </h4>
                    <p className="text-sm text-gray-700 mb-2">{rec.description}</p>
                    
                    {rec.detailed_action && (
                      <p className="text-sm text-gray-600 mb-2 italic">
                        Action: {rec.detailed_action}
                      </p>
                    )}
                    
                    <div className="flex items-center text-xs text-gray-500 space-x-4">
                      {(rec.estimated_cost_min || rec.estimated_cost_max) && (
                        <span className="flex items-center">
                          <PoundSterling className="h-3 w-3 mr-1" />
                          £{rec.estimated_cost_min || '0'} - £{rec.estimated_cost_max || '?'}
                        </span>
                      )}
                      {rec.estimated_duration && (
                        <span className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {rec.estimated_duration}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {!isReadOnly && (
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => handleEdit(rec)}
                        className="text-gray-400 hover:text-gray-600"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(rec.id)}
                        className="text-gray-400 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          }
        })}
      </div>
      
      {recommendations.length === 0 && !showForm && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No recommendations added yet</p>
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-3">
            {!isReadOnly && shouldShowAIGeneration && (
              <GenerateRecommendationsButton
                report={report}
                onRecommendationsGenerated={handleAIRecommendations}
                existingRecommendations={recommendations}
                disabled={false}
              />
            )}
            {!isReadOnly && (
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Manual Recommendation
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}