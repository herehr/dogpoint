import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import { defaultSchema } from 'hast-util-sanitize'

/** allow inline color on <span> only */
const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    span: [
      ...(defaultSchema.attributes?.span || []),
      ['style'] // only styles on <span> will be allowed
    ]
  }
}

/** our tiny color shortcodes -> safe inline spans */
export function applyShortcodes(md: string) {
  return md
    .replace(/\[turq\]([\s\S]*?)\[\/turq\]/g, '<span style="color:#00bcd4">$1</span>')
    .replace(/\[red\]([\s\S]*?)\[\/red\]/g, '<span style="color:#e53935">$1</span>')
    .replace(/\[gray\]([\s\S]*?)\[\/gray\]/g, '<span style="color:#607d8b">$1</span>')
}

export default function SafeMarkdown({ children }: { children: string }) {
  const text = applyShortcodes(children || '')
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}
      components={{
        // Optional: tighten typography if you like
        p: ({node, ...props}) => <p style={{margin: 0}} {...props} />
      }}
    >
      {text}
    </ReactMarkdown>
  )
}