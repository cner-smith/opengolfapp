import { useState, type DragEvent } from 'react'

// A paper drop box under a file key: the edge firms to ink and the face lifts
// while files are dragged over it.
export function FileDrop({
  label,
  disabled,
  onFiles,
}: {
  label: string
  disabled?: boolean
  onFiles: (files: FileList) => void
}) {
  const [over, setOver] = useState(false)
  const hover = (e: DragEvent) => {
    e.preventDefault()
    if (!disabled) setOver(true)
  }
  return (
    <div
      onDragEnter={hover}
      onDragOver={hover}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        if (!disabled && e.dataTransfer.files.length) onFiles(e.dataTransfer.files)
      }}
      className="font-serif flex items-center justify-center text-center"
      style={{
        minHeight: 120,
        padding: 16,
        border: `1px ${over ? 'solid #1C211C' : 'dashed #9F9580'}`,
        borderRadius: 4,
        background: over ? '#FBF8F1' : 'transparent',
        color: over ? '#1C211C' : '#5C6356',
        fontSize: 17,
        fontStyle: 'italic',
        transition: 'background 120ms ease-out, border-color 120ms ease-out, color 120ms ease-out',
      }}
    >
      {label}
    </div>
  )
}
