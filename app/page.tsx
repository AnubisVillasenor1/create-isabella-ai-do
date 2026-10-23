'use client'

import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from 'react'
import { Activity, ArrowUpRight, BookOpen, Check, ChevronRight, Copy, FileText, Gauge, GitBranch, Library, Plus, Search, ShieldCheck, Upload, Volume2, X, Wallet } from 'lucide-react'

type Role = 'isabella' | 'user'
type Message = { role: Role; text: string; evidence?: string[] }
type Panel = 'chat' | 'studio' | 'evidence' | 'governance' | 'models' | 'economy'
type HubResource = { id: string; author?: string; downloads?: number; likes?: number; task?: string | null; tags?: string[]; lastModified?: string | null; url: string; gated?: boolean | string; private?: boolean }
type DatasetPreview = { dataset: string; config: string; split: string; totalRows: number | null; sampleCount: number; rows: Record<string, unknown>[]; notice: string }
type LocalModel = { name: string; sizeBytes: number | null; parameters: string | null; quantization: string | null }
type CommerceCatalog = { pricing: { currency: string; referenceMonthlyCents: number; markupBps: number; monthlyCents: number; monthlyDisplay: string; pricingNote: string }; plans: { id: string; name: string; monthlyCents: number | null; currency: string; monetizationEligible: boolean; features: string[]; billingStatus?: string }[]; creatorTiers: { id: string; label: string; creatorPercent: number; platformPercent: number }[]; platformAllocation: { phoenixFundPercent: number; infrastructurePercent: number; daoPercent: number; appliesTo: string }; capabilities: { checkout: boolean; payouts: boolean; persistentFinancialLedger: boolean; stripeConnect: boolean }; notice: string }
type RevenuePreview = { grossCents: number; creatorCents: number; platformCents: number; phoenixFundCents: number; infrastructureCents: number; daoCents: number; creatorBps: number; platformBps: number; eligible: boolean; reason: string; settlementExecuted: boolean; fundsMoved: boolean; trustBoundary: string }

const starters = ['Investigar un tema', 'Redactar un documento', 'Analizar un problema', 'Crear un plan']
const systems = [
  { id: 'knowledge', label: 'Knowledge Graph', value: 'NOT CONNECTED', meta: 'sin índice de conocimiento conectado', icon: GitBranch },
  { id: 'evidence', label: 'Evidence Ledger', value: 'SESSION', meta: 'trazas visuales; no implica firma criptográfica', icon: BookOpen },
  { id: 'policy', label: 'Policy Engine', value: 'HUMAN-GATED', meta: 'efectos sensibles requieren revisión humana', icon: ShieldCheck },
  { id: 'runtime', label: 'Runtime', value: 'UNMEASURED', meta: 'latencia y disponibilidad no medidas en vivo', icon: Activity },
]

