// frontend/src/components/SafeHTML.tsx
import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import { defaultSchema } from 'hast-util-sanitize'

/**
 * Allow inline color on <span>, <strong> and <em>.
 * Everything else stays as in the default safe schema.
 */
const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    span: [
      ...(defaultSchema.attributes?.span || []),
      ['style'], // <span style="color:#00bcd4">
    ],
    strong: [
      ...(defaultSchema.attributes?.strong || []),
      ['style'], // <strong style="color:#00bcd4">
    ],
    em: [
      ...(defaultSchema.attributes?.em || []),
      ['style'], // <em style="color:#00bcd4">
    ],
  },
}

/** Optional shortcodes, keep if you still use [turq]..[/turq] etc. */
export function applyShortcodes(md: string) {
  return md
    .replace(/\[turq\]([\s\S]*?)\[\/turq\]/g, '<span style="color:#00bcd4">$1</span>')
    .replace(/\[red\]([\s\S]*?)\[\/red\]/g, '<span style="color:#e53935">$1</span>')
    .replace(/\[gray\]([\s\S]*?)\[\/gray\]/g, '<span style="color:#607d8b">$1</span>')
}

type Props = {
  children?: string | null
}

/**
 * SafeHTML: renders Quill HTML + markdown with:
 * - GFM markdown
 * - inline HTML (rehypeRaw)
 * - sanitization (rehype-sanitize + tweaked schema)
 */
export default function SafeHTML({ children }: Props) {
  const text = applyShortcodes(children || '')

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}
      components={{
        p: ({ node, ...props }) => <p style={{ margin: 0 }} {...props} />,
      }}
    >
      {text}
    </ReactMarkdown>
  )
}