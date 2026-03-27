import React from 'react'
import { Box, Container, Divider, Link as MuiLink, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import faqMarkdown from '../content/faq.md?raw'

function MarkdownLink(props: React.ComponentProps<'a'>) {
  const { href, children, ...rest } = props
  if (href?.startsWith('/') && !href.startsWith('//')) {
    return (
      <MuiLink component={RouterLink} to={href} {...(rest as object)}>
        {children}
      </MuiLink>
    )
  }
  return (
    <MuiLink
      href={href}
      target={href?.startsWith('http') ? '_blank' : undefined}
      rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
      {...rest}
    >
      {children}
    </MuiLink>
  )
}

export default function FaqPage() {
  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 }, pb: 6 }}>
      <Box
        sx={{
          '& h1': { scrollMarginTop: 96 },
          '& h2': { scrollMarginTop: 88 },
          '& table': {
            width: '100%',
            borderCollapse: 'collapse',
            my: 2,
            fontSize: '0.95rem',
          },
          '& th, & td': {
            border: '1px solid',
            borderColor: 'divider',
            p: 1.25,
            textAlign: 'left',
            verticalAlign: 'top',
          },
          '& th': { bgcolor: 'grey.50', fontWeight: 700 },
          '& code': {
            fontSize: '0.88em',
            bgcolor: 'grey.100',
            px: 0.5,
            py: 0.25,
            borderRadius: 0.5,
            fontFamily: 'ui-monospace, monospace',
          },
          '& pre': { overflow: 'auto', bgcolor: 'grey.100', p: 2, borderRadius: 1 },
          '& pre code': { bgcolor: 'transparent', p: 0 },
          '& hr': { my: 3, borderColor: 'divider' },
          '& p': { mb: 1.5, lineHeight: 1.7, color: 'text.primary' },
          '& ul, & ol': { pl: 2.5, my: 1.5 },
          '& li': { mb: 0.75 },
          '& blockquote': {
            borderLeft: '4px solid',
            borderColor: 'primary.main',
            pl: 2,
            my: 2,
            color: 'text.secondary',
          },
        }}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSlug]}
          components={{
            h1: ({ node, ...props }) => (
              <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 900, mb: 2 }} {...props} />
            ),
            h2: ({ node, ...props }) => (
              <Typography
                variant="h5"
                component="h2"
                sx={{ mt: 4, mb: 2, fontWeight: 800, '&:first-of-type': { mt: 0 } }}
                {...props}
              />
            ),
            h3: ({ node, ...props }) => (
              <Typography variant="h6" component="h3" sx={{ mt: 2, mb: 1, fontWeight: 700 }} {...props} />
            ),
            a: MarkdownLink,
            hr: () => <Divider sx={{ my: 3 }} />,
          }}
        >
          {faqMarkdown}
        </ReactMarkdown>
      </Box>
    </Container>
  )
}
