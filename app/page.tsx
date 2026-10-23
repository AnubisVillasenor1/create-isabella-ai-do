'use client'

import { FormEvent, useState } from 'react'
import { ArrowUpRight, ChevronDown, Command, Copy, Mic, Plus, Sparkles, Terminal, Upload, Volume2 } from 'lucide-react'

type Message = { role: 'isabella' | 'user'; text: string }

const starters = ['Investigar un tema', 'Redactar un documento', 'Analizar un problema', 'Crear un plan']

export default function Page() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'isabella', text: 'Estoy aquí. Puedes escribirme para investigar, crear, analizar o planificar con contexto y trazabilidad.' },
  ])
  const [prompt, setPrompt] = useState('')
  const [activeStarter, setActiveStarter] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    const value = prompt.trim()
    if (!value) return
    setMessages((current) => [...current, { role: 'user', text: value }, { role: 'isabella', text: 'Recibido. Voy a estructurar la respuesta con supuestos, evidencia necesaria y próximos pasos verificables.' }])
    setPrompt('')
  }

  function chooseStarter(label: string) {
    setActiveStarter(label)
    setPrompt(`${label}: `)
  }

  return (
    <main className="isabella-app">
      <div className="grain" aria-hidden="true" />
      <nav className="topbar">
        <a className="wordmark" href="#top">ISABELLA<span>/GENESIS</span></a>
        <span className="workspace-name">V6 / TERMINUS Ω</span>
        <div className="nav-links"><a href="#chat">Chat</a><a href="#studio">Studio</a><a href="#tools">Tools</a><a href="#governance">Governance</a></div>
        <div className="topbar-actions"><button className="search"><Command size={14} /> Buscar <kbd>⌘ K</kbd></button><button className="new-chat"><Plus size={15} /> Nuevo chat</button><span className="status"><i /> NODO ACTIVO</span></div>
      </nav>

      <div className="context-bar"><span className="context-dot" /> WORKSPACE <strong>GENESIS V6</strong><span className="divider">/</span> SESSION · ACTIVE <div className="capabilities"><span className="active">TEXT</span><span>LOCAL FILES</span><span>VOICE</span></div></div>

      <section className="hero" id="top">
        <div className="hero-copy"><div className="eyebrow">TINA · INTELIGENCIA SOBERANA LATINOAMERICANA <span>GENESIS V6 / TERMINUS Ω</span></div><div className="hero-title"><span>01</span><h1>Intelligence<br /><em>with memory.</em></h1></div><p>Un workspace de IA orientado a trabajo real: conversación, contexto, artefactos, herramientas y gobernanza en una sola superficie.</p><div className="hero-actions"><a className="primary" href="#chat">ABRIR CHAT <ArrowUpRight size={16} /></a><a href="#studio" className="text-link">ABRIR STUDIO</a></div><div className="system-board"><div><small>RUNTIME</small><b>OBSERVABLE</b><span>salud y estado del nodo</span></div><div><small>GOBERNANZA</small><b>HUMAN-GATED</b><span>autoridad separada de capacidad</span></div><div><small>EVIDENCIA</small><b>BOOKPI</b><span>trazabilidad de decisiones</span></div></div></div>
        <div className="orbital"><div className="orbit orbit-a" /><div className="orbit orbit-b" /><div className="core"><span>IS</span><small>GENESIS<br />V6</small></div><div className="signal signal-one">CONTEXTO<br /><b>DE SESIÓN</b></div><div className="signal signal-two">RUNTIME<br /><b>OBSERVABLE</b></div><div className="orbital-caption">CORE / IDENTITY <b>V6</b></div></div>
      </section>

      <section className="console" id="chat"><div className="console-head"><div><div className="eyebrow">CONVERSATION WORKSPACE <span>SESSION-BOUNDED</span></div><h2>Habla con Isabella</h2></div><div className="console-actions"><button>Exportar .md</button><button>Reiniciar</button><button className="voice"><Volume2 size={14} /> VOZ NATIVA</button></div></div><div className="messages" aria-live="polite">{messages.map((message, index) => <article key={index} className={`message ${message.role}`}><span className="avatar">{message.role === 'isabella' ? 'IS' : 'TÚ'}</span><div><span className="speaker">{message.role === 'isabella' ? 'ISABELLA · AHORA' : 'TÚ · AHORA'}</span><p>{message.text}</p></div></article>)}</div><div className="prompt-starters"><span>EMPEZAR CON</span>{starters.map((starter) => <button className={activeStarter === starter ? 'selected' : ''} key={starter} onClick={() => chooseStarter(starter)}>{starter}</button>)}</div><form className="prompt-box" onSubmit={submit}><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Escribe a Isabella…" aria-label="Mensaje para Isabella" rows={2} /><div className="prompt-tools"><button type="button" aria-label="Adjuntar archivo"><Upload size={16} /></button><button type="button" aria-label="Usar micrófono"><Mic size={16} /></button><span>ENTER para enviar · SHIFT + ENTER para nueva línea</span><button className="send" type="submit"><ArrowUpRight size={18} /></button></div></form></section>

      <section className="lower-grid"><article id="studio"><div className="eyebrow">DESIGN SURFACE</div><h2>Studio <em>de trabajo.</em></h2><p>Guarda respuestas, explora documentos y convierte contexto en entregables revisables.</p><button className="outline"><Copy size={14} /> ABRIR STUDIO</button></article><article id="tools"><div className="eyebrow">CAPA DE EJECUCIÓN</div><h2>Tools para <em>hacerlo real.</em></h2><p>Investigación, creación y automatización con límites claros y evidencia de cada decisión.</p><button className="outline"><Terminal size={14} /> EXPLORAR TOOLS</button></article><article id="governance"><div className="eyebrow">CROWN · AEGIS · YUN</div><h2>Human-<em>gated.</em></h2><p>La capacidad sugiere. La autoridad se decide. Los efectos sensibles requieren control humano.</p><button className="outline"><Sparkles size={14} /> VER GOBERNANZA</button></article></section>
      <footer><span>HUMILDAD · RESILIENCIA · PROPÓSITO</span><span>ISABELLA VILLASEÑOR AI · GENESIS V6</span></footer>
    </main>
  )
}
