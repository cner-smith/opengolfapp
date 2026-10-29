import { useState, type DragEvent } from 'react'

// A paper drop box under a file key: the edge firms to ink and the face lifts
// while files are dragged over it. A click or tap opens the file chooser too
// (phones never drag); its input stays out of the tab order, since the key
// above is the keyboard's way in.
export function FileDrop({
  label,
  accept,
  multiple,
  disabled,
  onFiles,
}: {
  label: string
  accept: string
  multiple?: boolean
  disabled?: boolean
  onFiles: (files: File[]) => void
}) {
  const [over, setOver] = useState(false)
  const hover = (e: DragEvent) => {
    e.preventDefault()
    if (!disabled) setOver(true)
  }
  return (
    <label
      onDragEnter={hover}
      onDragOver={hover}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        if (!disabled && e.dataTransfer.files.length) onFiles(Array.from(e.dataTransfer.files))
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
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {label}
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        onChange={(e) => {
          // A copy: clearing the input empties its live FileList.
          if (e.target.files?.length) onFiles(Array.from(e.target.files))
          e.target.value = ''
        }}
      />
    </label>
  )
}
