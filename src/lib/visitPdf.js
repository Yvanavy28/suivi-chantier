export async function generateVisitPdf({ projectName, visit, reserves }) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF()
  const marginX = 15
  let y = 20

  doc.setFontSize(16)
  doc.text('Compte-rendu de visite', marginX, y)
  y += 10

  doc.setFontSize(11)
  doc.text('Chantier : ' + (projectName || '-'), marginX, y)
  y += 7
  doc.text('Date : ' + new Date(visit.visit_date).toLocaleDateString('fr-FR'), marginX, y)
  y += 7
  doc.text('Participants : ' + (visit.participants || '-'), marginX, y)
  y += 10

  doc.setFontSize(12)
  doc.text('Observations', marginX, y)
  y += 7
  doc.setFontSize(10)
  const notesLines = doc.splitTextToSize(visit.notes || 'Aucune observation.', 180)
  doc.text(notesLines, marginX, y)
  y += notesLines.length * 5 + 8

  doc.setFontSize(12)
  doc.text('Reserves', marginX, y)
  y += 7
  doc.setFontSize(10)
  if (!reserves || reserves.length === 0) {
    doc.text('Aucune reserve.', marginX, y)
    y += 7
  } else {
    reserves.forEach((r, i) => {
      const statusLabel = r.status === 'resolu' ? '[Resolu]' : '[Ouvert]'
      const lines = doc.splitTextToSize((i + 1) + '. ' + statusLabel + ' ' + r.description, 180)
      if (y > 270) { doc.addPage(); y = 20 }
      doc.text(lines, marginX, y)
      y += lines.length * 5 + 3
    })
  }

  doc.save('visite_' + (visit.visit_date || 'chantier') + '.pdf')
}
