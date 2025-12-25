export function renderAnimalUpdated(args: {
  animalName: string
  url: string
}) {
  const subject = `Dogpoint – změna detailů: ${args.animalName}`
  const text = `Dobrý den,

u zvířete "${args.animalName}" došlo ke změně detailů.

Zobrazit detail:
${args.url}

S pozdravem
tým DOG-POINT
`
  const html = `<p>Dobrý den,</p>
<p>u zvířete <strong>${args.animalName}</strong> došlo ke změně detailů.</p>
<p><a href="${args.url}">Zobrazit detail</a></p>
<p>S pozdravem<br/><strong>tým DOG-POINT</strong></p>`
  return { subject, text, html }
}