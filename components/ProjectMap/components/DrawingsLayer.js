'use client'
import dynamic from 'next/dynamic'

// Dynamically import DrawingRenderer to avoid SSR issues with the hook
const DrawingRenderer = dynamic(
  () => import('../DrawingRenderer'),
  { ssr: false }
)

export default function DrawingsLayer({
  drawings = [],
  showDrawings,
  selectedDrawing,
  selectedDrawings = [],
  multiSelectMode = false,
  mode = 'view',
  onDrawingsUpdate,
  onDrawingSelect,
  onTransformUpdate,
  visible = true,
  drawingContext = 'map' // NEW PROP: 'map' or 'canvas' to filter drawings
}) {
  if (!visible || !showDrawings) return null

  // Filter drawings by context
  const contextDrawings = drawings.filter(drawing => {
    // If drawing doesn't have context (legacy drawings), default to 'map' context
    const context = drawing.context || 'map'
    return context === drawingContext
  })

  const isDrawingSelected = (drawing) => {
    if (selectedDrawing && selectedDrawing.id === drawing.id) {
      return true
    }
    if (selectedDrawings.some(d => d.id === drawing.id)) {
      return true
    }
    return false
  }

  const handleDrawingClick = (drawing, event) => {
    console.log('Drawing clicked:', drawing.name)
    if (onDrawingSelect) {
      onDrawingSelect(drawing, event)
    }
  }

  const handleDrawingDelete = (drawingId) => {
    if (onDrawingsUpdate) {
      onDrawingsUpdate('delete', { id: drawingId })
    }
  }

  console.log(`DrawingsLayer: Showing ${contextDrawings.length} ${drawingContext} drawings out of ${drawings.length} total`)

  return (
    <>
      {contextDrawings.map(drawing => {
        if (drawing.is_visible === false) return null
        
        const isSelected = isDrawingSelected(drawing)
        
        return (
          <DrawingRenderer
            key={drawing.id}
            drawing={drawing}
            isSelected={isSelected}
            mode={mode}
            onClick={(drawing, event) => handleDrawingClick(drawing, event)}
            onDrawingSelect={onDrawingSelect}
            onDrawingClick={(drawing, event) => handleDrawingClick(drawing, event)}
            onDrawingEdit={(drawing) => console.log('Edit:', drawing.name)}
            onDrawingDelete={() => handleDrawingDelete(drawing.id)}
            onTransformUpdate={onTransformUpdate}
            drawingContext={drawingContext} // Pass the drawingContext prop through
          />
        )
      })}
    </>
  )
}