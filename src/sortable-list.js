import { createElement as h, useRef, useState } from 'react'

/** Reuses the assembly editor's pointer-capture / insertion-boundary / placeholder flow. */
export function SortableList({ items, itemKey, itemName, canMove = () => true, onMove, renderItem, className, label, handleLabel, busy, locale = 0 }) {
  const [dragFrom, setDragFrom] = useState(null), [dropIndex, setDropIndex] = useState(null)
  const drop = useRef(null)
  const reset = () => { setDragFrom(null); setDropIndex(null); drop.current = null }
  const selectBoundary = at => { drop.current = at; setDropIndex(at) }
  const boundary = event => {
    const list = event.currentTarget.closest('[data-sort-list]')
    const hit = document.elementFromPoint(event.clientX, event.clientY)
    if (!hit || !list?.contains(hit)) return null
    const target = hit.closest('[data-sort-index]')
    if (!target) return drop.current
    const rect = target.getBoundingClientRect(), at = Number(target.dataset.sortIndex)
    return event.clientY < rect.top + rect.height / 2 ? at : at + 1
  }
  const placeholder = index => dragFrom !== null && dropIndex === index ? h('div', { key: `drop-${index}`, className: 'dta-drop-placeholder', role: 'status' }, `${locale === 0 ? '松开放到这里：' : 'Drop here: '}${itemName(items[dragFrom])}`) : null
  return h('div', { className, 'data-sort-list': true, 'aria-label': label }, ...items.flatMap((item, index) => {
    const movable = canMove(item)
    const handle = h('button', { type: 'button', className: 'dta-handle dta-sort-handle', disabled: busy || !movable, title: locale === 0 ? movable ? '按住拖动，松开放入占位框' : '位置由运行时管理' : movable ? 'Hold to drag; release in the placeholder' : 'Position managed by runtime', 'aria-label': `${handleLabel}: ${itemName(item)}`, 'aria-pressed': dragFrom === index,
      onPointerDown: event => { if (event.button !== 0) return; event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); setDragFrom(index); selectBoundary(index + 1) },
      onPointerMove: event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) selectBoundary(boundary(event)) },
      onPointerUp: event => {
        event.preventDefault()
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
        const at = boundary(event)
        event.currentTarget.releasePointerCapture(event.pointerId)
        reset()
        if (at !== null && at !== index && at !== index + 1) onMove(item, items[at] ?? null)
      },
      onPointerCancel: reset, onLostPointerCapture: reset,
    }, h('span', { 'aria-hidden': true, className: 'dta-grip-icon' }, '⠿'))
    return [placeholder(index), h('div', { key: itemKey(item), className: 'dta-sort-item', 'data-sort-index': index, 'data-dragging': dragFrom === index }, renderItem(item, index, handle))]
  }), placeholder(items.length))
}
