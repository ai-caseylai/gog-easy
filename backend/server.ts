/**
 * local server entry file, for local development
 */
import app from './app.js';
import { WebSocketServer, WebSocket } from 'ws'
import { Client, type ClientChannel } from 'ssh2'
import type { IncomingMessage } from 'http'
import http from 'node:http'
import net from 'node:net'
import { adminCookieName, verifyAdminSession } from './lib/adminSession.js'
import { deleteAdminSshSession, deleteAdminVncSession, getAdminSshSession, getAdminVncSession } from './lib/adminSshSessions.js'

/**
 * start server with port
 */
const PORT = Number(process.env.PORT || 3001)

const server = http.createServer(app)

server.on('error', (err) => {
  const e = err as NodeJS.ErrnoException
  console.log(`Server error: ${String(e.code || e.message || 'UNKNOWN')}`)
})

server.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`)
})

const wss = new WebSocketServer({ server, path: '/ws/admin/ssh', perMessageDeflate: false })
const vncWss = new WebSocketServer({ server, path: '/ws/admin/vnc', perMessageDeflate: false })

const sshAlgorithms = {
  kex: ['curve25519-sha256', 'curve25519-sha256@libssh.org', 'diffie-hellman-group14-sha256'],
  serverHostKey: ['ssh-ed25519', 'rsa-sha2-512', 'rsa-sha2-256'],
  cipher: ['chacha20-poly1305@openssh.com', 'aes128-ctr', 'aes256-ctr', 'aes128-gcm@openssh.com', 'aes256-gcm@openssh.com'],
  hmac: ['hmac-sha2-256-etm@openssh.com', 'hmac-sha2-512-etm@openssh.com', 'hmac-sha2-256', 'hmac-sha2-512'],
  compress: ['none', 'zlib@openssh.com', 'zlib'],
} as const

const activeSsh = new Set<Client>()
const activeVncSockets = new Set<net.Socket>()

wss.on('error', () => {
  void 0
})

vncWss.on('error', () => {
  void 0
})

let shuttingDown = false

function shutdown(signal: string) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`${signal} signal received`)

  const hardExit = setTimeout(() => {
    try {
      process.exit(0)
    } catch {
      void 0
    }
  }, 1200)
  try {
    hardExit.unref()
  } catch {
    void 0
  }
  try {
    wss.close()
  } catch {
    void 0
  }
  try {
    vncWss.close()
  } catch {
    void 0
  }
  try {
    for (const c of wss.clients) c.terminate()
  } catch {
    void 0
  }
  try {
    for (const c of vncWss.clients) c.terminate()
  } catch {
    void 0
  }

  try {
    for (const ssh of activeSsh) {
      try {
        ssh.end()
      } catch {
        void 0
      }
    }
  } catch {
    void 0
  }

  try {
    for (const sock of activeVncSockets) {
      try {
        sock.destroy()
      } catch {
        void 0
      }
    }
  } catch {
    void 0
  }
  try {
    ;(server as any).closeAllConnections?.()
  } catch {
    void 0
  }
  try {
    ;(server as any).closeIdleConnections?.()
  } catch {
    void 0
  }
  server.close(() => {
    console.log('Server closed')
    try {
      clearTimeout(hardExit)
    } catch {
      void 0
    }
    process.exit(0)
  })
}

function wsClose(ws: WebSocket, code?: number, reason?: string) {
  try {
    ws.close(code, reason)
  } catch {
    void 0
  }
}

function wsSafeSend(ws: WebSocket, payload: unknown) {
  if (ws.readyState !== WebSocket.OPEN) return
  try {
    ws.send(JSON.stringify(payload), { compress: false })
  } catch {
    void 0
  }
}

function wsSafeClose(ws: WebSocket, code?: number, reason?: string) {
  try {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CLOSING) {
      ws.close(code, reason)
    }
  } catch {
    void 0
  }
}

function parseCookieHeader(header: string | undefined): Record<string, string> {
  if (!header) return {}
  const out: Record<string, string> = {}
  const parts = header.split(';')
  for (const p of parts) {
    const idx = p.indexOf('=')
    if (idx === -1) continue
    const k = p.slice(0, idx).trim()
    const v = p.slice(idx + 1).trim()
    if (!k) continue
    out[k] = decodeURIComponent(v)
  }
  return out
}

wss.on('connection', (ws, req: IncomingMessage) => {
  try {
    const cookies = parseCookieHeader(req.headers.cookie)
    const token = String(cookies[adminCookieName()] || '')
    const admin = token ? verifyAdminSession(token) : null
    if (!admin) {
      wsClose(ws, 1008, 'ADMIN_UNAUTHENTICATED')
      return
    }

    const url = new URL(req.url || '/', 'http://localhost')
    const sid = url.searchParams.get('sid') || ''
    const sess = sid ? getAdminSshSession(sid) : null
    if (!sess || sess.actorEmail !== admin.email) {
      wsClose(ws, 1008, 'SSH_SESSION_INVALID')
      return
    }
    deleteAdminSshSession(sid)

    console.log(`[admin-ssh] ws connected email=${admin.email} vmId=${sess.vmId} host=${sess.host}:${sess.port}`)

    ws.on('close', (code, reason) => {
      const r = Buffer.isBuffer(reason) ? reason.toString('utf8') : String(reason || '')
      console.log(`[admin-ssh] ws close email=${admin.email} vmId=${sess.vmId} code=${code} reason=${r}`)
    })

    ws.on('error', (err) => {
      const detail = String((err as Error | undefined)?.message || 'ws error')
      console.log(`[admin-ssh] ws error email=${admin.email} vmId=${sess.vmId} detail=${detail}`)
    })

    wsSafeSend(ws, { type: 'status', status: 'ws_connected' })

    const ssh = new Client()
    activeSsh.add(ssh)
    let stream: ClientChannel | null = null
    let closed = false
    let shellReady = false

    const closeAll = (code?: number, reason?: string) => {
      if (closed) return
      closed = true
      try {
        if (stream) stream.end()
      } catch {
        void 0
      }
      try {
        ssh.end()
      } catch {
        void 0
      }
      try {
        activeSsh.delete(ssh)
      } catch {
        void 0
      }
      wsSafeSend(ws, { type: 'status', status: 'closing', code: code ?? null, reason: reason ?? null })
      setTimeout(() => wsSafeClose(ws, code, reason), 50)
    }

    ws.on('close', () => closeAll())
    ws.on('error', () => closeAll())

    ws.on('message', (raw) => {
      if (!stream) return
      const s = typeof raw === 'string' ? raw : Buffer.isBuffer(raw) ? raw.toString('utf8') : ''
      if (!s) return
      try {
        const msg = JSON.parse(s) as { type?: unknown; data?: unknown; cols?: unknown; rows?: unknown }
        if (msg.type === 'data' && typeof msg.data === 'string') {
          stream.write(msg.data)
          return
        }
        if (msg.type === 'resize') {
          const cols = typeof msg.cols === 'number' ? msg.cols : null
          const rows = typeof msg.rows === 'number' ? msg.rows : null
          if (cols && rows && typeof stream.setWindow === 'function') {
            stream.setWindow(rows, cols, rows * 14, cols * 7)
          }
        }
      } catch {
        stream.write(s)
      }
    })

    ssh.on('ready', () => {
      console.log(`[admin-ssh] ready email=${admin.email} vmId=${sess.vmId} host=${sess.host}:${sess.port}`)
      wsSafeSend(ws, { type: 'status', status: 'ssh_ready' })
      ssh.shell({ term: 'xterm-256color', cols: 100, rows: 28 }, (err, s) => {
        if (err || !s) {
          const detail = err instanceof Error ? err.message : 'shell failed'
          wsSafeSend(ws, { type: 'error', error: 'SSH_SHELL_FAILED', detail })
          setTimeout(() => closeAll(1011, 'SSH_SHELL_FAILED'), 500)
          return
        }
        stream = s
        shellReady = true
        wsSafeSend(ws, { type: 'status', status: 'shell_ready' })
        stream.on('data', (d: Buffer) => {
          try {
            ws.send(JSON.stringify({ type: 'data', data: d.toString('utf8') }), { compress: false })
          } catch {
            closeAll(1011, 'WS_SEND_FAILED')
          }
        })
        stream.on('close', () => {
          console.log(`[admin-ssh] shell closed email=${admin.email} vmId=${sess.vmId}`)
          closeAll(1000, 'SHELL_CLOSED')
        })
      })
    })

    ssh.on('keyboard-interactive', (_name, _instructions, _lang, prompts, finish) => {
      const auth = sess.auth
      if (auth.type !== 'password') {
        finish([])
        return
      }
      const answers = prompts.map(() => auth.password)
      finish(answers)
    })

    ssh.on('error', (err) => {
      const e = err as NodeJS.ErrnoException
      const detail = String(e?.message || 'ssh error')
      const code = String((e as any)?.code || '')
      const level = String((e as any)?.level || '')
      console.log(`[admin-ssh] error email=${admin.email} vmId=${sess.vmId} detail=${detail} code=${code} level=${level}`)
      wsSafeSend(ws, { type: 'error', error: 'SSH_CONNECT_FAILED', detail: `${detail}${code ? ` (code=${code})` : ''}${level ? ` (level=${level})` : ''}` })
      setTimeout(() => closeAll(1011, 'SSH_CONNECT_FAILED'), 500)
    })
    ssh.on('end', () => closeAll(1000, 'SSH_ENDED'))
    ssh.on('close', () => {
      if (!shellReady) {
        wsSafeSend(ws, { type: 'error', error: 'SSH_CLOSED', detail: 'SSH closed before shell ready' })
        setTimeout(() => closeAll(1011, 'SSH_CLOSED'), 500)
        return
      }
      closeAll(1000, 'SSH_CLOSED')
    })

    if (sess.auth.type === 'password') {
      console.log(`[admin-ssh] connect auth=password user=${sess.auth.username} pwLen=${sess.auth.password.length}`)
      ssh.connect({
        host: sess.host,
        port: sess.port,
        username: sess.auth.username,
        password: sess.auth.password,
        tryKeyboard: true,
        ident: 'OpenSSH_8.6',
        algorithms: sshAlgorithms,
        debug: sess.debug ? (s) => console.log(`[admin-ssh2] ${s}`) : undefined,
        readyTimeout: 20_000,
        keepaliveInterval: 15_000,
        keepaliveCountMax: 2,
      })
      return
    }

    console.log(`[admin-ssh] connect auth=privateKey user=${sess.auth.username} keyLen=${sess.auth.privateKeyPem.length}`)
    ssh.connect({
      host: sess.host,
      port: sess.port,
      username: sess.auth.username,
      privateKey: sess.auth.privateKeyPem,
      passphrase: sess.auth.passphrase,
      ident: 'OpenSSH_8.6',
      algorithms: sshAlgorithms,
      debug: sess.debug ? (s) => console.log(`[admin-ssh2] ${s}`) : undefined,
      readyTimeout: 20_000,
      keepaliveInterval: 15_000,
      keepaliveCountMax: 2,
    })
  } catch {
    wsClose(ws)
  }
})

vncWss.on('connection', (ws, req: IncomingMessage) => {
  try {
    const cookies = parseCookieHeader(req.headers.cookie)
    const token = String(cookies[adminCookieName()] || '')
    const admin = token ? verifyAdminSession(token) : null
    if (!admin) {
      wsClose(ws)
      return
    }

    const url = new URL(req.url || '/', 'http://localhost')
    const sid = url.searchParams.get('sid') || ''
    const sess = sid ? getAdminVncSession(sid) : null
    if (!sess || sess.actorEmail !== admin.email) {
      wsClose(ws)
      return
    }
    deleteAdminVncSession(sid)

    ws.on('error', () => {
      try {
        ws.close()
      } catch {
        void 0
      }
    })

    const socket = net.connect({ host: sess.host, port: sess.port })
    activeVncSockets.add(socket)
    socket.on('error', () => {
      try {
        ws.send(JSON.stringify({ type: 'error', error: 'VNC_CONNECT_FAILED' }))
      } catch {
        void 0
      }
      try {
        ws.close()
      } catch {
        void 0
      }
    })

    ws.on('close', () => {
      try {
        socket.end()
      } catch {
        void 0
      }
      try {
        activeVncSockets.delete(socket)
      } catch {
        void 0
      }
    })

    ws.on('message', (data) => {
      if (typeof data === 'string') {
        try {
          const msg = JSON.parse(data) as { type?: unknown }
          if (msg.type === 'password') {
            try {
              ws.send(JSON.stringify({ type: 'password', password: sess.password }))
            } catch {
              void 0
            }
          }
        } catch {
          void 0
        }
        return
      }
      if (Buffer.isBuffer(data)) {
        socket.write(data)
      }
    })

    socket.on('data', (chunk) => {
      try {
        ws.send(chunk)
      } catch {
        try {
          ws.close()
        } catch {
          void 0
        }
      }
    })

    socket.on('close', () => {
      try {
        ws.close()
      } catch {
        void 0
      }
      try {
        activeVncSockets.delete(socket)
      } catch {
        void 0
      }
    })
  } catch {
    wsClose(ws)
  }
})

/**
 * close server
 */
process.on('SIGTERM', () => {
  shutdown('SIGTERM')
});

process.on('SIGINT', () => {
  shutdown('SIGINT')
});

process.on('SIGUSR2', () => {
  shutdown('SIGUSR2')
})

export default app;
