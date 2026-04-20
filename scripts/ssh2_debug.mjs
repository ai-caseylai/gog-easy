import http from 'node:http'
import { WebSocket } from 'ws'

function post(path, body, cookie) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 3002,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cookie ? { Cookie: cookie } : {}),
        },
      },
      (res) => {
        const chunks = []
        res.on('data', (d) => chunks.push(d))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          resolve({ status: res.statusCode, headers: res.headers, text })
        })
      },
    )
    req.on('error', reject)
    req.write(JSON.stringify(body))
    req.end()
  })
}

const vmId = process.env.VM_ID || 'a0881882-840b-4c10-a435-8e6ee761d3c7'
const username = process.env.SSH_USER || 'root'
const password = process.env.SSH_PASS || 'wrong'

const loginEmail = process.env.ADMIN_EMAIL || 'superadmin@example.com'
const loginPassword = process.env.ADMIN_PASSWORD || 'admin123'

const login = await post('/api/admin/auth/login', { email: loginEmail, password: loginPassword })
const setCookie = login.headers['set-cookie']?.[0] || ''
const cookie = setCookie.split(';')[0]
console.log('login', login.status, cookie ? 'cookie-ok' : 'no-cookie')

const sync = await post(
  `/api/admin/vms/${encodeURIComponent(vmId)}/sync`,
  {
    vm: {
      id: vmId,
      name: 'openClaw#3 for Casey',
      provider: 'vmi3189491',
      ip_address: '167.86.107.166',
      status: 'running',
      tags: [],
      notes: '',
    },
  },
  cookie,
)
console.log('sync', sync.status)

const sess = await post('/api/admin/ssh/sessions', { vmId, username, password, ssh2Debug: true }, cookie)
console.log('session', sess.status, sess.text)

if (sess.status !== 200) process.exit(1)
const sid = JSON.parse(sess.text).sessionId

const ws = new WebSocket(`ws://127.0.0.1:3002/ws/admin/ssh?sid=${encodeURIComponent(sid)}`, {
  headers: { Cookie: cookie },
  perMessageDeflate: true,
})
ws.on('open', () => console.log('ws open', 'extensions=', ws.extensions || '(none)'))
ws.on('message', (data) => console.log('ws msg', data.toString()))
ws.on('close', (code, reason) => console.log('ws close', code, reason.toString()))
ws.on('error', (e) => console.log('ws error', e?.message))

setTimeout(() => {
  try {
    ws.close()
  } catch {
    void 0
  }
}, 5000)
