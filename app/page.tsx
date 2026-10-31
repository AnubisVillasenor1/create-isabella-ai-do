const modules = [
  ["Cognition", "Reasoning, planning and model routing"],
  ["Memory", "Scoped persistence and retrieval"],
  ["Governance", "Evidence, risk and human control"],
  ["Federation", "Connected channels and services"],
]

export default function Home() {
  return (
    <main className="shell">
      <header className="nav">
        <div className="brand"><span className="mark">I</span><span>ISABELLA</span></div>
        <span className="status"><i /> Genesis runtime ready</span>
      </header>
      <section className="hero">
        <p className="eyebrow">GENESIS AI · TERMINUS V6</p>
        <h1>Una inteligencia con memoria, criterio y trazabilidad.</h1>
        <p className="lede">Isabella coordina modelos, herramientas y conocimiento para convertir intención en acciones verificables, bajo límites claros y supervisión humana.</p>
        <div className="actions"><a className="primary" href="/api/health">Comprobar runtime</a><a className="secondary" href="https://github.com/OsoPanda1/ISABELLA-VERSION-TERMINUS-V6" target="_blank" rel="noreferrer">Ver repositorio</a></div>
      </section>
      <section className="modules" aria-labelledby="modules-title">
        <div className="section-heading"><p className="eyebrow">ARQUITECTURA</p><h2 id="modules-title">Sistemas conectados</h2></div>
        <div className="grid">{modules.map(([name, description]) => <article key={name}><span className="number">0{modules.findIndex(([item]) => item === name) + 1}</span><h3>{name}</h3><p>{description}</p></article>)}</div>
      </section>
      <footer><span>Isabella Genesis AI</span><span>Operable · Auditable · Extensible</span></footer>
    </main>
  )
}
