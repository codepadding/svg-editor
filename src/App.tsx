import React, { useCallback, useEffect, useMemo, useState } from 'react'
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

function App() {
  const [rawSvg, setRawSvg] = useState('')
  const [svgTree, setSvgTree] = useState<SvgNode | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
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
  const [dragState, setDragState] = useState<{
    id: string
    startX: number
    startY: number
    baseTransform: string
  } | null>(null)

  const selectedNode = useMemo(() => findNode(svgTree, selectedId), [svgTree, selectedId])

  useEffect(() => {
    // Only sync when selection ID changes, not when tree updates
    if (!selectedId) {
      // Reset to defaults when nothing is selected
      setFillColor('#0ea5e9')
      setStrokeColor('#0f172a')
      setStrokeWidth('1')
      setStrokeDash('')
      setStrokeOpacity('1')
      setStrokeLinecap('round')
      setStrokeLinejoin('round')
      setTextValue('')
      return
    }

    const node = findNode(svgTree, selectedId)
    if (node) {
      const fill = getAttrOrStyle(node, 'fill')
      setFillColor(fill || '#0ea5e9')

      const stroke = getAttrOrStyle(node, 'stroke')
      setStrokeColor(stroke || '#0f172a')

      const width = getAttrOrStyle(node, 'stroke-width')
      setStrokeWidth(width || '1')

      const dash = getAttrOrStyle(node, 'stroke-dasharray')
      setStrokeDash(dash || '')

      const opacity = getAttrOrStyle(node, 'stroke-opacity')
      setStrokeOpacity(opacity || '1')

      const linecap = getAttrOrStyle(node, 'stroke-linecap')
      setStrokeLinecap(linecap || 'round')

      const linejoin = getAttrOrStyle(node, 'stroke-linejoin')
      setStrokeLinejoin(linejoin || 'round')

      const text = getFirstText(node)
      if (text !== undefined) {
        setTextValue(text)
      } else {
        setTextValue('')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  const handleSvgInput = useCallback((value: string) => {
    setRawSvg(value)
    const { tree, clean } = parseSvgString(value)
    if (!tree) {
      setError('No <svg> tag found. Paste a valid SVG.')
      setSvgTree(null)
      setSelectedId(null)
      return
    }
    setError(null)
    setSvgTree(tree)
    setRawSvg(clean)
    setSelectedId(tree.id)
  }, [])

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result?.toString() || ''
      handleSvgInput(text)
    }
    reader.readAsText(file)
  }, [handleSvgInput])

  const renderNode = (node: SvgNode): React.ReactNode => {
    if (node.tag === '#text') {
      return node.text
    }

    const { tag, attrs, children } = node
    const isSelected = node.id === selectedId
    const baseStyle =
      typeof attrs.style === 'string' ? styleStringToObject(attrs.style) : attrs.style
    const mergedStyle: React.CSSProperties = {
      ...(baseStyle ?? {}),
      outline: isSelected ? '2px solid #0ea5e9' : undefined,
      outlineOffset: 2,
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
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation()
        setSelectedId(node.id)
      },
      onMouseDown: (e: React.MouseEvent) => {
        if (node.tag === 'svg') return
        e.stopPropagation()
        setSelectedId(node.id)
        setDragState({
          id: node.id,
          startX: e.clientX,
          startY: e.clientY,
          baseTransform: node.attrs.transform ?? '',
        })
      },
      style: {
        ...mergedStyle,
      },
    }

    return React.createElement(tag, mergedAttrs, children.map(renderNode))
  }

  const updateAttribute = (key: string, value: string) => {
    if (!selectedId || !svgTree) return
    const next = updateNode(svgTree, selectedId, (node) => {
      if (key === 'fill' || key === 'stroke') {
        const styleValue = applyStyleValue(node.attrs.style, key, value || undefined)
        if (styleValue) node.attrs.style = styleValue
        else delete node.attrs.style
      }
      if (value) node.attrs[key] = value
      else delete node.attrs[key]
    })
    setSvgTree(next)
  }

  const updateText = (value: string) => {
    if (!selectedId || !svgTree) return
    const next = updateNode(svgTree, selectedId, (node) => {
      if (node.tag === '#text') {
        node.text = value
      } else {
        node.children = node.children.map((child) =>
          child.tag === '#text' ? { ...child, text: value } : child,
        )
      }
    })
    setSvgTree(next)
  }

  const handlePointerMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragState) return
      setSvgTree((prev) => {
        if (!prev) return prev
        const dx = e.clientX - dragState.startX
        const dy = e.clientY - dragState.startY
        const transform = `${dragState.baseTransform ? `${dragState.baseTransform} ` : ''}translate(${dx} ${dy})`
        return updateNode(prev, dragState.id, (node) => {
          node.attrs.transform = transform
        })
      })
    },
    [dragState],
  )

  const handlePointerUp = useCallback(() => {
    if (dragState) {
      setDragState(null)
    }
  }, [dragState])

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
          <div className="flex gap-3">
            <button
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:shadow"
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
              Download
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="glass scroll-slim lg:col-span-8 rounded-2xl p-4 shadow-soft">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800">Canvas</h2>
              {error ? (
                <span className="text-xs font-medium text-rose-600">{error}</span>
              ) : selectedNode ? (
                <span className="text-xs text-slate-500">
                  Selected: <strong className="text-slate-700">{selectedNode.tag}</strong>
                </span>
              ) : (
                <span className="text-xs text-slate-400">No selection</span>
              )}
            </div>
            <div
              className="mt-3 overflow-auto rounded-xl border border-slate-200 bg-white p-4"
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onMouseLeave={handlePointerUp}
            >
              {svgTree ? (
                <div className="flex justify-center">
                  {renderNode(svgTree)}
                </div>
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
                      updateAttribute('fill', color)
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
                      updateAttribute('stroke', color)
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
                    disabled={!selectedId || !attrKey}
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
    </div>
  )
}

export default App
