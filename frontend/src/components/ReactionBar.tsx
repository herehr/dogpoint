import React, { useEffect, useMemo, useState } from 'react'
import { Chip, Stack, Tooltip } from '@mui/material'

const EMOJIS = ['🐾','❤️','😊','👏','🥰','🤩'] as const

function key(animalId: string) { return `reactions:${animalId}` }

export default function ReactionBar({ animalId }: { animalId: string }) {
  const [setStr, setSetStr] = useState<string>('')

  useEffect(() => {
    setSetStr(localStorage.getItem(key(animalId)) || '')
  }, [animalId])

  const selected = useMemo(() => new Set(setStr.split('').filter(Boolean)), [setStr])

  function toggle(emoji: string) {
    const s = new Set(selected)
    if (s.has(emoji)) s.delete(emoji); else s.add(emoji)
    const asStr = Array.from(s).join('')
    setSetStr(asStr)
    localStorage.setItem(key(animalId), asStr)
  }

  return (
    <Stack direction="row" spacing={1}>
      {EMOJIS.map(e => {
        const active = selected.has(e)
        return (
          <Tooltip key={e} title={active ? 'Odebrat' : 'Přidat'}>
            <Chip
              label={e}
              variant={active ? 'filled' : 'outlined'}
              onClick={() => toggle(e)}
              sx={{ fontSize: 18 }}
            />
          </Tooltip>
        )
      })}
    </Stack>
  )
}