// frontend/src/components/RichTextEditor.tsx
import React from 'react'
import ReactQuill from 'react-quill'

type Props = {
  value: string
  onChange: (val: string) => void
  label?: string
  helperText?: string
  error?: boolean
}

/**
 * Jednoduchý rich text editor pro moderátory:
 * - tučné (B), kurzíva (I), podtržení (U)
 * - barva textu (včetně tyrkysové #00bcd4)
 */
export default function RichTextEditor({
  value,
  onChange,
  label,
  helperText,
  error,
}: Props) {
  const modules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline'],
      [
        {
          color: ['#000000', '#00bcd4', '#e53935', '#607d8b', '#ffffff'],
        },
      ],
      ['clean'],
    ],
  }

  const formats = ['header', 'bold', 'italic', 'underline', 'color']

  return (
    <div>
      {label && (
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 4,
          }}
        >
          {label}
        </div>
      )}
      <div
        style={{
          border: error ? '1px solid #d32f2f' : '1px solid rgba(0,0,0,0.23)',
          borderRadius: 4,
        }}
      >
        <ReactQuill
          theme="snow"
          value={value}
          onChange={onChange}
          modules={modules}
          formats={formats}
          style={{ minHeight: 140 }}
        />
      </div>
      {helperText && (
        <div
          style={{
            fontSize: 12,
            marginTop: 4,
            color: error ? '#d32f2f' : 'rgba(0,0,0,0.6)',
          }}
        >
          {helperText}
        </div>
      )}
    </div>
  )
}