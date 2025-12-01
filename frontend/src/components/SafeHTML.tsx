// frontend/src/components/SafeHTML.tsx
import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import { defaultSchema } from 'hast-util-sanitize'

/**
 * Extend the default sanitize schema:
 * - allow <span style="..."> for colored text
 * - allow <u> for underline
 */
const schema: any = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames || []),
    'span',
    'u',
  ],
  attributes: {
    ...defaultSchema.attributes,
    span: [
      ...(defaultSchema.attributes?.span || []),
      ['style'], // only styles on <span> allowed
    ],
  },
}

/**
 * Our tiny color shortcodes:
 * [turq]text[/turq]  -> <span style="color:#00bcd4">text</span>
 * [red]text[/red]    -> <span style="color:#e53935">text</span>
 * [gray]text[/gray]  -> <span style="color:#607d8b">text</span>
 */
export function applyShortcodes(md: string) {
  return md
    .replace(/\[turq\]([\s\S]*?)\[\/turq\]/g, '<span style="color:#00bcd4">$1</span>')
    .replace(/\[red\]([\s\S]*?)\[\/red\]/g, '<span style="color:#e53935">$1</span>')
    .replace(/\[gray\]([\s\S]*?)\[\/gray\]/g, '<span style="color:#607d8b">$1</span>')
}

/**
 * SafeHTML:
 * - Markdown: **bold**, *italic*, lists, links, etc.
 * - Raw HTML allowed but sanitized (via rehype-sanitize)
 * - Shortcodes [turq]...[/turq] etc.
 */
export default function SafeHTML({ children }: { children?: string | null }) {
  const text = applyShortcodes(children || '')

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}
      components={{
        // Optional: tighter typography
        p: ({ node, ...props }) => <p style={{ margin: 0 }} {...props} />,
      }}
    >
      {text}
    </ReactMarkdown>
  )
}