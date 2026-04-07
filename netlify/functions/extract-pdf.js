const Anthropic = require('@anthropic-ai/sdk')

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const { base64, type, prompt: customPrompt } = JSON.parse(event.body)

    let prompt = customPrompt

    if (!prompt) {
      prompt = type === 'invoice'
        ? `Tu es un expert en comptabilité. Analyse cette facture PDF et extrait les informations suivantes en JSON uniquement, sans texte avant ou après :
{
  "invoice_number": "numéro de facture ou null",
  "situation_number": "numéro de situation ou null (nombre entier)",
  "amount_ht": "montant hors taxes en nombre décimal ou null",
  "amount_ttc": "montant toutes taxes comprises en nombre décimal ou null",
  "invoice_date": "date au format YYYY-MM-DD ou null",
  "company_name": "nom de l'entreprise émettrice ou null"
}
Réponds UNIQUEMENT avec le JSON, rien d'autre.`
        : type === 'insurance'
        ? `Tu es un expert en assurance construction. Analyse cette attestation d'assurance PDF et extrait les informations suivantes en JSON uniquement, sans texte avant ou après :
{
  "type": "type d'assurance : decennale, rc_pro ou autre",
  "insurer": "nom de l'assureur ou null",
  "policy_number": "numéro de police ou null",
  "activities_covered": "activités couvertes ou null",
  "start_date": "date de début au format YYYY-MM-DD ou null",
  "end_date": "date de fin ou échéance au format YYYY-MM-DD ou null"
}
Réponds UNIQUEMENT avec le JSON, rien d'autre.`
        : `Analyse ce document et extrait les informations pertinentes en JSON.`
    }

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
