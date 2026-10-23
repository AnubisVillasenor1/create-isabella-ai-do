'use client'

import { FormEvent, KeyboardEvent, useMemo, useState } from 'react'
import { Activity, ArrowUpRight, BookOpen, Check, ChevronRight, Copy, FileText, Gauge, GitBranch, Library, Plus, Search, ShieldCheck, Upload, Volume2, X } from 'lucide-react'

type Role = 'isabella' | 'user'
type Message = { role: Role; text: string; evidence?: string[] }
type Panel = 'chat' | 'studio' | 'evidence' | 'governance'

const starters = ['Investigar un tema', 'Redactar un documento', 'Analizar un problema', 'Crear un plan']
const systems = [
  { id: 'knowledge', label: 'Knowledge Graph', value: '12,482', meta: 'entidades indexadas', icon: GitBranch },
  { id: 'evidence', label: 'Evidence Ledger', value: '100%', meta: 'trazas firmadas', icon: BookOpen },
  { id: 'policy', label: 'Policy Engine', value: 'HUMAN', meta: 'gated authority', icon: ShieldCheck },
  { id: 'runtime', label: 'Runtime', value: 'ONLINE', meta: 'latencia 184ms', icon: Activity },
]

export default function Page() {
  const [panel, setPanel] = useState<Panel>('chat')
  const [messages, setMessages] = useState<Message[]>([{ role: 'isabella', text: 'Estoy aquí. Puedes investigar, redactar, analizar o planificar. Cada respuesta conserva contexto, supuestos y una cadena de evidencia revisable.', evidence: ['identity:isabella-v6', 'policy:human-gated'] }])
  const [prompt, setPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [files, setFiles] = useState<string[]>([])
  const [notice, setNotice] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')

  const evidenceCount = useMemo(() => messages.reduce((sum, message) => sum + (message.evidence?.length ?? 0), 0), [messages])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const value = prompt.trim()
    if (!value || isLoading) return
    const next = [...messages, { role: 'user' as const, text: value }]
    setMessages(next); setPrompt(''); setError(''); setIsLoading(true)
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: next.map((message) => ({ role: message.role === 'isabella' ? 'assistant' : 'user', content: message.text })), context: { files, workspace: 'GENESIS V6' } }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setMessages((current) => [...current, { role: 'isabella', text: data.text, evidence: ['query:session-context', 'model:gateway', 'policy:human-gated'] }])
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'No se pudo conectar con Isabella.') } finally { setIsLoading(false) }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); event.currentTarget.form?.requestSubmit() }
  }

  function addFile(event: React.ChangeEvent<HTMLInputElement>) {
    const names = Array.from(event.target.files ?? []).map((file) => file.name)
    setFiles((current) => [...new Set([...current, ...names])]); setNotice(names.length ? `${names.length} recurso(s) añadido(s) al contexto.` : '')
  }

  function exportSession() {
    const body = messages.map((message) => `## ${message.role === 'isabella' ? 'Isabella' : 'Tú'}\n\n${message.text}\n\nEvidencia: ${message.evidence?.join(', ') ?? 'pendiente'}`).join('\n\n')
    const url = URL.createObjectURL(new Blob([`# Sesión Isabella Genesis V6\n\n${body}`], { type: 'text/markdown' })); const link = document.createElement('a'); link.href = url; link.download = 'isabella-session.md'; document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 0); setNotice('Sesión exportada como Markdown.')
  }

  return <main className="isabella-app">
    <div className="grain" aria-hidden="true" />
    <nav className="topbar"><a className="wordmark" href="#top">ISABELLA<span>/GENESIS</span></a><span className="workspace-name">V6 / TERMINUS Ω</span><div className="nav-links">{(['chat','studio','evidence','governance'] as Panel[]).map((item) => <button key={item} className={panel === item ? 'nav-active' : ''} onClick={() => setPanel(item)}>{item === 'evidence' ? 'Evidence' : item[0].toUpperCase() + item.slice(1)}</button>)}</div><div className="topbar-actions"><button className="search" onClick={() => setSearchOpen(true)}><Search size={14} /> Buscar <kbd>⌘ K</kbd></button><button className="new-chat" onClick={() => { setMessages([{ role: 'isabella', text: 'Sesión nueva iniciada. El contexto está limpio y listo.' }]); setPanel('chat') }}><Plus size={15} /> Nuevo chat</button><span className="status"><i /> NODO ACTIVO</span></div></nav>
    <div className="context-bar"><span className="context-dot" /> WORKSPACE <strong>GENESIS V6</strong><span className="divider">/</span> SESSION · ACTIVE <div className="capabilities"><span className="active">TEXT</span><span>LOCAL FILES</span><span>VOICE</span></div></div>
    <section className="hero" id="top"><div className="hero-copy"><div className="eyebrow">TINA · INTELIGENCIA SOBERANA LATINOAMERICANA <span>GENESIS V6 / TERMINUS Ω</span></div><div className="hero-title"><span>01</span><h1>Intelligence<br /><em>with memory.</em></h1></div><p>Una infraestructura cognitiva para convertir datos dispersos en conocimiento verificable, decisiones auditables y trabajo científico reutilizable.</p><div className="hero-actions"><button className="primary" onClick={() => { setPanel('chat'); document.getElementById('workspace')?.scrollIntoView({ behavior: 'smooth' }) }}>ABRIR CHAT <ArrowUpRight size={16} /></button><button className="text-link" onClick={() => setPanel('studio')}>ABRIR STUDIO</button></div><div className="system-board"><div><small>RUNTIME</small><b>OBSERVABLE</b><span>salud y estado del nodo</span></div><div><small>GOBERNANZA</small><b>HUMAN-GATED</b><span>autoridad separada de capacidad</span></div><div><small>EVIDENCIA</small><b>BOOKPI</b><span>trazabilidad de decisiones</span></div></div></div><div className="orbital"><div className="orbit orbit-a" /><div className="orbit orbit-b" /><div className="core"><span>IS</span><small>GENESIS<br />V6</small></div><div className="signal signal-one">CONTEXTO<br /><b>DE SESIÓN</b></div><div className="signal signal-two">RUNTIME<br /><b>OBSERVABLE</b></div><div className="orbital-caption">CORE / IDENTITY <b>V6</b></div></div></section>
    <section className="workspace" id="workspace"><div className="workspace-head"><div><div className="eyebrow">CONTROL PLANE <span>FEDERATED / TRACEABLE</span></div><h2>{panel === 'chat' ? 'Habla con Isabella' : panel === 'studio' ? 'Studio de trabajo' : panel === 'evidence' ? 'Ledger de evidencia' : 'Gobernanza institucional'}</h2></div><div className="workspace-actions"><button onClick={exportSession}><Copy size={14} /> Exportar</button><button onClick={() => setMessages([{ role: 'isabella', text: 'Sesión reiniciada. Estoy aquí para ayudarte.' }])}>Reiniciar</button></div></div>
      <div className="system-metrics">{systems.map(({ id, label, value, meta, icon: Icon }) => <button key={id} onClick={() => id === 'evidence' ? setPanel('evidence') : id === 'policy' ? setPanel('governance') : undefined}><Icon size={15} /><span><small>{label}</small><b>{value}</b><em>{meta}</em></span></button>)}</div>
      {panel === 'chat' && <><div className="messages" aria-live="polite">{messages.map((message, index) => <article key={index} className={`message ${message.role}`}><span className="avatar">{message.role === 'isabella' ? 'IS' : 'TÚ'}</span><div><span className="speaker">{message.role === 'isabella' ? 'ISABELLA · AHORA' : 'TÚ · AHORA'}</span><p>{message.text}</p>{message.evidence && <div className="evidence-tags">{message.evidence.map((tag) => <span key={tag}><Check size={11} /> {tag}</span>)}</div>}</div></article>)}</div><div className="prompt-starters"><span>EMPEZAR CON</span>{starters.map((starter) => <button key={starter} onClick={() => setPrompt(`${starter}: `)}>{starter}</button>)}</div><form className="prompt-box" onSubmit={submit}><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={handleKeyDown} placeholder={isLoading ? 'Isabella está pensando…' : 'Escribe a Isabella…'} aria-label="Mensaje para Isabella" rows={2} disabled={isLoading} /><div className="prompt-tools"><label title="Añadir archivos"><Upload size={16} /><input type="file" multiple onChange={addFile} /></label><button type="button" onClick={() => window.speechSynthesis?.speak(new SpeechSynthesisUtterance(messages.at(-1)?.text || 'Estoy aquí.'))}><Volume2 size={15} /></button><button className="send" type="submit" disabled={isLoading || !prompt.trim()}>{isLoading ? '…' : 'ENVIAR'} <ArrowUpRight size={15} /></button></div></form>{files.length > 0 && <div className="file-strip"><FileText size={14} /> {files.map((file) => <span key={file}>{file} <button onClick={() => setFiles(files.filter((item) => item !== file))}><X size={11} /></button></span>)}</div>}{error && <p className="error">{error}</p>}</>}
      {panel === 'studio' && <div className="panel-grid"><article><Library size={20} /><h3>Artefactos revisables</h3><p>Convierte las respuestas de Isabella en documentos, hipótesis, planes y entregables con contexto conservado.</p><button onClick={exportSession}>Exportar sesión <ChevronRight size={14} /></button></article><article><Upload size={20} /><h3>Contexto local</h3><p>Incorpora documentos al workspace para que el análisis respete tu fuente, licencia y alcance.</p><label className="dropzone">Seleccionar archivos<input type="file" multiple onChange={addFile} /></label></article></div>}
      {panel === 'evidence' && <div className="ledger"><div className="ledger-summary"><Gauge size={22} /><div><b>{evidenceCount} eventos trazables</b><span>Cadena de evidencia activa para esta sesión</span></div></div>{messages.flatMap((message, index) => (message.evidence ?? []).map((item) => <div className="ledger-row" key={`${index}-${item}`}><Check size={14} /><span><b>{item}</b><small>Sesión Genesis V6 · validación automática</small></span><code>VERIFIED</code></div>))}</div>}
      {panel === 'governance' && <div className="governance-panel"><ShieldCheck size={26} /><div><h3>Autoridad humana separada</h3><p>Isabella puede sugerir, sintetizar y preparar acciones. Las decisiones sensibles, publicación y efectos externos requieren revisión y aprobación humana.</p><div className="policy-list"><span><Check size={13} /> Procedencia obligatoria</span><span><Check size={13} /> Licencia y finalidad visibles</span><span><Check size={13} /> Revocación y auditoría</span><span><Check size={13} /> Sin ejecución autónoma sensible</span></div></div></div>}
    </section>
    <section className="lower-grid"><article><div className="eyebrow">ISA-FLOW</div><h2>Del dato a la <em>evidencia.</em></h2><p>Descubrimiento, metadatos FAIR+, grafo semántico, agente gobernado y decisión humana en una cadena reproducible.</p></article><article><div className="eyebrow">FEDERATED NODES</div><h2>Más abierto. <em>Más soberano.</em></h2><p>Conecta instituciones sin perder custodia, permisos, procedencia ni capacidad de revocación.</p></article><article><div className="eyebrow">OPEN SCIENCE</div><h2>Construir con <em>responsabilidad.</em></h2><p>Interoperabilidad, preservación y auditoría como infraestructura crítica del conocimiento.</p></article></section>
    <footer><span>HUMILDAD · RESILIENCIA · PROPÓSITO</span><span>ISABELLA VILLASEÑOR AI · GENESIS V6</span></footer>
    {notice && <button className="toast" onClick={() => setNotice('')}>{notice} <X size={13} /></button>}
    {searchOpen && <div className="search-modal" role="dialog" aria-modal="true"><div><button className="close" onClick={() => setSearchOpen(false)}><X size={16} /></button><Search size={18} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en Isabella…" /><p>{query ? `Buscar en conocimiento, evidencia y sesiones: “${query}”` : 'Busca en tu workspace federado.'}</p></div></div>}
  </main>
}
