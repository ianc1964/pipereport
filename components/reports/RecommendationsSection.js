// components/reports/RecommendationsSection.js
'use client'

import { Clock, Bot } from 'lucide-react'
import { getCategoryLabel } from '@/lib/utils/severityUtils'

// Add this function to render narrative text (copied from RecommendationsTab.js)
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

export default function RecommendationsSection({ recommendations = [] }) {
  if (!recommendations || recommendations.length === 0) {
    return null
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800'
      case 'high':
        return 'bg-orange-100 text-orange-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'low':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityOrder = (priority) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 }
    return order[priority] ?? 4
  }

  // Sort recommendations by priority
  const sortedRecommendations = [...recommendations].sort(
    (a, b) => getPriorityOrder(a.priority) - getPriorityOrder(b.priority)
  )

  return (
    <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Recommendations</h2>
      
      <div className="space-y-4">
        {sortedRecommendations.map((rec, index) => {
          // FIXED: Check if this is an AI narrative recommendation (same logic as RecommendationsTab)
          const isNarrative = rec.is_ai_narrative || rec.detailed_action?.length > 500;
          
          // Check if title already starts with "Section" to avoid duplication
          const titleAlreadyHasSection = rec.title.toLowerCase().startsWith('section');
          const sectionNumber = index + 1;
          
          if (isNarrative) {
            // FIXED: Render as narrative text (same as RecommendationsTab)
            return (
              <div key={rec.id} className="bg-white border rounded-lg shadow-sm">
                {/* Header with badges */}
                <div className="border-b border-gray-200 px-6 py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(rec.priority)}`}>
                          {rec.priority} priority
                        </span>
                        <span className="ml-2 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          {getCategoryLabel(rec.category)}
                        </span>
                        <div className="ml-2 inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs">
                          <Bot className="h-3 w-3 mr-1" />
                          AI Generated
                        </div>
                      </div>
                      
                      <h3 className="text-lg font-medium text-gray-900">
                        {titleAlreadyHasSection ? rec.title : `Section ${sectionNumber}: ${rec.title}`}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                    </div>
                  </div>
                </div>
                
                {/* FIXED: Narrative content display */}
                <div className="px-6 py-6">
                  {renderNarrativeText(rec.detailed_action)}
                </div>
                
                {/* Footer with metadata */}
                {(rec.timeline || rec.cost_range || rec.deadline) && (
                  <div className="border-t border-gray-200 px-6 py-3 bg-gray-50">
                    <div className="flex items-center text-xs text-gray-500 space-x-6">
                      {rec.cost_range && (
                        <span className="flex items-center">
                          <span className="font-medium">Estimated cost:</span>
                          <span className="ml-1">{rec.cost_range}</span>
                        </span>
                      )}
                      
                      {rec.timeline && (
                        <div className="flex items-center text-sm text-gray-600">
                          <Clock className="w-4 h-4 mr-1" />
                          {rec.timeline}
                        </div>
                      )}
                      
                      {rec.deadline && (
                        <div className="flex items-center text-gray-600">
                          <span className="font-medium">Complete by:</span>
                          <span className="ml-1">{new Date(rec.deadline).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          } else {
            // Regular recommendation display (existing logic)
            return (
              <div key={rec.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                    <span className={`
                      inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                      ${getPriorityColor(rec.priority)}
                    `}>
                      {rec.priority} priority
                    </span>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {getCategoryLabel(rec.category)}
                    </span>
                  </div>
                  {rec.timeline && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Clock className="w-4 h-4 mr-1" />
                      {rec.timeline}
                    </div>
                  )}
                </div>
                
                <h3 className="font-medium text-gray-900 mb-1">
                  {titleAlreadyHasSection ? rec.title : `Section ${sectionNumber}: ${rec.title}`}
                </h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{rec.description}</p>
                
                {/* Additional details */}
                <div className="mt-3 flex flex-wrap gap-3 text-xs">
                  {rec.cost_range && (
                    <div className="flex items-center text-gray-600">
                      <span className="font-medium">Estimated cost:</span>
                      <span className="ml-1">{rec.cost_range}</span>
                    </div>
                  )}
                  
                  {rec.deadline && (
                    <div className="flex items-center text-gray-600">
                      <span className="font-medium">Complete by:</span>
                      <span className="ml-1">{new Date(rec.deadline).toLocaleDateString()}</span>
                    </div>
                  )}
                  
                  {rec.observation_refs && rec.observation_refs.length > 0 && (
                    <div className="flex items-center text-gray-600">
                      <span className="font-medium">Related observations:</span>
                      <span className="ml-1">{rec.observation_refs.length}</span>
                    </div>
                  )}
                </div>

                {/* Action plan if provided */}
                {rec.action_plan && (
                  <div className="mt-3 p-3 bg-gray-50 rounded text-sm">
                    <h4 className="font-medium text-gray-700 mb-1">Action Plan</h4>
                    <p className="text-gray-600 whitespace-pre-wrap">{rec.action_plan}</p>
                  </div>
                )}
              </div>
            );
          }
        })}
      </div>

      {/* Summary by priority */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Summary by Priority</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['critical', 'high', 'medium', 'low'].map(priority => {
            const count = recommendations.filter(r => r.priority === priority).length
            if (count === 0) return null
            
            return (
              <div key={priority} className="text-center">
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getPriorityColor(priority)}`}>
                  {count} {priority}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}