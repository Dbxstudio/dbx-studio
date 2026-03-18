import { ReactNode, useRef, useEffect, useState, useCallback } from 'react'

const CHAT_WIDTH_STORAGE_KEY = 'dbx_ai_chat_width'
const MIN_WIDTH = 300
const MAX_WIDTH = 700

interface ResizableChatPanelProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
}

/**
 * ResizableChatPanel provides a horizontally resizable AI Chat sidebar.
 * Features:
 * - Drag handle on the left edge for resizing
 * - Min/max width constraints
 * - Persists width to localStorage
 * - Shows col-resize cursor on hover over handle
 */
export function ResizableChatPanel({ isOpen, onClose, children }: ResizableChatPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(() => {
    // Initialize from localStorage or use default
    const saved = localStorage.getItem(CHAT_WIDTH_STORAGE_KEY)
    if (saved) {
      const parsedWidth = parseInt(saved, 10)
      return parsedWidth >= MIN_WIDTH && parsedWidth <= MAX_WIDTH ? parsedWidth : 360
    }
    return 360
  })

  const [isResizing, setIsResizing] = useState(false)

  // Handle mouse down on resize handle
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  // Handle mouse move during resize
  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!panelRef.current) return

      // Get the panel's right edge position
      const rect = panelRef.current.getBoundingClientRect()
      const panelRight = rect.right

      // Calculate new width: distance from mouse to right edge
      const newWidth = Math.round(panelRight - e.clientX)

      // Apply constraints
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setWidth(newWidth)
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      // Save width to localStorage when resize ends
      if (panelRef.current) {
        const finalWidth = parseInt(panelRef.current.style.width || '360', 10)
        localStorage.setItem(CHAT_WIDTH_STORAGE_KEY, finalWidth.toString())
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  if (!isOpen) return null

  return (
    <div
      ref={panelRef}
      className="query-right"
      style={{ width: `${width}px` }}
    >
      {/* Resize Handle - Left Edge */}
      <div
        className="chat-resize-handle"
        onMouseDown={handleResizeStart}
        title="Drag to resize"
      />

      {/* Chat Panel Content */}
      {children}
    </div>
  )
}
