// frontend/src/types/models.ts

export type Media = { url: string; type?: 'image' | 'video' }

export type Animal = {
  id: string
  jmeno: string
  druh?: 'pes' | 'kočka' | 'jiné'
  vek?: string
  popis?: string
  main?: string
  galerie?: Media[]
  active?: boolean
}

export type Adoption = {
  id: string
  animalId: string
  userId: string
  status: 'REQUESTED' | 'APPROVED' | 'PAID' | 'COMPLETED'
  createdAt: string
}

export type Post = {
  id: string
  animalId: string
  authorId: string
  title: string
  body?: string
  media?: Media[]
  createdAt: string
  active?: boolean
}