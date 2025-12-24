import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import DOMPurify from 'dompurify'
import { HexColorPicker } from 'react-colorful'
import './App.css'

type SvgNode = {
  id: string
  tag: string
  attrs: Record<string, string>
  children: SvgNode[]
  text?: string
}

const parseSvgString = (raw: string): { tree: SvgNode | null; clean: string } => {
  const clean = DOMPurify.sanitize(raw, { USE_PROFILES: { svg: true } })
  const parser = new DOMParser()
  const doc = parser.parseFromString(clean, 'image/svg+xml')
  const root = doc.querySelector('svg')
  if (!root) return { tree: null, clean }

  let counter = 0
  const walk = (el: Element): SvgNode => {
    const id = (el.getAttribute('data-id') || el.getAttribute('id')) ?? `node-${++counter}`
    const attrs: Record<string, string> = {}
    for (const { name, value } of Array.from(el.attributes)) {
      attrs[name] = value
    }
    attrs['data-id'] = id

    const children: SvgNode[] = []
    el.childNodes.forEach((child) => {
      if (child.nodeType === 1) {
        children.push(walk(child as Element))
      } else if (child.nodeType === 3) {
        const textContent = child.textContent?.trim()
        if (textContent) {
          children.push({
            id: `text-${++counter}`,
            tag: '#text',
            attrs: {},
            children: [],
            text: textContent,
          })
        }
      }
    })

    return { id, tag: el.tagName, attrs, children }
  }

  return { tree: walk(root), clean }
}

const serializeNode = (node: SvgNode): string => {
  if (node.tag === '#text') {
    return node.text ?? ''
  }

  const { tag, attrs, children } = node
  const attrString = Object.entries(attrs)
    .filter(([key]) => key !== 'data-id')
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ')
  const open = attrString.length ? `<${tag} ${attrString}>` : `<${tag}>`
  const inner = (node.text ?? '') + children.map(serializeNode).join('')
  return `${open}${inner}</${tag}>`
}

const cloneNode = (node: SvgNode): SvgNode => ({
  ...node,
  attrs: { ...node.attrs },
  children: node.children.map(cloneNode),
})

const styleStringToObject = (style: string | undefined): React.CSSProperties | undefined => {
  if (!style) return undefined
  return style
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)
    .reduce((acc, entry) => {
      const [k, v] = entry.split(':').map((s) => s.trim())
      if (k && v) {
        // @ts-expect-error dynamic style key
        acc[k as keyof React.CSSProperties] = v
      }
      return acc
    }, {} as React.CSSProperties)
}

const getStyleValue = (style: string | undefined, key: string): string | undefined => {
  if (!style) return undefined
  const parts = style
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => p.split(':').map((s) => s.trim()))
  const found = parts.find(([k]) => k === key)
  return found ? found[1] : undefined
}

const applyStyleValue = (style: string | undefined, key: string, value: string | undefined) => {
  const entries = style
    ? style
        .split(';')
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => p.split(':').map((s) => s.trim()))
        .filter(([k]) => k !== key && k.length > 0)
    : []
  if (value && value.length > 0) {
    entries.push([key, value])
  }
  if (!entries.length) return ''
  return entries.map(([k, v]) => `${k}: ${v}`).join('; ')
}

const updateNode = (node: SvgNode, id: string, mutate: (target: SvgNode) => void): SvgNode => {
  if (node.id === id) {
    const next = cloneNode(node)
    mutate(next)
    return next
  }

  const next = cloneNode(node)
  next.children = next.children.map((child) => updateNode(child, id, mutate))
  return next
}

const updateMultipleNodes = (node: SvgNode, ids: Set<string>, mutate: (target: SvgNode) => void): SvgNode => {
  const next = cloneNode(node)
  if (ids.has(node.id)) {
    mutate(next)
  }
  next.children = next.children.map((child) => updateMultipleNodes(child, ids, mutate))
  return next
}

const findNode = (node: SvgNode | null, id: string | null): SvgNode | null => {
  if (!node || !id) return null
  if (node.id === id) return node
  for (const child of node.children) {
    const found = findNode(child, id)
    if (found) return found
  }
  return null
}

const getFirstText = (node: SvgNode | null): string | undefined => {
  if (!node) return undefined
  if (node.tag === '#text') return node.text
  for (const child of node.children) {
    const found = getFirstText(child)
    if (found !== undefined) return found
  }
  return undefined
}

const getAttrOrStyle = (node: SvgNode | null, key: string): string | undefined => {
  if (!node) return undefined
  return node.attrs[key] ?? getStyleValue(node.attrs.style, key)
}

const findParent = (node: SvgNode, targetId: string, parent: SvgNode | null = null): SvgNode | null => {
  if (node.id === targetId) return parent
  for (const child of node.children) {
    const found = findParent(child, targetId, node)
    if (found !== null) return found
  }
  return null
}

const removeNode = (node: SvgNode, id: string): SvgNode | null => {
  if (node.id === id) return null
  const next = cloneNode(node)
  next.children = next.children.filter((child) => child.id !== id).map((child) => removeNode(child, id)!)
  return next
}

const removeMultipleNodes = (node: SvgNode, ids: Set<string>): SvgNode | null => {
  if (ids.has(node.id)) return null
  const next = cloneNode(node)
  next.children = next.children
    .filter((child) => !ids.has(child.id))
    .map((child) => removeMultipleNodes(child, ids)!)
  return next
}

const assignNewIds = (node: SvgNode, baseId: string): SvgNode => {
  let counter = 0
  const newId = `${baseId}-copy${counter > 0 ? `-${counter}` : ''}`
  counter++
  const assignIds = (n: SvgNode): SvgNode => {
    const childId = n.id === baseId ? newId : `${n.id}-copy`
    return {
      ...n,
      id: childId,
      attrs: { ...n.attrs, 'data-id': childId },
      children: n.children.map(assignIds),
    }
  }
  return assignIds(node)
}

