'use client'

export default function NodeEditModal({ 
  node, 
  onUpdate, 
  onDelete, 
  onClose 
}) {
  if (!node) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <h3 className="text-lg font-medium mb-4">Edit Node: {node.node_ref}</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={node.name || ''}
                onChange={(e) => onUpdate({...node, name: e.target.value}, false)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={node.description || ''}
                onChange={(e) => onUpdate({...node, description: e.target.value}, false)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={3}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cover Level
                </label>
                <input
                  type="number"
                  value={node.cover_level || ''}
                  onChange={(e) => onUpdate({...node, cover_level: parseFloat(e.target.value) || ''}, false)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  step="0.01"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Invert Level
                </label>
                <input
                  type="number"
                  value={node.invert_level || ''}
                  onChange={(e) => onUpdate({...node, invert_level: parseFloat(e.target.value) || ''}, false)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  step="0.01"
                />
              </div>
            </div>
          </div>
          
          <div className="mt-6 flex justify-between">
            <button
              onClick={() => {
                if (confirm('Delete this node? This will also delete any connected lines.')) {
                  onDelete(node.id)
                }
              }}
              className="px-4 py-2 text-red-600 hover:text-red-800"
            >
              Delete Node
            </button>
            
            <div className="flex space-x-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => onUpdate(node, true)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}