import React, { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

interface TerminalWindowProps {
  instanceId: string
}

export const TerminalWindow: React.FC<TerminalWindowProps> = ({ instanceId }) => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  useEffect(() => {
    if (!terminalRef.current) return

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#aeafad',
        selectionBackground: '#264f78',
        black: '#1e1e1e',
        red: '#f44747',
        green: '#6a9955',
        yellow: '#d7ba7d',
        blue: '#569cd6',
        magenta: '#c586c0',
        cyan: '#4ec9b0',
        white: '#d4d4d4',
        brightBlack: '#808080',
        brightRed: '#f44747',
        brightGreen: '#6a9955',
        brightYellow: '#d7ba7d',
        brightBlue: '#569cd6',
        brightMagenta: '#c586c0',
        brightCyan: '#4ec9b0',
        brightWhite: '#ffffff',
      },
      scrollback: 10000,
      convertEol: false,
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)
    term.open(terminalRef.current)

    requestAnimationFrame(() => {
      fitAddon.fit()
      // Notify main process that terminal is ready
      window.electronAPI.terminal.ready(instanceId)
      // Send initial dimensions
      window.electronAPI.terminal.resize(instanceId, term.cols, term.rows)
    })

    xtermRef.current = term
    fitAddonRef.current = fitAddon

    // Handle user input → send to main process
    const inputDisposable = term.onData((data) => {
      window.electronAPI.terminal.input(instanceId, data)
    })

    // Receive PTY data from main process
    const cleanupData = window.electronAPI.on('terminal:data', (payload: { instanceId: string; data: string }) => {
      if (payload.instanceId === instanceId) {
        term.write(payload.data)
      }
    })

    // Receive scrollback on connect
    const cleanupScrollback = window.electronAPI.on('terminal:scrollback', (payload: { instanceId: string; data: string }) => {
      if (payload.instanceId === instanceId && payload.data) {
        term.write(payload.data)
      }
    })

    // Handle PTY exit
    const cleanupExit = window.electronAPI.on('terminal:exit', (payload: { instanceId: string; exitCode: number }) => {
      if (payload.instanceId === instanceId) {
        term.write(`\r\n\x1b[90m--- Process exited (code: ${payload.exitCode}) ---\x1b[0m\r\n`)
      }
    })

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        if (fitAddonRef.current) {
          fitAddonRef.current.fit()
          if (xtermRef.current) {
            window.electronAPI.terminal.resize(instanceId, xtermRef.current.cols, xtermRef.current.rows)
          }
        }
      })
    })
    resizeObserver.observe(terminalRef.current)

    return () => {
      inputDisposable.dispose()
      cleanupData()
      cleanupScrollback()
      cleanupExit()
      resizeObserver.disconnect()
      term.dispose()
      xtermRef.current = null
      fitAddonRef.current = null
    }
  }, [instanceId])

  return (
    <div
      ref={terminalRef}
      style={{
        width: '100%',
        height: '100vh',
        backgroundColor: '#1e1e1e',
        padding: '4px',
      }}
    />
  )
}
