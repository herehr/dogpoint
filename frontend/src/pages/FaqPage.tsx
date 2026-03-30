import React from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Container,
  IconButton,
  InputAdornment,
  Link as MuiLink,
  TextField,
  Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import SearchIcon from '@mui/icons-material/Search'
import ClearIcon from '@mui/icons-material/Clear'
import { Link as RouterLink } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import faqMarkdown from '../content/faq.md?raw'
import { parseFaqMarkdown, type FaqSection } from '../utils/parseFaqMarkdown'

const ACCORDION_BG = '#E6F7F8'

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

const markdownSx = {
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
  '& p': { mb: 1.5, lineHeight: 1.7, color: 'text.primary' },
  '& p:last-child': { mb: 0 },
  '& ul, & ol': { pl: 2.5, my: 1.5 },
  '& li': { mb: 0.75 },
  '& a': { fontWeight: 600 },
} as const

function normalizeForSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function matchesSearch(haystack: string, query: string): boolean {
  const nq = normalizeForSearch(query.trim())
  if (!nq) return true
  const nt = normalizeForSearch(haystack)
  const words = nq.split(/\s+/).filter(Boolean)
  return words.every((w) => nt.includes(w))
}

function filterSections(sections: FaqSection[], query: string): FaqSection[] {
  if (!query.trim()) return sections
  const out: FaqSection[] = []
  for (const sec of sections) {
    if (sec.type === 'markdown') {
      if (matchesSearch(`${sec.title} ${sec.body}`, query)) out.push(sec)
      continue
    }
    const items = sec.items.filter((it) =>
      matchesSearch(`${sec.title} ${it.question} ${it.answerMarkdown}`, query)
    )
    if (items.length > 0) out.push({ ...sec, items })
  }
  return out
}

export default function FaqPage() {
  const [searchQuery, setSearchQuery] = React.useState('')

  const parsed = React.useMemo(() => parseFaqMarkdown(faqMarkdown), [])
  const filteredSections = React.useMemo(
    () => filterSections(parsed.sections, searchQuery),
    [parsed.sections, searchQuery]
  )

  const isFiltering = Boolean(searchQuery.trim())
  const itemCount = filteredSections.reduce(
    (n, s) => n + (s.type === 'accordion' ? s.items.length : 0),
    0
  )
  const noResults = isFiltering && filteredSections.length === 0

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 }, pb: 6 }}>
      <Typography
        variant="h4"
        component="h1"
        sx={{ fontWeight: 900, mb: 1.5, color: 'text.primary' }}
      >
        {parsed.pageTitle}
      </Typography>

      {parsed.introMarkdown ? (
        <Box sx={{ ...markdownSx, mb: 3 }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: MarkdownLink }}>
            {parsed.introMarkdown}
          </ReactMarkdown>
        </Box>
      ) : null}

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
          mb: 2,
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
            ? 'Nic nevyhovuje. Zkuste jiné slovo (hledání ignoruje háčky a čárky).'
            : isFiltering
              ? `Zobrazeno otázek: ${itemCount}`
              : 'Psaním textu zúžíte seznam otázek.'}
        </Typography>
      </Box>

      {noResults ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Nic nenalezeno.{' '}
          <Button variant="text" size="small" onClick={() => setSearchQuery('')} sx={{ p: 0, minWidth: 0 }}>
            Zrušit filtr
          </Button>
        </Alert>
      ) : (
        <>
          {filteredSections.map((sec, si) => {
            if (sec.type === 'markdown') {
              return (
                <Box key={`md-${si}`} sx={{ mt: 4, mb: 2 }}>
                  <Typography variant="h5" component="h2" sx={{ fontWeight: 800, mb: 2 }}>
                    {sec.title}
                  </Typography>
                  <Box sx={markdownSx}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: MarkdownLink }}>
                      {sec.body}
                    </ReactMarkdown>
                  </Box>
                </Box>
              )
            }

            return (
              <Box key={`acc-${si}`} component="section" sx={{ mb: 3 }}>
                <Typography variant="h5" component="h2" sx={{ fontWeight: 800, mb: 1.5 }}>
                  {sec.title}
                </Typography>
                {sec.items.map((item) => (
                  <Accordion
                    key={item.id}
                    disableGutters
                    elevation={0}
                    sx={{
                      mb: 1.5,
                      bgcolor: ACCORDION_BG,
                      borderRadius: '10px',
                      overflow: 'hidden',
                      boxShadow: 'none',
                      '&:before': { display: 'none' },
                    }}
                  >
                    <AccordionSummary
                      expandIcon={<ExpandMoreIcon sx={{ color: 'text.primary' }} aria-hidden />}
                      aria-controls={`${item.id}-content`}
                      id={`${item.id}-header`}
                      sx={{
                        px: 2,
                        minHeight: 52,
                        '& .MuiAccordionSummary-content': {
                          my: 1.25,
                          overflow: 'hidden',
                        },
                      }}
                    >
                      <Typography component="span" sx={{ fontWeight: 700, pr: 1, color: 'text.primary' }}>
                        {item.question}
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={{ px: 2, pt: 0, pb: 2.5 }}>
                      <Box sx={markdownSx}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: MarkdownLink }}>
                          {item.answerMarkdown}
                        </ReactMarkdown>
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Box>
            )
          })}
        </>
      )}
    </Container>
  )
}
