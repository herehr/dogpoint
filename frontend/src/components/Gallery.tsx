import React from 'react'

interface GalleryProps {
  media: string[]
}

const Gallery: React.FC<GalleryProps> = ({ media }) => {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
      {media.map((src, index) => (
        <img key={index} src={src} alt={`media-${index}`} style={{ maxWidth: '100%', maxHeight: '300px' }} />
      ))}
    </div>
  )
}

export default Gallery