export default function Page() {
  const [panel, setPanel] = useState<Panel>('chat')
  const [messages, setMessages] = useState<Message[]>([{ role: 'isabella', text: 'Estoy aquí. Puedes investigar, redactar, analizar o planificar. Cada respuesta conserva contexto, supuestos y una cadena de evidencia revisable.', evidence: ['session:local-context', 'policy:human-review'] }])
  const [prompt, setPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [files, setFiles] = useState<string[]>([])
  const [notice, setNotice] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [chatProvider, setChatProvider] = useState<'gateway' | 'huggingface' | 'ollama'>('gateway')
  const [chatModel, setChatModel] = useState('openai/gpt-oss-120b:fireworks-ai')
  const [resourceType, setResourceType] = useState<'models' | 'datasets' | 'spaces'>('models')
  const [resourceQuery, setResourceQuery] = useState('')
  const [resources, setResources] = useState<HubResource[]>([])
  const [resourceLoading, setResourceLoading] = useState(false)
  const [resourceError, setResourceError] = useState('')
  const [resourceNotice, setResourceNotice] = useState('')
  const [datasetPreview, setDatasetPreview] = useState<DatasetPreview | null>(null)
  const [datasetPreviewLoading, setDatasetPreviewLoading] = useState(false)
  const [ollamaModels, setOllamaModels] = useState<LocalModel[]>([])
  const [ollamaStatus, setOllamaStatus] = useState('No se ha consultado el runtime local.')\n  const [commerceCatalog, setCommerceCatalog] = useState<CommerceCatalog | null>(null)\n  const [commerceError, setCommerceError] = useState('')\n  const [revenueGross, setRevenueGross] = useState('100.00')\n  const [creatorTier, setCreatorTier] = useState<'standard' | 'sovereign' | 'elite'>('sovereign')\n  const [previewStatus, setPreviewStatus] = useState<'active' | 'past_due'>('active')\n  const [revenuePreview, setRevenuePreview] = useState<RevenuePreview | null>(null)\n  const [revenuePreviewLoading, setRevenuePreviewLoading] = useState(false)

  const evidenceCount = useMemo(() => messages.reduce((sum, message) => sum + (message.evidence?.length ?? 0), 0), [messages])

  useEffect(() => {
    if (panel !== 'models') return
    const controller = new AbortController()
    setResourceLoading(true); setResourceError('')
    const params = new URLSearchParams({ type: resourceType, limit: '12', sort: 'downloads' })
    if (resourceQuery.trim()) params.set('q', resourceQuery.trim())
    fetch(`/api/huggingface/discover?${params}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || 'No se pudo consultar Hugging Face'); return data as { resources?: HubResource[]; notice?: string } })
      .then((data) => { setResources(data.resources ?? []); setResourceNotice(data.notice ?? '') })
      .catch((error: unknown) => { if (error instanceof Error && error.name !== 'AbortError') setResourceError(error.message) })
      .finally(() => { if (!controller.signal.aborted) setResourceLoading(false) })
    return () => controller.abort()
  }, [panel, resourceType, resourceQuery])

  useEffect(() => {
    if (panel !== 'economy' || commerceCatalog) return
    const controller = new AbortController()
    setCommerceError('')
    fetch('/api/commerce/catalog', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || 'No se pudo cargar el catálogo comercial'); return data as CommerceCatalog })
      .then(setCommerceCatalog)
      .catch((error: unknown) => { if (error instanceof Error && error.name !== 'AbortError') setCommerceError(error.message) })
    return () => controller.abort()
  }, [panel, commerceCatalog])

  async function previewCreatorRevenue() {
    setRevenuePreviewLoading(true); setCommerceError('')
    try {
      const amount = Number(revenueGross)
      if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000) throw new Error('Introduce un importe entre 0 y 1,000,000.')
      const response = await fetch('/api/commerce/revenue-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grossCents: Math.round(amount * 100), currency: 'USD', creatorTier, subscriptionStatus: previewStatus, planId: previewStatus === 'active' ? 'isabella_plus' : 'isabella_plus' }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No se pudo calcular el reparto')
      setRevenuePreview(data as RevenuePreview)
    } catch (error) { setCommerceError(error instanceof Error ? error.message : 'No se pudo calcular el reparto') }
    finally { setRevenuePreviewLoading(false) }
  }

  function money(cents: number | null, currency = 'USD') {
    if (cents === null) return 'A medida'
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(cents / 100)
  }

  async function loadOllamaModels() {
    setOllamaStatus('Consultando Ollama desde el servidor…')
    try {
      const response = await fetch('/api/ollama/models', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || data.error || 'Ollama no está disponible desde el servidor')
      setOllamaModels(data.models ?? [])
      setOllamaStatus(`${data.count ?? data.models?.length ?? 0} modelos locales detectados.`)
    } catch (error) { setOllamaStatus(error instanceof Error ? error.message : 'No se pudo consultar Ollama') }
  }

  async function previewDataset(dataset: string) {
    setDatasetPreviewLoading(true); setResourceError('')
    try {
      const response = await fetch('/api/huggingface/dataset-preview?dataset=' + encodeURIComponent(dataset) + '&rows=3', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || data.error || 'No se pudo previsualizar el dataset')
      setDatasetPreview(data as DatasetPreview)
    } catch (error) { setResourceError(error instanceof Error ? error.message : 'Error de vista previa') }
    finally { setDatasetPreviewLoading(false) }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const value = prompt.trim()
    if (!value || isLoading) return
    const next = [...messages, { role: 'user' as const, text: value }]
    setMessages(next); setPrompt(''); setError(''); setIsLoading(true)
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: next.map((message) => ({ role: message.role === 'isabella' ? 'assistant' : 'user', content: message.text })), context: { files, workspace: 'GENESIS V6' }, provider: chatProvider, modelId: chatProvider !== 'gateway' ? chatModel : undefined }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setMessages((current) => [...current, { role: 'isabella', text: data.text, evidence: ['query:session-context', `provider:${data.provider ?? chatProvider}`, `model:${data.model ?? (chatProvider === 'gateway' ? 'gateway-default' : chatModel)}`, 'policy:human-gated'] }])
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
    <nav className="topbar"><a className="wordmark" href="#top">ISABELLA<span>/GENESIS</span></a><span className="workspace-name">V6 / TERMINUS Ω</span><div className="nav-links">{(['chat','studio','models','economy','evidence','governance'] as Panel[]).map((item) => <button key={item} className={panel === item ? 'nav-active' : ''} onClick={() => setPanel(item)}>{item === 'evidence' ? 'Evidence' : item === 'models' ? 'Open Models' : item === 'economy' ? 'Economía' : item[0].toUpperCase() + item.slice(1)}</button>)}</div><div className="topbar-actions"><button className="search" onClick={() => setSearchOpen(true)}><Search size={14} /> Buscar <kbd>⌘ K</kbd></button><button className="new-chat" onClick={() => { setMessages([{ role: 'isabella', text: 'Sesión nueva iniciada. El contexto está limpio y listo.' }]); setPanel('chat') }}><Plus size={15} /> Nuevo chat</button><span className="status"><i /> NODO ACTIVO</span></div></nav>
    <div className="context-bar"><span className="context-dot" /> WORKSPACE <strong>GENESIS V6</strong><span className="divider">/</span> SESSION · ACTIVE <div className="capabilities"><span className="active">TEXT</span><span>LOCAL FILES</span><span>VOICE</span></div></div>
    <section className="hero" id="top"><div className="hero-copy"><div className="eyebrow">TINA · INTELIGENCIA SOBERANA LATINOAMERICANA <span>GENESIS V6 / TERMINUS Ω</span></div><div className="hero-title"><span>01</span><h1>Intelligence<br /><em>with memory.</em></h1></div><p>Una infraestructura cognitiva para convertir datos dispersos en conocimiento verificable, decisiones auditables y trabajo científico reutilizable.</p><div className="hero-actions"><button className="primary" onClick={() => { setPanel('chat'); document.getElementById('workspace')?.scrollIntoView({ behavior: 'smooth' }) }}>ABRIR CHAT <ArrowUpRight size={16} /></button><button className="text-link" onClick={() => setPanel('studio')}>ABRIR STUDIO</button></div><div className="system-board"><div><small>RUNTIME</small><b>OBSERVABLE</b><span>salud y estado del nodo</span></div><div><small>GOBERNANZA</small><b>HUMAN-GATED</b><span>autoridad separada de capacidad</span></div><div><small>EVIDENCIA</small><b>BOOKPI</b><span>trazabilidad de decisiones</span></div></div></div><div className="orbital"><div className="orbit orbit-a" /><div className="orbit orbit-b" /><div className="core"><span>IS</span><small>GENESIS<br />V6</small></div><div className="signal signal-one">CONTEXTO<br /><b>DE SESIÓN</b></div><div className="signal signal-two">RUNTIME<br /><b>OBSERVABLE</b></div><div className="orbital-caption">CORE / IDENTITY <b>V6</b></div></div></section>
    <section className="workspace" id="workspace"><div className="workspace-head"><div><div className="eyebrow">CONTROL PLANE <span>FEDERATED / TRACEABLE</span></div><h2>{panel === 'chat' ? 'Habla con Isabella' : panel === 'studio' ? 'Studio de trabajo' : panel === 'evidence' ? 'Ledger de evidencia' : panel === 'models' ? 'Open Model Intelligence' : panel === 'economy' ? 'Economía del ecosistema' : 'Gobernanza institucional'}</h2></div><div className="workspace-actions"><button onClick={exportSession}><Copy size={14} /> Exportar</button><button onClick={() => setMessages([{ role: 'isabella', text: 'Sesión reiniciada. Estoy aquí para ayudarte.' }])}>Reiniciar</button></div></div>
      <div className="system-metrics">{systems.map(({ id, label, value, meta, icon: Icon }) => <button key={id} onClick={() => id === 'evidence' ? setPanel('evidence') : id === 'policy' ? setPanel('governance') : undefined}><Icon size={15} /><span><small>{label}</small><b>{value}</b><em>{meta}</em></span></button>)}</div>
      {panel === 'chat' && <><div className="messages" aria-live="polite">{messages.map((message, index) => <article key={index} className={`message ${message.role}`}><span className="avatar">{message.role === 'isabella' ? 'IS' : 'TÚ'}</span><div><span className="speaker">{message.role === 'isabella' ? 'ISABELLA · AHORA' : 'TÚ · AHORA'}</span><p>{message.text}</p>{message.evidence && <div className="evidence-tags">{message.evidence.map((tag) => <span key={tag}><Check size={11} /> {tag}</span>)}</div>}</div></article>)}</div><div className="prompt-starters"><span>EMPEZAR CON</span>{starters.map((starter) => <button key={starter} onClick={() => setPrompt(`${starter}: `)}>{starter}</button>)}</div><form className="prompt-box" onSubmit={submit}><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={handleKeyDown} placeholder={isLoading ? 'Isabella está pensando…' : 'Escribe a Isabella…'} aria-label="Mensaje para Isabella" rows={2} disabled={isLoading} /><div className="prompt-tools"><label title="Añadir archivos"><Upload size={16} /><input type="file" multiple onChange={addFile} /></label><button type="button" onClick={() => window.speechSynthesis?.speak(new SpeechSynthesisUtterance(messages.at(-1)?.text || 'Estoy aquí.'))}><Volume2 size={15} /></button><label className="provider-select" title="Proveedor de inferencia"><span>MODELO</span><select value={chatProvider} onChange={(event) => { const nextProvider = event.target.value as 'gateway' | 'huggingface' | 'ollama'; setChatProvider(nextProvider); if (nextProvider === 'ollama') setChatModel('qwen3:8b'); else if (nextProvider === 'huggingface') setChatModel('openai/gpt-oss-120b:fireworks-ai') }}><option value="gateway">AI Gateway</option><option value="huggingface">Hugging Face</option><option value="ollama">Ollama local</option></select></label>{chatProvider !== 'gateway' && <input className="model-id-input" aria-label="Identificador del modelo" value={chatModel} onChange={(event) => setChatModel(event.target.value)} placeholder={chatProvider === 'ollama' ? 'qwen3:8b' : 'org/model:provider'} />}<button className="send" type="submit" disabled={isLoading || !prompt.trim()}>{isLoading ? '…' : 'ENVIAR'} <ArrowUpRight size={15} /></button></div></form>{files.length > 0 && <div className="file-strip"><FileText size={14} /> {files.map((file) => <span key={file}>{file} <button onClick={() => setFiles(files.filter((item) => item !== file))}><X size={11} /></button></span>)}</div>}{error && <p className="error">{error}</p>}</>}
      {panel === 'models' && <div className="hub-browser">
        <div className="hub-intro"><div><div className="eyebrow">OPEN SOURCE · OPEN WEIGHTS · HUB DISCOVERY</div><h3>Modelos, datasets y herramientas abiertas</h3><p>Descubre recursos públicos de Hugging Face. La licencia abierta del modelo no garantiza inferencia gratuita ni uso comercial sin restricciones.</p></div><a href="https://huggingface.co/docs/hub/agents-overview" target="_blank" rel="noreferrer">Skills y agentes <ArrowUpRight size={14} /></a></div>
        <div className="hub-controls"><div className="hub-tabs">{(['models','datasets','spaces'] as const).map((kind) => <button key={kind} className={resourceType === kind ? 'selected' : ''} onClick={() => setResourceType(kind)}>{kind === 'models' ? 'Modelos' : kind === 'datasets' ? 'Datasets' : 'Spaces / Tools'}</button>)}</div><form onSubmit={(event) => { event.preventDefault(); setResourceQuery((event.currentTarget.elements.namedItem('hubQuery') as HTMLInputElement).value.trim()) }}><Search size={15} /><input name="hubQuery" defaultValue={resourceQuery} placeholder="Buscar por nombre, tarea o dominio…" /><button type="submit">Buscar</button></form></div>
        {resourceLoading && <p className="hub-state">Consultando el catálogo público…</p>}{resourceError && <p className="error">{resourceError}</p>}
        <div className="hub-results">{resources.map((resource) => <article className="hub-card" key={resource.id}><div className="hub-card-top"><span>{resourceType === 'models' ? 'MODEL REPOSITORY' : resourceType === 'datasets' ? 'DATASET' : 'SPACE / APP'}</span><span>{resource.gated ? 'ACCESS GATED' : 'PUBLIC CATALOG'}</span></div><h4>{resource.id}</h4><p>{resource.task || resource.tags?.slice(0, 3).join(' · ') || 'Recurso de la comunidad Hugging Face'}</p><div className="hub-stats"><span>{(resource.downloads ?? 0).toLocaleString()} descargas</span><span>{(resource.likes ?? 0).toLocaleString()} likes</span></div><div className="hub-card-actions"><a href={resource.url} target="_blank" rel="noreferrer">Abrir ficha <ArrowUpRight size={13} /></a>{resourceType === 'models' && <button type="button" onClick={() => { setChatModel(resource.id); setChatProvider('huggingface'); setPanel('chat'); document.getElementById('workspace')?.scrollIntoView({ behavior: 'smooth' }); setNotice(`Modelo seleccionado: ${resource.id}. La inferencia requiere HF_TOKEN y disponibilidad del proveedor.`) }}>Usar en chat <ChevronRight size={13} /></button>}{resourceType === 'datasets' && <button type="button" disabled={datasetPreviewLoading} onClick={() => void previewDataset(resource.id)}>{datasetPreviewLoading ? 'Cargando…' : 'Vista previa'} <ChevronRight size={13} /></button>}</div></article>)}</div>
        {datasetPreview && resourceType === 'datasets' && <section className="dataset-preview"><div><div className="eyebrow">DATASET SAMPLE · {datasetPreview.config} / {datasetPreview.split}</div><h4>{datasetPreview.dataset}</h4><p>{datasetPreview.sampleCount} filas de muestra · {datasetPreview.totalRows === null ? 'total desconocido' : datasetPreview.totalRows.toLocaleString() + ' filas totales'}</p></div><pre>{JSON.stringify(datasetPreview.rows, null, 2)}</pre><p>{datasetPreview.notice}</p></section>}
        {resourceNotice && <p className="hub-notice">{resourceNotice}</p>}
        <div className="hub-tooling"><article><h4>Ollama · modelos locales</h4><p>Ejecuta modelos de pesos abiertos en hardware propio. El runtime configurado debe ser accesible desde este servidor; localhost en producción no es el equipo del usuario.</p><button type="button" className="hub-tool-button" onClick={() => void loadOllamaModels()}>Detectar modelos locales <ArrowUpRight size={13} /></button><p>{ollamaStatus}</p>{ollamaModels.map((model) => <div className="local-model-row" key={model.name}><span><b>{model.name}</b><small>{model.parameters || 'parámetros no informados'}{model.quantization ? ' · ' + model.quantization : ''}</small></span><button type="button" onClick={() => { setChatProvider('ollama'); setChatModel(model.name); setPanel('chat'); document.getElementById('workspace')?.scrollIntoView({ behavior: 'smooth' }) }}>Usar <ChevronRight size={12} /></button></div>)}</article><article><h4>Hugging Face MCP</h4><p>Conecta el Hub para consultar modelos, datasets, documentación y Spaces con herramientas MCP. Requiere autorización del usuario en el cliente compatible.</p><a href="https://huggingface.co/settings/mcp" target="_blank" rel="noreferrer">Configurar MCP <ArrowUpRight size={13} /></a></article><article><h4>Skills oficiales</h4><p>Guías operativas para el CLI de Hugging Face, búsqueda del Hub y flujos de trabajo ML para agentes compatibles.</p><a href="https://huggingface.co/docs/hub/agents-overview" target="_blank" rel="noreferrer">Consultar skills <ArrowUpRight size={13} /></a></article><article><h4>API y documentación</h4><p>API pública de Hub para modelos, datasets, Spaces y metadatos. Respeta rate limits y licencias por repositorio.</p><a href="https://huggingface.co/docs/hub/en/api" target="_blank" rel="noreferrer">Leer API docs <ArrowUpRight size={13} /></a></article></div>
      </div>}
      {panel === 'economy' && <div className="economy-workspace">
        <div className="economy-intro"><div><div className="eyebrow">REVENUE FABRIC · CREATOR ECONOMY</div><h3>La inteligencia también crea valor.</h3><p>Suscripciones, herramientas y economía de creadores con reglas transparentes, cálculo reproducible y gobernanza humana.</p></div><div className="economy-price"><span>ISABELLA PLUS · REFERENCIA MENSUAL</span><strong>{commerceCatalog ? money(commerceCatalog.pricing.monthlyCents, commerceCatalog.pricing.currency) : '…'}</strong><small>+25% sobre una referencia configurable de {commerceCatalog ? money(commerceCatalog.pricing.referenceMonthlyCents, commerceCatalog.pricing.currency) : '$20.00'}</small></div></div>
        {commerceError && <p className="error">{commerceError}</p>}
        {commerceCatalog && <><p className="economy-disclaimer">{commerceCatalog.pricing.pricingNote} Los cobros recurrentes aún no están conectados; esta vista no crea una suscripción.</p>
        <div className="economy-plans">{commerceCatalog.plans.map((plan) => <article className="economy-plan" key={plan.id}><span className="plan-kicker">{plan.id === 'isabella_plus' ? 'MEMBERSHIP' : plan.id.toUpperCase()}</span><h4>{plan.name}</h4><strong>{money(plan.monthlyCents, plan.currency)}{plan.monthlyCents !== null && plan.monthlyCents > 0 ? <small> / mes</small> : null}</strong><p>{plan.id === 'free' ? 'Explora el ecosistema y conoce sus capacidades.' : plan.id === 'isabella_plus' ? 'Acceso de pago y puerta de elegibilidad para monetización, una vez activados registro, verificación y facturación.' : 'Oferta comercial sujeta a contrato y evaluación.'}</p><span className={plan.monetizationEligible ? 'plan-status' : 'plan-muted'}>{plan.monetizationEligible ? 'Elegibilidad prevista · no activada' : 'Sin reparto habilitado'}</span></article>)}</div>
        <div className="revenue-rules"><div className="eyebrow">CREATOR SHARE · POLÍTICA DE REPARTO</div><h3>Del 50/50 al 80/20</h3><p>El nivel define el porcentaje de creador en transacciones elegibles. Solo una suscripción de pago activa y un perfil aprobado pueden recibir ingresos; el estado que seleccionas abajo es exclusivamente para simular.</p><div className="share-tiers">{commerceCatalog.creatorTiers.map((tier) => <button type="button" key={tier.id} className={creatorTier === tier.id ? 'share-tier selected' : 'share-tier'} onClick={() => setCreatorTier(tier.id as 'standard' | 'sovereign' | 'elite')}><span>{tier.label}</span><strong>{tier.creatorPercent}% <small>creador</small></strong><em>{tier.platformPercent}% plataforma</em></button>)}</div>
        <div className="revenue-calculator"><label>Importe bruto USD<input type="number" min="0" max="1000000" step="0.01" value={revenueGross} onChange={(event) => setRevenueGross(event.target.value)} /></label><label>Estado simulado<select value={previewStatus} onChange={(event) => setPreviewStatus(event.target.value as 'active' | 'past_due')}><option value="active">Pago activo</option><option value="past_due">Pago vencido / bloqueado</option></select></label><button type="button" className="primary" onClick={() => void previewCreatorRevenue()} disabled={revenuePreviewLoading}>{revenuePreviewLoading ? 'Calculando…' : 'Calcular reparto'} <ArrowUpRight size={14} /></button></div>
        {revenuePreview && <div className="revenue-result"><div className="revenue-result-head"><span>{revenuePreview.eligible ? 'SIMULACIÓN · ELEGIBLE SEGÚN DATOS INTRODUCIDOS' : 'SIMULACIÓN · SIN DERECHO A REPARTO'}</span><b>{money(revenuePreview.creatorCents)} <small>para creador</small></b></div><div className="revenue-breakdown"><span>Bruto <b>{money(revenuePreview.grossCents)}</b></span><span>Creador <b>{money(revenuePreview.creatorCents)}</b></span><span>Plataforma <b>{money(revenuePreview.platformCents)}</b></span><span>Fondo Fénix <b>{money(revenuePreview.phoenixFundCents)}</b></span><span>Infraestructura <b>{money(revenuePreview.infrastructureCents)}</b></span><span>DAO <b>{money(revenuePreview.daoCents)}</b></span></div><p>{revenuePreview.reason}. {revenuePreview.trustBoundary}</p><strong className="no-payout">Simulación solamente · no se ha registrado ni transferido dinero.</strong></div>}
        <div className="platform-allocation"><span>Distribución interna de la parte de plataforma</span><b>20% Fondo Fénix</b><b>30% Infraestructura</b><b>50% DAO</b><small>La distribución se aplica a la parte de plataforma, no al importe bruto.</small></div></div>
        <div className="economy-capabilities"><span><Check size={14} /> Catálogo de planes y reglas de reparto implementado</span><span><Check size={14} /> Vista previa de reparto en centavos enteros</span><span><ShieldCheck size={14} /> Devengo durable preparado con Supabase migration</span><span><Activity size={14} /> Checkout: {commerceCatalog.capabilities.checkout ? 'configurado' : 'pendiente'}</span><span><Wallet size={14} /> Payouts: {commerceCatalog.capabilities.payouts ? 'configurados' : 'pendientes'}</span></div>
        </>}
      </div>}
      {panel === 'studio' && <div className="panel-grid"><article><Library size={20} /><h3>Artefactos revisables</h3><p>Convierte las respuestas de Isabella en documentos, hipótesis, planes y entregables con contexto conservado.</p><button onClick={exportSession}>Exportar sesión <ChevronRight size={14} /></button></article><article><Upload size={20} /><h3>Contexto local</h3><p>Incorpora documentos al workspace para que el análisis respete tu fuente, licencia y alcance.</p><label className="dropzone">Seleccionar archivos<input type="file" multiple onChange={addFile} /></label></article></div>}
      {panel === 'evidence' && <div className="ledger"><div className="ledger-summary"><Gauge size={22} /><div><b>{evidenceCount} eventos trazables</b><span>Metadatos visibles de sesión; no equivale a evidencia verificada ni a ledger persistente</span></div></div>{messages.flatMap((message, index) => (message.evidence ?? []).map((item) => <div className="ledger-row" key={`${index}-${item}`}><Check size={14} /><span><b>{item}</b><small>Sesión actual · metadato de interfaz</small></span><code>RECORDED</code></div>))}</div>}
      {panel === 'governance' && <div className="governance-panel"><ShieldCheck size={26} /><div><h3>Autoridad humana separada</h3><p>Isabella puede sugerir, sintetizar y preparar acciones. Las decisiones sensibles, publicación y efectos externos requieren revisión y aprobación humana.</p><div className="policy-list"><span><Check size={13} /> Procedencia obligatoria</span><span><Check size={13} /> Licencia y finalidad visibles</span><span><Check size={13} /> Revocación y auditoría</span><span><Check size={13} /> Sin ejecución autónoma sensible</span></div></div></div>}
    </section>
    <section className="lower-grid"><article><div className="eyebrow">ISA-FLOW</div><h2>Del dato a la <em>evidencia.</em></h2><p>Descubrimiento, metadatos FAIR+, grafo semántico, agente gobernado y decisión humana en una cadena reproducible.</p></article><article><div className="eyebrow">FEDERATED NODES</div><h2>Más abierto. <em>Más soberano.</em></h2><p>Conecta instituciones sin perder custodia, permisos, procedencia ni capacidad de revocación.</p></article><article><div className="eyebrow">OPEN SCIENCE</div><h2>Construir con <em>responsabilidad.</em></h2><p>Interoperabilidad, preservación y auditoría como infraestructura crítica del conocimiento.</p></article></section>
    <footer><span>HUMILDAD · RESILIENCIA · PROPÓSITO</span><span>ISABELLA VILLASEÑOR AI · GENESIS V6</span></footer>
    {notice && <button className="toast" onClick={() => setNotice('')}>{notice} <X size={13} /></button>}
    {searchOpen && <div className="search-modal" role="dialog" aria-modal="true"><div><button className="close" onClick={() => setSearchOpen(false)}><X size={16} /></button><Search size={18} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en Isabella…" /><p>{query ? `Buscar en conocimiento, evidencia y sesiones: “${query}”` : 'Busca en tu workspace federado.'}</p></div></div>}
  </main>
}
