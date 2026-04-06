const Anthropic = require('@anthropic-ai/sdk')

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const { base64, type } = JSON.parse(event.body)

    const prompt = type === 'invoice'
      ? `Tu es un expert en comptabilite. Analyse cette facture PDF et extrait les informations suivantes en JSON uniquement, sans texte avant ou apres :
{
  "invoice_number": "numero de facture ou null",
  "situation_number": "numero de situation ou null (nombre entier)",
  "amount_ht": "montant hors taxes en nombre decimal ou null",
  "amount_ttc": "montant toutes taxes comprises en nombre decimal ou null",
  "invoice_date": "date au format YYYY-MM-DD ou null",
  "company_name": "nom de l entreprise emettrice ou null"
}
Reponds UNIQUEMENT avec le JSON, rien d autre.`
      : `Tu es un expert en assurance construction. Analyse cette attestation d assurance PDF et extrait les informations suivantes en JSON uniquement, sans texte avant ou apres :
{
  "type": "type d assurance : decennale, rc_pro ou autre",
  "insurer": "nom de l assureur ou null",
  "policy_number": "numero de police ou null",
  "activities_covered": "activites couvertes ou null",
  "start_date": "date de debut au format YYYY-MM-DD ou null",
  "end_date": "date de fin ou echeance au format YYYY-MM-DD ou null"
}
Reponds UNIQUEMENT avec le JSON, rien d autre.`

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 }
          },
          { type: 'text', text: prompt }
        ]
      }]
    })

    const text = response.content?.[0]?.text || ''
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed)
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    }
  }
}
