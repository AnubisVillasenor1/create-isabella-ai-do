# Quantum Utility Platform (qup)

Composable, auditable Qiskit utility-scale workflows implementing the Qiskit pattern:
`Map -> Optimize -> Execute -> Post-process`

## Structure

- `src/qup/contracts.py`: Core types and execution models.
- `src/qup/config.py`: Operational settings and limits.
- `src/qup/audit.py`: Cryptographic hash chain audit trails.
- `src/qup/pipeline.py`: Main workflow orchestration engine.
- `src/qup/registry.py`: Extensible registry for opt-in addons.
- `src/qup/workflows/`: Estimator, Sampler, Hybrid QML, and Toric QEC modules.
