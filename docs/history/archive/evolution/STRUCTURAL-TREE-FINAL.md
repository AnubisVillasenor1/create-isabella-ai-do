# Isabella V5.0.0 — Árbol estructural final

```text
ISABELLA-AI-TINA/
│
├── FOUNDATION/
│   ├── runtime contracts
│   ├── env/config
│   ├── cryptographic identity
│   ├── dependency/supply-chain
│   └── release provenance
│
├── INGRESS/
│   ├── API routes
│   ├── SSE
│   ├── input limits
│   ├── sanitization
│   └── correlation
│
├── AUTHORITY/
│   ├── PrincipalContext
│   ├── RBAC
│   ├── ABAC
│   ├── PDP
│   ├── consent
│   └── human approval
│
├── CROWN/
│   ├── identity
│   ├── intent
│   ├── classification
│   ├── capability
│   ├── policy
│   ├── risk
│   └── verification
│
├── HYPERCORE/
│   ├── VECTOR
│   │   ├── PREFIX_CACHE
│   │   └── SEMANTIC_CACHE
│   ├── SPECULATIVE
│   │   ├── DRAFT_MODEL
│   │   └── PARALLEL_BRANCHES
│   └── VERITAS
│       ├── VERIFIER_FANOUT
│       └── GOVERNED_EARLY_EXIT
│
├── COGNITION/
│   ├── perception
│   ├── context
│   ├── hypothesis
│   ├── planning
│   ├── proposal
│   ├── orchestration
│   └── inference
│
├── MEMORY/
│   ├── ephemeral
│   ├── session
│   ├── durable
│   ├── verified
│   ├── provenance
│   ├── retention
│   └── retrieval authorization
│
├── INTELLIGENCE/
│   ├── native inference
│   ├── model registry
│   ├── provider registry
│   ├── MoE
│   ├── routing
│   ├── fallback
│   └── epistemic controls
│
├── NATIVE-ML/
│   ├── classification
│   ├── reinforcement
│   ├── skill fusion
│   ├── convergence
│   └── evaluation
│
├── SKILLS/
│   ├── registry
│   ├── native skills
│   ├── evolved skills
│   ├── skill bridge
│   ├── execution
│   ├── provenance
│   └── evaluation
│
├── TOOLS/
│   ├── registry
│   ├── contracts
│   ├── permissions
│   ├── dispatch
│   ├── timeout/cancellation
│   ├── idempotency
│   └── execution receipts
│
├── AGENT-RUNTIME/
│   ├── planner
│   ├── orchestrator
│   ├── execution graph
│   ├── sandbox
│   ├── recovery
│   └── agent memory
│
├── GOVERNANCE/
│   ├── policy-as-code
│   ├── decision ledger
│   ├── audit receipts
│   ├── risk register
│   ├── data rights
│   ├── change management
│   └── human oversight
│
├── SECURITY/
│   ├── output gate
│   ├── SSRF
│   ├── egress controls
│   ├── secret scanning
│   ├── cryptography
│   ├── dependency controls
│   └── tenant-boundary testing
│
├── OBSERVABILITY/
│   ├── OpenTelemetry-neutral layer
│   ├── metrics
│   ├── logs
│   ├── traces
│   ├── latency budgets
│   ├── anomaly detection
│   └── incident correlation
│
├── DATA/
│   ├── PostgreSQL/Neon
│   ├── Prisma
│   ├── repository abstractions
│   ├── append-only evidence
│   └── BookPI
│
├── FEDERATION/
│   ├── LATAM Aegis X
│   ├── territorial adapters
│   ├── integrations
│   └── sovereign boundaries
│
├── PRESENTATION/
│   ├── Chat
│   ├── Terminal
│   ├── Dashboard
│   ├── Voice
│   ├── Studio
│   ├── Immersive
│   └── Accessibility
│
├── EVOLUTION-FABRIC/              ← V5 NEW
│   ├── manifest.ts
│   ├── hypercore.ts
│   ├── catalog.ts                 ← 7,000 controls
│   ├── engine.ts
│   ├── index.ts
│   ├── 7000-controls.v5.json
│   ├── AI-TO-AI-OPERATING-MANUAL.md
│   ├── BLUEPRINT-V5.md
│   ├── 7000-CONTROL-MATRIX.md
│   └── STRUCTURAL-TREE-FINAL.md
│
├── PRODUCTION/
│   ├── CI/CD
│   ├── preflight
│   ├── production gate
│   ├── SBOM
│   ├── security scan
│   ├── database migration/backup/restore
│   ├── release verification
│   ├── canary
│   └── rollback/disaster recovery
│
└── TESTING/
    ├── unit
    ├── security
    ├── native ML
    ├── BookPI
    ├── integration
    ├── load
    ├── benchmark
    └── evolution controls
```

## Physical repository mapping

The existing repository already contains the principal physical areas under `src/core`, `src/lib`, `src/domains`, `src/governance`, `src/server-routes`, `src/routes`, `ml-service`, `authz-runtime`, `quantum_utility_platform`, `supabase`, `prisma`, `k8s`, `scripts`, `test`, `docs`, `governance` and related deployment artifacts. V5 adds `src/evolution`, `test/evolution` and `docs/evolution` without pretending that the existing subsystems have been rewritten wholesale.
