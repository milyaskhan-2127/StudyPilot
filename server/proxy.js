async function readBody(req) {
  if (req.body !== undefined) return typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {})
  let body = ''
  for await (const chunk of req) {
    body += chunk.toString()
    if (body.length > 20000) break
  }
  return body
}

export async function proxyRequest(req, res, { method, url, auth, timeoutMs = 20000 }) {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== method) {
    res.setHeader('Allow', method)
    res.statusCode = 405
    return res.end(JSON.stringify({ error: 'Method not allowed' }))
  }
  if (!url) {
    res.statusCode = 503
    return res.end(JSON.stringify({ error: 'The n8n endpoint is not configured.' }))
  }
  let destination
  try {
    destination = new URL(url)
    if (destination.protocol !== 'https:') throw new Error('Invalid endpoint')
  } catch {
    res.statusCode = 503
    return res.end(JSON.stringify({ error: 'The n8n endpoint configuration is invalid.' }))
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const headers = { Accept: 'application/json' }
    if (method === 'POST') headers['Content-Type'] = 'application/json'
    if (auth) headers.Authorization = auth
    let body
    if (method === 'POST') {
      body = await readBody(req)
      if (body.length > 20000) {
        res.statusCode = 413
        return res.end(JSON.stringify({ error: 'Message is too large.' }))
      }
    }
    const upstream = await fetch(destination, { method, headers, body, signal: controller.signal, cache: 'no-store' })
    const content = await upstream.text()
    res.statusCode = upstream.status
    res.setHeader('Content-Type', upstream.headers.get('content-type')?.includes('application/json') ? 'application/json' : 'text/plain; charset=utf-8')
    return res.end(content)
  } catch (error) {
    res.statusCode = error.name === 'AbortError' ? 504 : 502
    return res.end(JSON.stringify({ error: error.name === 'AbortError' ? 'The n8n request timed out.' : 'Could not reach n8n. Please try again.' }))
  } finally {
    clearTimeout(timeout)
  }
}