const parseTransform = (transform: string): { translate?: { x: number; y: number }; rotate?: number } => {
  const result: { translate?: { x: number; y: number }; rotate?: number } = {}
  const translateMatch = transform.match(/translate\(([^)]+)\)/)
  if (translateMatch) {
    const [x, y] = translateMatch[1].split(/[,\s]+/).map(Number)
    result.translate = { x: x || 0, y: y || 0 }
  }
  const rotateMatch = transform.match(/rotate\(([^)]+)\)/)
  if (rotateMatch) {
    result.rotate = Number(rotateMatch[1]) || 0
  }
  return result
}

const buildTransform = (translate?: { x: number; y: number }, rotate?: number): string => {
  const parts: string[] = []
  if (translate) parts.push(`translate(${translate.x} ${translate.y})`)
  if (rotate !== undefined) parts.push(`rotate(${rotate})`)
  return parts.join(' ')
}

const getAllNodes = (node: SvgNode): SvgNode[] => {
  const result = [node]
  for (const child of node.children) {
    if (child.tag !== '#text') {
      result.push(...getAllNodes(child))
    }
  }
  return result
}

function App() {
  const [rawSvg, setRawSvg] = useState('')
  const [svgTree, setSvgTree] = useState<SvgNode | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [fillColor, setFillColor] = useState('#0ea5e9')
  const [textValue, setTextValue] = useState('')
  const [attrKey, setAttrKey] = useState('stroke-width')
  const [attrValue, setAttrValue] = useState('')
  const [strokeColor, setStrokeColor] = useState('#0f172a')
  const [strokeWidth, setStrokeWidth] = useState('1')
  const [strokeDash, setStrokeDash] = useState('')
  const [strokeOpacity, setStrokeOpacity] = useState('1')
  const [strokeLinecap, setStrokeLinecap] = useState('round')
  const [strokeLinejoin, setStrokeLinejoin] = useState('round')
  const [opacity, setOpacity] = useState('1')
  const [rotation, setRotation] = useState(0)
  const [dragState, setDragState] = useState<{
    id: string
    startX: number
    startY: number
    baseTransform: string
  } | null>(null)
  const hasDraggedRef = useRef(false)
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [showGrid, setShowGrid] = useState(false)
  const [canvasBg, setCanvasBg] = useState('#ffffff')
  const [history, setHistory] = useState<SvgNode[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showTreeView, setShowTreeView] = useState(false)
  const historySaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestTreeRef = useRef<SvgNode | null>(null)
  const prevSelectedIdsRef = useRef<string>('')

  const selectedNodes = useMemo(() => {
    if (!svgTree || selectedIds.size === 0) return []
    return Array.from(selectedIds)
      .map((id) => findNode(svgTree, id))
      .filter((node): node is SvgNode => node !== null)
  }, [svgTree, selectedIds])

  // History management
  const saveToHistory = useCallback((tree: SvgNode | null) => {
    if (!tree) return
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(cloneNode(tree))
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }, [history, historyIndex])

  const updateTreeWithHistory = useCallback((newTree: SvgNode | null) => {
    if (!newTree) return
    saveToHistory(newTree)
    setSvgTree(newTree)
    latestTreeRef.current = newTree
  }, [saveToHistory])

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      const tree = cloneNode(history[newIndex])
      setSvgTree(tree)
      latestTreeRef.current = tree
    }
  }, [history, historyIndex])

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      const tree = cloneNode(history[newIndex])
      setSvgTree(tree)
      latestTreeRef.current = tree
    }
  }, [history, historyIndex])

  useEffect(() => {
    // Only sync when selection changes, not when tree updates
    const selectedIdsStr = Array.from(selectedIds).sort().join(',')
    
    // Skip if selection hasn't changed
    if (prevSelectedIdsRef.current === selectedIdsStr) {
      return
    }
    
    prevSelectedIdsRef.current = selectedIdsStr

    if (selectedIds.size === 0) {
      // Reset to defaults when nothing is selected
      setFillColor('#0ea5e9')
      setStrokeColor('#0f172a')
      setStrokeWidth('1')
      setStrokeDash('')
      setStrokeOpacity('1')
      setStrokeLinecap('round')
      setStrokeLinejoin('round')
      setOpacity('1')
      setRotation(0)
      setTextValue('')
      return
    }

    // Get values from first selected node (for multi-select, show first node's values)
    if (!svgTree) return
    const firstId = Array.from(selectedIds)[0]
    const firstNode = findNode(svgTree, firstId)
    if (firstNode) {
      const fill = getAttrOrStyle(firstNode, 'fill')
      setFillColor(fill || '#0ea5e9')

      const stroke = getAttrOrStyle(firstNode, 'stroke')
      setStrokeColor(stroke || '#0f172a')

      const width = getAttrOrStyle(firstNode, 'stroke-width')
      setStrokeWidth(width || '1')

      const dash = getAttrOrStyle(firstNode, 'stroke-dasharray')
      setStrokeDash(dash || '')

      const strokeOpacityValue = getAttrOrStyle(firstNode, 'stroke-opacity')
      setStrokeOpacity(strokeOpacityValue || '1')

      const linecap = getAttrOrStyle(firstNode, 'stroke-linecap')
      setStrokeLinecap(linecap || 'round')

      const linejoin = getAttrOrStyle(firstNode, 'stroke-linejoin')
      setStrokeLinejoin(linejoin || 'round')

      const opacityValue = getAttrOrStyle(firstNode, 'opacity')
      setOpacity(opacityValue || '1')

      const transform = firstNode.attrs.transform || ''
      const parsed = parseTransform(transform)
      if (parsed.rotate !== undefined) {
        setRotation(parsed.rotate)
      } else {
        setRotation(0)
      }

      const text = getFirstText(firstNode)
      if (text !== undefined) {
        setTextValue(text)
      } else {
        setTextValue('')
      }
    }
  }, [selectedIds, svgTree])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (historySaveTimeoutRef.current) {
        clearTimeout(historySaveTimeoutRef.current)
      }
    }
  }, [])

  const handleSvgInput = useCallback((value: string) => {
    setRawSvg(value)
    const { tree, clean } = parseSvgString(value)
    if (!tree) {
      setError('No <svg> tag found. Paste a valid SVG.')
      setSvgTree(null)
      latestTreeRef.current = null
      setSelectedIds(new Set())
      setHistory([])
      setHistoryIndex(-1)
      return
    }
    setError(null)
    const initialHistory = [cloneNode(tree)]
    setHistory(initialHistory)
    setHistoryIndex(0)
    setSvgTree(tree)
    latestTreeRef.current = tree
    setRawSvg(clean)
    setSelectedIds(new Set([tree.id]))
  }, [])

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result?.toString() || ''
      handleSvgInput(text)
    }
    reader.readAsText(file)
  }, [handleSvgInput])

  const handleNodeClick = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    
    // Don't allow selecting the root SVG element
    if (!svgTree || nodeId === svgTree.id) return
    
    // Check if this was a drag by comparing mouse positions
    let wasDragging = hasDraggedRef.current
    if (mouseDownPosRef.current) {
      const dx = e.clientX - mouseDownPosRef.current.x
      const dy = e.clientY - mouseDownPosRef.current.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance > 5) {
        wasDragging = true
      }
      mouseDownPosRef.current = null
    }
    hasDraggedRef.current = false // Reset flag
    
    if (wasDragging) {
      return // Don't toggle if user was dragging
    }
    
    // Ensure we're selecting the actual clicked element, not a parent
    const target = e.currentTarget as HTMLElement
    const clickedId = target.getAttribute('data-id')
    if (clickedId && clickedId !== nodeId) {
      // If the clicked element's ID doesn't match, use the clicked ID
      nodeId = clickedId
    }
    
    if (e.ctrlKey || e.metaKey) {
      // Multi-select: toggle selection (Ctrl/Cmd+Click)
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(nodeId)) {
          next.delete(nodeId)
        } else {
          next.add(nodeId)
        }
        return next
      })
    } else if (e.shiftKey) {
      // Multi-select: add to selection (Shift+Click)
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.add(nodeId)
        return next
      })
    } else {
      // Toggle selection on normal click (so users can toggle after selecting all)
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(nodeId)) {
          next.delete(nodeId)
        } else {
          next.add(nodeId)
        }
        return next
      })
    }
  }, [svgTree])

  const renderNode = (node: SvgNode): React.ReactNode => {
    if (node.tag === '#text') {
      return node.text
    }

    const { tag, attrs, children } = node
    const isSelected = selectedIds.has(node.id)
    const baseStyle =
      typeof attrs.style === 'string' ? styleStringToObject(attrs.style) : attrs.style
    const mergedStyle: React.CSSProperties = {
      ...(baseStyle ?? {}),
      cursor: 'pointer',
      ...(node.tag === 'svg'
        ? {
            maxWidth: '100%',
            height: 'auto',
            display: 'block',
          }
        : {}),
    }
    // prevent passing style string to React style prop
    const { style: _ignoredStyle, ...restAttrs } = attrs
    const mergedAttrs = {
      ...restAttrs,
      key: node.id,
      'data-id': node.id,
      'data-selected': isSelected ? 'true' : undefined,
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation()
        handleNodeClick(node.id, e)
      },
      onMouseDown: (e: React.MouseEvent) => {
        if (node.tag === 'svg') return
        e.stopPropagation()
        // Track mouse down position to detect if it was a drag in onClick
        hasDraggedRef.current = false
        mouseDownPosRef.current = { x: e.clientX, y: e.clientY }
        // Only initialize drag state if element is already selected
        if (isSelected) {
        setDragState({
          id: node.id,
          startX: e.clientX,
          startY: e.clientY,
          baseTransform: node.attrs.transform ?? '',
        })
        }
      },
      style: {
        ...mergedStyle,
      },
    }

    return React.createElement(tag, mergedAttrs, children.map(renderNode))
  }

  // Component to render selection handles and bounding boxes
  const SelectionOverlay = () => {
    const [bboxes, setBboxes] = useState<Map<string, DOMRect>>(new Map())

    useEffect(() => {
      if (selectedIds.size === 0) {
        setBboxes(new Map())
        return
      }

      const updateBboxes = () => {
        const newBboxes = new Map<string, DOMRect>()
        const canvasContainer = document.querySelector('[class*="overflow-auto"]') as HTMLElement
        if (!canvasContainer) return

        selectedIds.forEach((id) => {
          const element = document.querySelector(`[data-id="${id}"]`) as any
          if (element && element.tagName !== 'svg') {
            try {
              // Get the element's bounding rect (already includes zoom transform)
              const elementRect = element.getBoundingClientRect()
              // Get the canvas container's bounding rect
              const containerRect = canvasContainer.getBoundingClientRect()

              // Calculate position relative to container, accounting for scroll
              const scrollLeft = canvasContainer.scrollLeft
              const scrollTop = canvasContainer.scrollTop

              // Position relative to container viewport (accounting for scroll)
              const x = elementRect.left - containerRect.left + scrollLeft
              const y = elementRect.top - containerRect.top + scrollTop
              const width = elementRect.width
              const height = elementRect.height

              newBboxes.set(id, new DOMRect(x, y, width, height))
            } catch (e) {
              // Ignore errors
            }
          }
        })
        setBboxes(newBboxes)
      }

      // Small delay to ensure DOM is updated
      const timeout = setTimeout(updateBboxes, 0)
      return () => clearTimeout(timeout)
    }, [selectedIds, svgTree, zoom])

    if (selectedIds.size === 0 || !svgTree) return null

    return (
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          overflow: 'visible',
        }}
      >
        {Array.from(selectedIds).map((id) => {
          const bbox = bboxes.get(id)
          if (!bbox) return null

          const handleSize = 8
          const handles = [
            { x: bbox.left, y: bbox.top },
            { x: bbox.left + bbox.width / 2, y: bbox.top },
            { x: bbox.left + bbox.width, y: bbox.top },
            { x: bbox.left + bbox.width, y: bbox.top + bbox.height / 2 },
            { x: bbox.left + bbox.width, y: bbox.top + bbox.height },
            { x: bbox.left + bbox.width / 2, y: bbox.top + bbox.height },
            { x: bbox.left, y: bbox.top + bbox.height },
            { x: bbox.left, y: bbox.top + bbox.height / 2 },
          ]

          return (
            <React.Fragment key={id}>
              {/* Bounding box */}
              <div
                style={{
                  position: 'absolute',
                  left: `${bbox.left}px`,
                  top: `${bbox.top}px`,
                  width: `${bbox.width}px`,
                  height: `${bbox.height}px`,
                  border: '1px dashed #3b82f6',
                  boxSizing: 'border-box',
                  pointerEvents: 'none',
                }}
              />
              {/* Control handles */}
              {handles.map((handle, idx) => (
                <div
                  key={idx}
                  style={{
                    position: 'absolute',
                    left: `${handle.x - handleSize / 2}px`,
                    top: `${handle.y - handleSize / 2}px`,
                    width: `${handleSize}px`,
                    height: `${handleSize}px`,
                    backgroundColor: '#3b82f6',
                    border: '1px solid white',
                    boxSizing: 'border-box',
                    pointerEvents: 'none',
                  }}
                />
              ))}
              {/* Vertex points for polygons */}
              {(() => {
                const node = findNode(svgTree, id)
                if (!node || (node.tag !== 'polygon' && node.tag !== 'polyline')) return null

                if (node.attrs.points) {
                  const svgEl = document.querySelector('svg[data-id="' + svgTree.id + '"]') as SVGSVGElement
                  if (!svgEl) return null

                  try {
                    const points = node.attrs.points
                      .trim()
                      .split(/[\s,]+/)
                      .map(Number)
                      .filter((n) => !isNaN(n))

                    const element = document.querySelector(`[data-id="${id}"]`) as any
                    if (!element) return null

                    return (
                      <>
                        {Array.from({ length: points.length / 2 }, (_, i) => {
                          const x = points[i * 2]
                          const y = points[i * 2 + 1]
                          const pt = svgEl.createSVGPoint()
                          pt.x = x
                          pt.y = y
                          const screenCTM = element.getScreenCTM ? element.getScreenCTM() : null
                          if (!screenCTM) return null
                          const svgRect = svgEl.getBoundingClientRect()
                          const screenPt = pt.matrixTransform(screenCTM)

                          return (
                            <div
                              key={`vertex-${i}`}
                              style={{
                                position: 'absolute',
                                left: screenPt.x - svgRect.left - 4,
                                top: screenPt.y - svgRect.top - 4,
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor: '#ef4444',
                                border: '1px solid white',
                                boxSizing: 'border-box',
                              }}
                            />
                          )
                        })}
                      </>
                    )
                  } catch (e) {
                    return null
                  }
                }
                return null
              })()}
            </React.Fragment>
          )
        })}
      </div>
    )
  }

  // Update attribute without immediately saving to history (for rapid changes like color picker)
  const updateAttributeWithoutHistory = useCallback((key: string, value: string) => {
    if (selectedIds.size === 0) return
    
    // Use functional update to always get the latest tree state
    setSvgTree((currentTree) => {
      if (!currentTree) return currentTree
      const next = updateMultipleNodes(currentTree, selectedIds, (node) => {
      if (key === 'fill' || key === 'stroke') {
        const styleValue = applyStyleValue(node.attrs.style, key, value || undefined)
        if (styleValue) node.attrs.style = styleValue
        else delete node.attrs.style
      }
      if (value) node.attrs[key] = value
      else delete node.attrs[key]
    })
      
      // Store latest tree in ref for history save
      latestTreeRef.current = next
      
      // Debounce history save - clear existing timeout and set a new one
      if (historySaveTimeoutRef.current) {
        clearTimeout(historySaveTimeoutRef.current)
      }
      historySaveTimeoutRef.current = setTimeout(() => {
        const treeToSave = latestTreeRef.current
        if (treeToSave) {
          saveToHistory(treeToSave)
        }
      }, 500) // Save to history 500ms after user stops changing
      
      return next
    })
  }, [selectedIds, saveToHistory])

  const updateAttribute = useCallback((key: string, value: string) => {
    if (selectedIds.size === 0 || !svgTree) return
    const next = updateMultipleNodes(svgTree, selectedIds, (node) => {
      if (key === 'fill' || key === 'stroke') {
        const styleValue = applyStyleValue(node.attrs.style, key, value || undefined)
        if (styleValue) node.attrs.style = styleValue
        else delete node.attrs.style
      }
      if (value) node.attrs[key] = value
      else delete node.attrs[key]
    })
    updateTreeWithHistory(next)
  }, [selectedIds, svgTree, updateTreeWithHistory])

  const updateText = useCallback((value: string) => {
    if (selectedIds.size === 0 || !svgTree) return
    const next = updateMultipleNodes(svgTree, selectedIds, (node) => {
      if (node.tag === '#text') {
        node.text = value
      } else {
        node.children = node.children.map((child) =>
          child.tag === '#text' ? { ...child, text: value } : child,
        )
      }
    })
    updateTreeWithHistory(next)
  }, [selectedIds, svgTree, updateTreeWithHistory])

  const handlePointerMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragState) return
      // Check if mouse has moved significantly (more than 5px) to consider it a drag
        const dx = e.clientX - dragState.startX
        const dy = e.clientY - dragState.startY
      const distance = Math.sqrt(dx * dx + dy * dy)
      
      if (distance > 5) {
        hasDraggedRef.current = true
      }
      
      // Only update transform if we've actually dragged
      if (hasDraggedRef.current) {
        // Use functional update to get latest tree state
        setSvgTree((currentTree) => {
          if (!currentTree) return currentTree
          const scaledDx = dx / zoom
          const scaledDy = dy / zoom
          const transform = `${dragState.baseTransform ? `${dragState.baseTransform} ` : ''}translate(${scaledDx} ${scaledDy})`
          const next = updateNode(currentTree, dragState.id, (node) => {
          node.attrs.transform = transform
        })
          latestTreeRef.current = next
          return next
      })
      }
    },
    [dragState, zoom],
  )

  const handlePointerUp = useCallback(() => {
    if (dragState) {
      if (hasDraggedRef.current && latestTreeRef.current) {
        // Only update history if actual dragging occurred
        updateTreeWithHistory(latestTreeRef.current)
      } else {
        // If we didn't actually drag, reset the tree to prevent visual glitches
        // The drag state was initialized but no movement occurred
        setSvgTree((currentTree) => {
          if (!currentTree || !dragState) return currentTree
          // Reset transform to original
          const next = updateNode(currentTree, dragState.id, (node) => {
            node.attrs.transform = dragState.baseTransform
          })
          latestTreeRef.current = next
          return next
        })
      }
      setDragState(null)
      // Note: Don't reset hasDraggedRef here - let onClick check it first
    }
  }, [dragState, updateTreeWithHistory])

  const exportSvg = () => {
    if (!svgTree) return ''
    return serializeNode(svgTree)
  }

  const downloadSvg = () => {
    const svgString = exportSvg()
    if (!svgString) return
    const blob = new Blob([svgString], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'edited.svg'
    link.click()
    URL.revokeObjectURL(url)
  }

  const copyToClipboard = async () => {
    const svgString = exportSvg()
    if (!svgString) return
    await navigator.clipboard.writeText(svgString)
  }

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 3))
  }

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 0.25))
  }

  const handleZoomReset = () => {
    setZoom(1)
  }

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const delta = e.deltaY > 0 ? -0.1 : 0.1
        setZoom((prev) => Math.min(Math.max(prev + delta, 0.25), 3))
      }
    },
    [],
  )

  // Helper to get all selectable node IDs
  const getAllSelectableIds = useCallback((tree: SvgNode): string[] => {
    const getAllNodeIds = (node: SvgNode): string[] => {
      const ids: string[] = []
      // Don't include root SVG or text nodes
      if (node.id !== tree.id && node.tag !== '#text') {
        ids.push(node.id)
      }
      for (const child of node.children) {
        ids.push(...getAllNodeIds(child))
      }
      return ids
    }
    return getAllNodeIds(tree)
  }, [])

  // Check if all elements are selected
  const areAllSelected = useMemo(() => {
    if (!svgTree || selectedIds.size === 0) return false
    const allIds = getAllSelectableIds(svgTree)
    return allIds.length > 0 && allIds.every(id => selectedIds.has(id))
  }, [svgTree, selectedIds, getAllSelectableIds])

  const selectAll = useCallback(() => {
    if (!svgTree) return
    const allIds = getAllSelectableIds(svgTree)
    const allIdsSet = new Set(allIds)
    
    // Toggle: if all are selected, deselect all; otherwise, select all
    setSelectedIds(areAllSelected ? new Set<string>() : allIdsSet)
  }, [svgTree, areAllSelected, getAllSelectableIds])

  const deleteSelected = useCallback(() => {
    if (selectedIds.size === 0 || !svgTree) return
    // Can't delete root SVG
    const idsToDelete = new Set(Array.from(selectedIds).filter((id) => id !== svgTree.id))
    if (idsToDelete.size === 0) return
    const next = removeMultipleNodes(svgTree, idsToDelete)
    if (next) {
      updateTreeWithHistory(next)
      setSelectedIds(new Set([svgTree.id])) // Select root after deletion
    }
  }, [selectedIds, svgTree, updateTreeWithHistory])

  const duplicateSelected = useCallback(() => {
    if (selectedIds.size === 0 || !svgTree) return
    // For multi-select, duplicate the first selected item (can be enhanced later)
    const firstId = Array.from(selectedIds)[0]
    if (firstId === svgTree.id) {
      // Can't duplicate root SVG
      return
    }
    const parent = findParent(svgTree, firstId)
    if (!parent) return
    const nodeToDuplicate = findNode(svgTree, firstId)
    if (!nodeToDuplicate) return
    const duplicated = assignNewIds(cloneNode(nodeToDuplicate), firstId)
    const next = updateNode(svgTree, parent.id, (p) => {
      p.children.push(duplicated)
    })
    updateTreeWithHistory(next)
    setSelectedIds(new Set([duplicated.id]))
  }, [selectedIds, svgTree, updateTreeWithHistory])

  const updateOpacity = useCallback((value: string) => {
    if (selectedIds.size === 0 || !svgTree) return
    updateAttribute('opacity', value)
    setOpacity(value)
  }, [selectedIds, svgTree, updateAttribute])

  const updateRotation = useCallback((angle: number) => {
    if (selectedIds.size === 0 || !svgTree) return
    const next = updateMultipleNodes(svgTree, selectedIds, (n) => {
      const transform = n.attrs.transform || ''
      const parsed = parseTransform(transform)
      const newTransform = buildTransform(parsed.translate, angle)
      if (newTransform) {
        n.attrs.transform = newTransform
      } else {
        delete n.attrs.transform
      }
    })
    updateTreeWithHistory(next)
    setRotation(angle)
  }, [selectedIds, svgTree, updateTreeWithHistory])

  const groupSelected = useCallback(() => {
    if (selectedIds.size === 0 || !svgTree) return
    // For multi-select, group the first selected item only (can be enhanced to group multiple)
    const firstId = Array.from(selectedIds)[0]
    if (firstId === svgTree.id) return
    const node = findNode(svgTree, firstId)
    if (!node) return
    const parent = findParent(svgTree, firstId)
    if (!parent) return

    // Create a group element with unique ID
    const timestamp = Date.now()
    const newGroup: SvgNode = {
      id: `group-${timestamp}`,
      tag: 'g',
      attrs: { 'data-id': `group-${timestamp}` },
      children: [cloneNode(node)],
    }

    // Replace node with group containing the node
    const next = updateNode(svgTree, parent.id, (p) => {
      const index = p.children.findIndex((c) => c.id === firstId)
      if (index >= 0) {
        p.children[index] = newGroup
      }
    })
    updateTreeWithHistory(next)
    setSelectedIds(new Set([newGroup.id]))
  }, [selectedIds, svgTree, updateTreeWithHistory])

  const ungroupSelected = useCallback(() => {
    if (selectedIds.size === 0 || !svgTree) return
    const firstId = Array.from(selectedIds)[0]
    const node = findNode(svgTree, firstId)
    if (!node || node.tag !== 'g') return
    const parent = findParent(svgTree, firstId)
    if (!parent) return

    // Replace group with its children
    const next = updateNode(svgTree, parent.id, (p) => {
      const index = p.children.findIndex((c) => c.id === firstId)
      if (index >= 0 && node.children.length > 0) {
        p.children.splice(index, 1, ...node.children.map(cloneNode))
      }
    })
    updateTreeWithHistory(next)
    if (node.children.length > 0) {
      setSelectedIds(new Set([node.children[0].id]))
    }
  }, [selectedIds, svgTree, updateTreeWithHistory])

  const exportToPng = useCallback(async () => {
    if (!svgTree) return
    const svgString = exportSvg()
    if (!svgString) return

    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      // Use natural dimensions or fallback to reasonable defaults
      canvas.width = img.naturalWidth || 800
      canvas.height = img.naturalHeight || 600
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = canvasBg
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0)
        canvas.toBlob((blob) => {
          if (blob) {
            const pngUrl = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = pngUrl
            link.download = 'export.png'
            link.click()
            URL.revokeObjectURL(pngUrl)
          }
        })
      }
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      setError('Failed to export PNG')
    }
    img.src = url
  }, [svgTree, canvasBg])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault()
        selectAll()
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        deleteSelected()
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault()
        duplicateSelected()
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'g' && !e.shiftKey) {
        e.preventDefault()
        groupSelected()
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'g' && e.shiftKey) {
        e.preventDefault()
        ungroupSelected()
      } else if (e.key === '?') {
        e.preventDefault()
        setShowShortcuts((prev) => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectAll, undo, redo, deleteSelected, duplicateSelected, groupSelected, ungroupSelected])

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">SVG studio</p>
            <h1 className="text-3xl font-semibold text-slate-900">Browser SVG Editor</h1>
            <p className="mt-1 text-sm text-slate-600">
              Upload or paste an SVG, then tweak colors, text, and attributes live.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:shadow disabled:opacity-50"
              onClick={undo}
              disabled={historyIndex <= 0 || !svgTree}
              title="Undo (Cmd/Ctrl+Z)"
            >
              ↶ Undo
            </button>
            <button
              className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:shadow disabled:opacity-50"
              onClick={redo}
              disabled={historyIndex >= history.length - 1 || !svgTree}
              title="Redo (Cmd/Ctrl+Shift+Z)"
            >
              ↷ Redo
            </button>
            <button
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={selectAll}
              disabled={!svgTree}
              title={areAllSelected ? "Deselect All (Cmd/Ctrl+A)" : "Select All Elements (Cmd/Ctrl+A)"}
            >
              {areAllSelected ? '✗ Deselect All' : '✓ Select All'}
            </button>
            <button
              className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:shadow disabled:opacity-50"
              onClick={() => setShowTreeView(!showTreeView)}
              disabled={!svgTree}
              title="Element Tree"
            >
              🌳 Tree
            </button>
            <button
              className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:shadow"
              onClick={() => setShowShortcuts(!showShortcuts)}
              title="Keyboard Shortcuts (?)"
            >
              ⌨️ Shortcuts
            </button>
            <button
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:shadow disabled:opacity-50"
              onClick={copyToClipboard}
              disabled={!svgTree}
            >
              Copy SVG
            </button>
            <button
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={downloadSvg}
              disabled={!svgTree}
            >
              Download SVG
            </button>
            <button
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={exportToPng}
              disabled={!svgTree}
            >
              Export PNG
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="glass scroll-slim lg:col-span-8 rounded-2xl p-4 shadow-soft">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800">Canvas</h2>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white">
                  <button
                    onClick={handleZoomOut}
                    disabled={zoom <= 0.25}
                    className="rounded-l-lg px-2 py-1 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Zoom out"
                  >
                    −
                  </button>
                  <button
                    onClick={handleZoomReset}
                    className="px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                    title="Reset zoom"
                  >
                    {Math.round(zoom * 100)}%
                  </button>
                  <button
                    onClick={handleZoomIn}
                    disabled={zoom >= 3}
                    className="rounded-r-lg px-2 py-1 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Zoom in"
                  >
                    +
                  </button>
                </div>
              {error ? (
                <span className="text-xs font-medium text-rose-600">{error}</span>
                ) : selectedIds.size > 0 ? (
                <span className="text-xs text-slate-500">
                    {selectedIds.size === 1 ? (
                      <>
                        Selected: <strong className="text-slate-700">{selectedNodes[0]?.tag}</strong>
                      </>
                    ) : (
                      <>
                        <strong className="text-slate-700">{selectedIds.size} elements</strong> selected
                      </>
                    )}
                </span>
              ) : (
                <span className="text-xs text-slate-400">No selection</span>
              )}
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Grid
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <span>Background:</span>
                <input
                  type="color"
                  value={canvasBg}
                  onChange={(e) => setCanvasBg(e.target.value)}
                  className="h-5 w-12 rounded border border-slate-300"
                />
              </label>
            </div>
            <div
              className="mt-3 overflow-auto rounded-xl border border-slate-200 bg-white p-4 relative"
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onMouseLeave={handlePointerUp}
              onWheel={handleWheel}
              style={{
                backgroundImage: showGrid
                  ? `linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)`
                  : 'none',
                backgroundSize: '20px 20px',
                backgroundColor: canvasBg,
              }}
            >
              {svgTree ? (
                <>
                  <div
                    className="flex justify-center transition-transform duration-200 ease-in-out"
                    style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
                  >
                  {renderNode(svgTree)}
                </div>
                  {selectedIds.size > 0 && <SelectionOverlay />}
                </>
              ) : (
                <div className="flex h-72 flex-col items-center justify-center text-slate-500">
                  <p className="text-sm">Upload or paste an SVG to start editing.</p>
                </div>
              )}
            </div>
          </section>

          <section className="glass scroll-slim lg:col-span-4 space-y-4 rounded-2xl p-4 shadow-soft">
            <h2 className="text-base font-semibold text-slate-800">Controls</h2>

            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Load SVG</span>
                <input
                  type="file"
                  accept=".svg,image/svg+xml"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFile(file)
                  }}
                  className="text-xs text-slate-500"
                />
              </div>
              <textarea
                className="h-32 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 shadow-inner outline-none focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-200"
                placeholder="Paste SVG markup here"
                value={rawSvg}
                onChange={(e) => handleSvgInput(e.target.value)}
              />
            </div>

            <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">Fill color</span>
                  <span className="text-xs text-slate-500">{fillColor}</span>
                </div>
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <HexColorPicker
                    color={fillColor}
                    onChange={(color) => {
                      setFillColor(color)
                      updateAttributeWithoutHistory('fill', color)
                    }}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">Stroke</span>
                  <span className="text-xs text-slate-500">{strokeColor}</span>
                </div>
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <HexColorPicker
                    color={strokeColor}
                    onChange={(color) => {
                      setStrokeColor(color)
                      updateAttributeWithoutHistory('stroke', color)
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <label className="flex flex-col gap-1">
                    <span className="font-medium text-slate-700">Width</span>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={strokeWidth}
                      onChange={(e) => {
                        setStrokeWidth(e.target.value)
                        updateAttribute('stroke-width', e.target.value)
                      }}
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-200"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="font-medium text-slate-700">Opacity</span>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.05"
                      value={strokeOpacity}
                      onChange={(e) => {
                        setStrokeOpacity(e.target.value)
                        updateAttribute('stroke-opacity', e.target.value)
                      }}
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-200"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="font-medium text-slate-700">Dash array</span>
                    <input
                      type="text"
                      placeholder="e.g. 4 2"
                      value={strokeDash}
                      onChange={(e) => {
                        setStrokeDash(e.target.value)
                        updateAttribute('stroke-dasharray', e.target.value)
                      }}
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-200"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="font-medium text-slate-700">Line cap</span>
                    <select
                      value={strokeLinecap}
                      onChange={(e) => {
                        setStrokeLinecap(e.target.value)
                        updateAttribute('stroke-linecap', e.target.value)
                      }}
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-200"
                    >
                      <option value="butt">butt</option>
                      <option value="round">round</option>
                      <option value="square">square</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="font-medium text-slate-700">Line join</span>
                    <select
                      value={strokeLinejoin}
                      onChange={(e) => {
                        setStrokeLinejoin(e.target.value)
                        updateAttribute('stroke-linejoin', e.target.value)
                      }}
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-200"
                    >
                      <option value="miter">miter</option>
                      <option value="round">round</option>
                      <option value="bevel">bevel</option>
                    </select>
                  </label>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-500">
                  <input
                    type="text"
                    value={attrKey}
                    onChange={(e) => setAttrKey(e.target.value)}
                    placeholder="attribute"
                    className="w-1/2 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-200"
                  />
                  <input
                    type="text"
                    value={attrValue}
                    onChange={(e) => setAttrValue(e.target.value)}
                    placeholder="value"
                    className="w-1/2 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-200"
                  />
                  <button
                    className="rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
                    onClick={() => updateAttribute(attrKey, attrValue)}
                    disabled={selectedIds.size === 0 || !attrKey}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Text</span>
                <span className="text-xs text-slate-500">Works on text nodes</span>
              </div>
              <input
                type="text"
                value={textValue}
                onChange={(e) => {
                  setTextValue(e.target.value)
                  updateText(e.target.value)
                }}
                placeholder="Edit selected text"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 shadow-inner outline-none focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-200"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-3">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-slate-700">Opacity</span>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={opacity}
                  onChange={(e) => updateOpacity(e.target.value)}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-200"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-slate-700">Rotation (°)</span>
                <input
                  type="number"
                  value={rotation}
                  onChange={(e) => updateRotation(Number(e.target.value))}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-200"
                />
              </label>
            </div>

            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Element Actions</span>
              </div>
              <div className="mb-2">
                <button
                  className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={selectAll}
                  disabled={!svgTree}
                  title={areAllSelected ? "Deselect All (Cmd/Ctrl+A)" : "Select All (Cmd/Ctrl+A)"}
                >
                  {areAllSelected ? '✗ Deselect All' : '✓ Select All'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={deleteSelected}
                  disabled={selectedIds.size === 0 || (svgTree ? selectedIds.has(svgTree.id) : false)}
                  title="Delete (Delete/Backspace)"
                >
                  🗑️ Delete
                </button>
                <button
                  className="rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={duplicateSelected}
                  disabled={selectedIds.size === 0 || (svgTree ? selectedIds.has(svgTree.id) : false)}
                  title="Duplicate (Cmd/Ctrl+D)"
                >
                  📋 Duplicate
                </button>
                <button
                  className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={groupSelected}
                  disabled={selectedIds.size === 0 || (svgTree ? selectedIds.has(svgTree.id) : false)}
                  title="Group (Cmd/Ctrl+G)"
                >
                  📦 Group
                </button>
                <button
                  className="rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={ungroupSelected}
                  disabled={selectedIds.size === 0 || selectedNodes.length === 0 || selectedNodes[0]?.tag !== 'g'}
                  title="Ungroup (Cmd/Ctrl+Shift+G)"
                >
                  📦 Ungroup
                </button>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Export</span>
                <button
                  className="text-xs font-semibold text-sky-600 hover:text-sky-700"
                  onClick={copyToClipboard}
                  disabled={!svgTree}
                >
                  Copy
                </button>
              </div>
              <textarea
                value={exportSvg()}
                readOnly
                className="h-32 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 shadow-inner outline-none"
                placeholder="SVG output will appear here"
              />
            </div>
          </section>
        </div>
      </div>

      {/* Element Tree View */}
      {showTreeView && svgTree && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowTreeView(false)}>
          <div className="max-h-[80vh] w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Element Tree</h2>
              <button
                onClick={() => setShowTreeView(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[60vh] overflow-auto rounded-lg border border-slate-200 p-4">
              <TreeNode
                node={svgTree}
                selectedIds={selectedIds}
                onSelect={(id, multi) => {
                  if (multi) {
                    setSelectedIds((prev) => {
                      const next = new Set(prev)
                      if (next.has(id)) {
                        next.delete(id)
                      } else {
                        next.add(id)
                      }
                      return next
                    })
                  } else {
                    setSelectedIds(new Set([id]))
                    setShowTreeView(false)
                  }
                }}
                level={0}
              />
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowShortcuts(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Keyboard Shortcuts</h2>
              <button
                onClick={() => setShowShortcuts(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <ShortcutRow keys={['Cmd/Ctrl', 'A']} action="Select all elements" />
              <ShortcutRow keys={['Cmd/Ctrl', 'Z']} action="Undo" />
              <ShortcutRow keys={['Cmd/Ctrl', 'Shift', 'Z']} action="Redo" />
              <ShortcutRow keys={['Cmd/Ctrl', 'Click']} action="Toggle multi-select (add/remove)" />
              <ShortcutRow keys={['Shift', 'Click']} action="Add to selection" />
              <ShortcutRow keys={['Delete']} action="Delete selected element(s)" />
              <ShortcutRow keys={['Cmd/Ctrl', 'D']} action="Duplicate element" />
              <ShortcutRow keys={['Cmd/Ctrl', 'G']} action="Group elements" />
              <ShortcutRow keys={['Cmd/Ctrl', 'Shift', 'G']} action="Ungroup elements" />
              <ShortcutRow keys={['?']} action="Show shortcuts" />
              <ShortcutRow keys={['Cmd/Ctrl', '+', 'Scroll']} action="Zoom in/out" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const TreeNode = ({ node, selectedIds, onSelect, level }: { node: SvgNode; selectedIds: Set<string>; onSelect: (id: string, multi: boolean) => void; level: number }) => {
  const isSelected = selectedIds.has(node.id)
  return (
    <div className="select-none">
      <div
        className={`flex items-center gap-2 rounded px-2 py-1 hover:bg-slate-100 ${isSelected ? 'bg-sky-100 font-semibold' : ''}`}
        style={{ paddingLeft: `${level * 1.5 + 0.5}rem` }}
        onClick={(e) => onSelect(node.id, e.ctrlKey || e.metaKey)}
      >
        <span className="text-xs text-slate-400">{node.tag}</span>
        <span className="text-xs text-slate-500">{node.id}</span>
      </div>
      {node.children.filter((c) => c.tag !== '#text').map((child) => (
        <TreeNode key={child.id} node={child} selectedIds={selectedIds} onSelect={onSelect} level={level + 1} />
      ))}
    </div>
  )
}

const ShortcutRow = ({ keys, action }: { keys: string[]; action: string }) => {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
      <span className="text-sm text-slate-700">{action}</span>
      <div className="flex gap-1">
        {keys.map((key, i) => (
          <React.Fragment key={i}>
            <kbd className="rounded bg-slate-100 px-2 py-1 text-xs font-mono font-semibold text-slate-700">
              {key}
            </kbd>
            {i < keys.length - 1 && <span className="text-slate-400">+</span>}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

export default App
