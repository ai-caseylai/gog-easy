import { Client } from 'ssh2'

const host = process.env.SSH_HOST || '167.86.107.166'
const port = Number(process.env.SSH_PORT || 22)
const username = process.env.SSH_USER || 'root'
const password = process.env.SSH_PASS || 'wrong'

const c = new Client()

c.on('ready', () => {
  console.log('ready')
  c.end()
})

c.on('error', (err) => {
  console.log('error', err?.message, err?.code, err?.level)
})

c.on('close', () => console.log('close'))
c.on('end', () => console.log('end'))

c.connect({
  host,
  port,
  username,
  password,
  tryKeyboard: true,
  ident: 'OpenSSH_8.6',
  algorithms: {
    kex: ['curve25519-sha256', 'curve25519-sha256@libssh.org', 'diffie-hellman-group14-sha256'],
    serverHostKey: ['ssh-ed25519', 'rsa-sha2-512', 'rsa-sha2-256'],
    cipher: ['chacha20-poly1305@openssh.com', 'aes128-ctr', 'aes256-ctr', 'aes128-gcm@openssh.com', 'aes256-gcm@openssh.com'],
    hmac: ['hmac-sha2-256-etm@openssh.com', 'hmac-sha2-512-etm@openssh.com', 'hmac-sha2-256', 'hmac-sha2-512'],
    compress: ['none', 'zlib@openssh.com', 'zlib'],
  },
  debug: (s) => console.log('[ssh2]', s),
  readyTimeout: 20000,
})
