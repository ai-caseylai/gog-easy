declare module '@novnc/novnc/lib/rfb' {
  export type RfbCredentials = { password?: string; username?: string; target?: string }
  export type RfbOptions = { shared?: boolean; credentials?: RfbCredentials }

  export default class RFB extends EventTarget {
    constructor(target: HTMLElement, url: string, options?: RfbOptions)
    scaleViewport: boolean
    resizeSession: boolean
    viewOnly: boolean
    clipboardUp: (text: string) => void
    sendCredentials: (creds: RfbCredentials) => void
    disconnect: () => void
  }
}
