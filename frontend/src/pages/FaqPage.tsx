import React from 'react'
import {
  Alert,
  Box,
  Button,
  Container,
  Divider,
  IconButton,
  InputAdornment,
  Link as MuiLink,
  TextField,
  Typography,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import ClearIcon from '@mui/icons-material/Clear'
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

/** Lowercase + strip diacritics so "ucet" finds "účet". */
function normalizeForSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

/** Split FAQ into blocks at ## headings (H2 only); first block is intro + title. */
function splitFaqByH2(md: string): { raw: string }[] {
  const parts = md.split(/\n(?=## )/)
  return parts.map((p) => p.trim()).filter(Boolean).map((raw) => ({ raw }))
}

function matchesSearch(haystack: string, query: string): boolean {
  const nq = normalizeForSearch(query.trim())
  if (!nq) return true
  const nt = normalizeForSearch(haystack)
  const words = nq.split(/\s+/).filter(Boolean)
  return words.every((w) => nt.includes(w))
}

const markdownSx = {
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
} as const

export default function FaqPage() {
  const [searchQuery, setSearchQuery] = React.useState('')

  const sections = React.useMemo(() => splitFaqByH2(faqMarkdown), [])

  const { displayMarkdown, matchCount, isFiltering } = React.useMemo(() => {
    const q = searchQuery.trim()
    if (!q) {
      return { displayMarkdown: faqMarkdown, matchCount: sections.length, isFiltering: false }
    }
    const matched = sections.filter((s) => matchesSearch(s.raw, q))
    return {
      displayMarkdown: matched.length === 0 ? '' : matched.map((s) => s.raw).join('\n\n'),
      matchCount: matched.length,
      isFiltering: true,
    }
  }, [searchQuery, sections])

  const noResults = isFiltering && matchCount === 0

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 }, pb: 6 }}>
      <Box
        component="section"
        aria-label="Vyhledávání v častých dotazech"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          bgcolor: 'background.default',
          pt: 1,
          pb: 2,
          mb: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <TextField
          fullWidth
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Hledat (např. platba, patron, převod, pejsek…)"
          variant="outlined"
          size="small"
          InputProps={{
            'aria-describedby': 'faq-search-hint',
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" aria-hidden />
              </InputAdornment>
            ),
            endAdornment: searchQuery ? (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  aria-label="Vymazat hledání"
                  onClick={() => setSearchQuery('')}
                  edge="end"
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />
        <Typography id="faq-search-hint" variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          {noResults
            ? 'Žádná sekce nevyhovuje. Zkuste kratší výraz nebo jiná slova (hledání ignoruje háčky a čárky).'
            : isFiltering
              ? `Zobrazeno sekcí: ${matchCount} (všechna slova z dotazu musí být v jedné sekci).`
              : 'Psaním textu zúžíte zobrazení na sekce, kde se výraz vyskytuje. Více slov: všechna musí být nalezena ve stejné sekci.'}
        </Typography>
      </Box>

      {noResults ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Nic nenalezeno. Zkuste obecnější slovo nebo{' '}
          <Button variant="text" size="small" onClick={() => setSearchQuery('')} sx={{ p: 0, minWidth: 0, verticalAlign: 'baseline' }}>
            zrušit filtr
          </Button>
          .
        </Alert>
      ) : (
        <Box sx={markdownSx}>
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
            {displayMarkdown}
          </ReactMarkdown>
        </Box>
      )}
    </Container>
  )
}
