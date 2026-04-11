export function mustGetEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    throw new Error(`Missing env: ${name}`)
  }
  return v
}

export function getEnv(name: string): string | undefined {
  return process.env[name]
}

export function isProd(): boolean {
  return process.env.NODE_ENV === 'production'
}

