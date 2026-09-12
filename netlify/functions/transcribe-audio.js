exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const { base64, mimeType } = JSON.parse(event.body)

    const audioBuffer = Buffer.from(base64, 'base64')
    const extension = mimeType && mimeType.includes('mp4') ? 'mp4' : 'webm'
    const audioBlob = new Blob([audioBuffer], { type: mimeType || 'audio/webm' })

    const form = new FormData()
    form.append('file', audioBlob, 'visite.' + extension)
    form.append('model', 'whisper-1')
    form.append('language', 'fr')

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY },
      body: form,
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error('Erreur OpenAI (' + response.status + ') : ' + errText)
    }

    const data = await response.json()

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: data.text || '' })
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    }
  }
}
