import { proxyRequest } from '../server/proxy.js'

export default function handler(req, res) {
  return proxyRequest(req, res, {
    method: 'GET',
    url: process.env.N8N_ASSIGNMENTS_URL,
    auth: process.env.N8N_ASSIGNMENTS_AUTH_HEADER,
  })
}
