export function renderNewPostPublished(args: {
  animalName: string
  postTitle: string
  url: string
}) {
  const subject = `Dogpoint – nový příspěvek: ${args.postTitle}`
  const text = `Dobrý den,

u zvířete "${args.animalName}" byl publikován nový příspěvek:
"${args.postTitle}"

Zobrazit:
${args.url}

S pozdravem
tým DOG-POINT
`
  const html = `<p>Dobrý den,</p>
<p>u zvířete <strong>${args.animalName}</strong> byl publikován nový příspěvek:</p>
<p><strong>${args.postTitle}</strong></p>
<p><a href="${args.url}">Zobrazit příspěvky</a></p>
<p>S pozdravem<br/><strong>tým DOG-POINT</strong></p>`
  return { subject, text, html }
}