import { proxyRequest } from '../server/proxy.js'

export default function handler(req, res) {
  return proxyRequest(req, res, {
    method: 'POST',
    url: process.env.N8N_CHAT_URL || 'https://ilyaskhan21.app.n8n.cloud/webhook/fcbeace2-d141-4218-a6aa-ffda9f05ed6f/chat',
    auth: process.env.N8N_CHAT_AUTH_HEADER,
  })
}
