# ISABELLA GENESIS ZERO-OPEX v3 - Operations Runbook

> **Version**: 3.0
> **Environment**: OCI Always Free (VM.Standard.A1.Flex - 4 vCPU ARM, 24GB RAM, 200GB SSD)
> **Last Updated**: 2026-10-22

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Service Directory](#service-directory)
3. [Deployment Procedures](#deployment-procedures)
4. [Monitoring & Alerting](#monitoring--alerting)
5. [Incident Response](#incident-response)
6. [Backup & Restore](#backup--restore)
7. [Scaling & Performance](#scaling--performance)
8. [Security Operations](#security-operations)
8. [Rollback Procedures](#rollback-procedures)
9. [Contact & Escalation](#contact--escalation)

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    ISABELLA GENESIS ZERO-OPEX v3               │
├─────────────────────────────────────────────────────────────────┤
│  Caddy (TLS/HTTP3) ──────► isabella-core:8080                  │
│       │                                                         │
│       ├─► /api/v1/* ──────────► HyperRouter MoE v3             │
│       │                           │                             │
│       │                           ├─► Semantic Cache (HNSW)    │
│       │                           ├─► Complexity Scorer        │
│       │                           ├─► Local Models (Ollama)    │
│       │                           └─► Fallback (Groq/Gemini)   │
│       │                                                         │
│       └─► PostgreSQL Kernel (Unified)                          │
│           ├─ pgvector (Vector Search)                          │
│           ├─ Apache AGE (Graph)                                │
│           ├─ pgmq (Queues)                                     │
│           ├─ pg_advisory_lock (Locks)                          │
│           └─ BookPI Ledger (Audit)                             │
└─────────────────────────────────────────────────────────────────┘
```

### Resource Allocation (OCI Always Free - 24GB RAM)

| Component | RAM | CPU | Disk |
|-----------|-----|-----|------|
| PostgreSQL + Extensions | ~1.0 GB | 1-2 vCPU | 50 GB |
| Ollama (3 models) | ~18 GB | 2-4 vCPU | 30 GB |
| VictoriaMetrics | ~50 MB | 0.5 vCPU | 5 GB |
| CrowdSec | ~150 MB | 0.5 vCPU | 2 GB |
| OTEL Collector | ~100 MB | 0.2 vCPU | 1 GB |
| Caddy | ~50 MB | 0.1 vCPU | 1 GB |
| isabella-core | ~1 GB | 1 vCPU | 2 GB |
| **Total** | **~20.3 GB** | **~4 vCPU** | **~90 GB** |

**Available Headroom**: ~3.7 GB RAM, 110 GB disk

---

## 🛠️ Service Directory

| Service | Port | Health Check | Logs | Config |
|---------|------|--------------|------|--------|
| **PostgreSQL** | 5432 | `pg_isready` | `docker logs isabella-postgres` | `config/postgresql.conf` |
| **Ollama** | 11434 | `GET /api/tags` | `docker logs isabella-ollama` | - |
| **isabella-core** | 8080 | `GET /api/v1/health` | `docker logs isabella-core` | `.env` |
| **Caddy** | 80/443 | `GET /api/v1/health` | `docker logs isabella-caddy` | `config/Caddyfile` |
| **VictoriaMetrics** | 8428 | `GET /metrics` | `docker logs isabella-metrics` | `config/victoriametrics.yaml` |
| **CrowdSec** | 8080/8081 | `GET /health` | `docker logs isabella-crowdsec` | `config/crowdsec.yaml` |
| **OTEL Collector** | 4317/4318/8888 | `GET /metrics` | `docker logs isabella-otel` | `config/otel-collector.yaml` |

---

## 🚀 Deployment Procedures

### Initial Deployment (Fresh Server)

```bash
# 1. Provision OCI VM.Standard.A1.Flex (4 OCPU, 24GB RAM, 200GB SSD)
# 2. SSH in and run hardening
sudo apt update && sudo apt upgrade -y
sudo ufw default deny incoming && sudo ufw default allow outgoing
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw enable

# 3. Install Docker
sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker

# 4. Clone and configure
git clone https://github.com/OsoPanda1/ISABELLA-VERSION-TERMINUS-V6.git /opt/isabella
cd /opt/isabella
cp .env.example .env
# EDIT .env with actual values!

# 5. Generate secrets
openssl rand -base64 32  # For BOOKPI_INTEGRITY_SECRET, tokens, etc.

# 6. Set the database password in .env (never in the repo)
# Append to .env:
#   POSTGRES_PASSWORD=<openssl rand -base64 32>
#   DATABASE_URL=postgresql://isabella_admin:<same-password>@postgres:5432/isabella_db

# 7. Deploy
./scripts/deploy.sh deploy
```

### Routine Deployment (Code Updates)

```bash
cd /opt/isabella
git pull origin main
./scripts/deploy.sh deploy
```

### Emergency Hotfix Deployment

```bash
# 1. Create hotfix branch
git checkout -b hotfix/critical-fix
# ... make changes ...
git commit -m "hotfix: critical security fix"
git push origin hotfix/critical-fix

# 2. Create PR, merge to main after CI passes
# 3. GitHub Actions auto-deploys to production
```

---

## 📊 Monitoring & Alerting

### Key Metrics to Watch

| Metric | Source | Alert Threshold | Action |
|--------|--------|-----------------|--------|
| `isabella_database_healthy` | VictoriaMetrics | == 0 | **CRITICAL** - DB down |
| `process_memory_heap_used_bytes` | VictoriaMetrics | > 1.5 GB | **WARNING** - Memory leak |
| `isabella_database_pool_waiting` | VictoriaMetrics | > 5 | **WARNING** - Connection pool exhausted |
| `ollama_model_loaded` | VictoriaMetrics | == 0 | **WARNING** - Models unloaded |
| `crowdsec_decisions_total` | VictoriaMetrics | > 100/hr | **WARNING** - Attack spike |
| `process_uptime_seconds` | VictoriaMetrics | < 300 | **WARNING** - Frequent restarts |
| `disk_usage_percent` | Node Exporter | > 85% | **WARNING** - Disk full |
| `system_memory_utilization` | Node Exporter | > 90% | **CRITICAL** - OOM risk |

### Key Dashboards

1. **Isabella Overview** - Service health, request rate, latency, error rate
2. **Database** - Connections, query latency, cache hit ratio, WAL lag
3. **Inference** - Model usage, latency, cache hit rate, fallback rate
4. **Security** - Blocked IPs, attack types, rate limit hits
4. **Infrastructure** - CPU, RAM, Disk, Network

### VictoriaMetrics Queries

```promql
# Request rate
rate(http_requests_total[5m])

# P99 latency
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))

# Cache hit rate
rate(semantic_cache_hits_total[5m]) / (rate(semantic_cache_hits_total[5m]) + rate(semantic_cache_misses_total[5m]))

# Fallback rate
rate(hyperrouter_fallback_total[5m]) / rate(http_requests_total[5m])

# Database connection pool
isabella_database_pool_waiting / isabella_database_pool_total
```

---

## 🚨 Incident Response

### Severity Levels

| Severity | Definition | Response Time | Escalation |
|----------|------------|---------------|------------|
| **SEV-1** | Service down, data loss, security breach | < 15 min | Page on-call + team lead |
| **SEV-2** | Degraded performance, partial outage | < 1 hour | Notify team lead |
| **SEV-3** | Minor issue, workaround exists | < 4 hours | Next business day |
| **SEV-4** | Cosmetic, non-urgent | Next sprint | Backlog |

### Common Incident Scenarios

#### 1. Database Unavailable (`isabella_database_healthy == 0`)

```bash
# 1. Check container
docker compose ps postgres

# 2. Check logs
docker compose logs postgres --tail=100

# 3. Check disk space
df -h

# 4. Check memory
free -h

# 5. Restart if needed
docker compose restart postgres

# 6. If corruption suspected
docker compose exec postgres pg_dump -U isabella_admin isabella_db > backup.sql
docker compose restart postgres
```

#### 2. Ollama Models Not Loading

```bash
# 1. Check container
docker compose ps ollama

# 2. Check logs
docker compose logs ollama --tail=100

# 3. Check GPU/CPU memory
docker stats ollama

# 4. Reload models
docker compose exec ollama ollama pull llama3.3:8b
docker compose exec ollama ollama pull qwen2.5-coder:14b
docker compose exec ollama ollama pull deepseek-r1:32b

# 3. If OOM, reduce concurrent models
docker compose exec ollama ollama ps
```

#### 3. High Latency / Timeouts

```bash
# 1. Check database connections
docker compose exec postgres psql -U isabella_admin -c "SELECT count(*) FROM pg_stat_activity;"

# 2. Check connection pool
curl -s http://localhost:8080/api/v1/metrics | grep isabella_database_pool

# 4. Check Ollama queue
docker compose logs ollama | grep -i queue

# 5. Scale down if overloaded
# Reduce OLLAMA_NUM_PARALLEL in docker-compose.yml
```

#### 4. CrowdSec Blocking Legitimate Traffic

```bash
# 1. Check decisions
docker compose exec crowdsec cscli decisions list

# 2. Check logs
docker compose logs crowdsec | grep -i "ban\|block"

# 3. Whitelist IP
docker compose exec crowdsec cscli decisions add --ip 1.2.3.4 --duration 1h --reason "whitelist"

# 4. Check parsers
docker compose exec crowdsec cscli parsers list
```

#### 5. SSL Certificate Issues

```bash
# 1. Check Caddy logs
docker compose logs caddy --tail=50

# 2. Test certificate
openssl s_client -connect isabella.tamv.online:443 -servername isabella.tamv.online

# 3. Force renewal
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile --force
```

---

## 💾 Backup & Restore

### Automated Backups (Daily at 02:00 UTC)

```bash
# Manual backup
./scripts/backup.sh full

# Verify backup
./scripts/backup.sh verify

# List backups
./scripts/backup.sh list
```

### Backup Retention
- **Daily**: 30 days
- **Weekly**: 12 weeks (manual)
- **Monthly**: 12 months (manual)

### Restore Procedure

```bash
# 1. Stop application
docker compose stop isabella-core

# 2. Restore PostgreSQL
gunzip -c backups/20261022_020000/postgres_20261022_020000.sql.gz | \
  docker compose exec -T postgres psql -U isabella_admin -d isabella_db

# 3. Restore config (if needed)
tar -xzf backups/20261022_020000/config_20261022_020000.tar.gz -C /

# 4. Restart
docker compose up -d isabella-core

# 5. Verify
curl http://localhost:8080/api/v1/readyz
```

---

## ⚡ Scaling & Performance

### Current Limits (OCI Always Free)

| Resource | Current | Max | Upgrade Path |
|----------|---------|-----|--------------|
| RAM | 24 GB | 24 GB | Pay for larger shape |
| CPU | 4 vCPU | 4 vCPU | Pay for larger shape |
| Disk | 200 GB | 200 GB | Add block volumes |
| Network | 4.8 Gbps | 4.8 Gbps | N/A |

### Vertical Scaling (Within Free Tier)

```bash
# Increase Ollama memory
# Edit docker-compose.yml:
# ollama:
#   deploy:
#     resources:
#       limits:
#         memory: 20G  # was 18G

docker compose up -d ollama
```

### Horizontal Scaling (Beyond Free Tier)

1. **Read Replicas**: Add PostgreSQL read replica
2. **Ollama Workers**: Add GPU instances, use `ollama serve` with load balancer
3. **Caching Layer**: Add Redis for session cache (if needed)
4. **CDN**: Cloudflare for static assets

### Performance Tuning

```bash
# Database
# Increase work_mem for complex queries
# Enable parallel query
# Partition large tables (audit_events, routing_decisions)

# Ollama
# Reduce OLLAMA_NUM_PARALLEL if OOM
# Use quantization (q4_k_m) for smaller models

# Application
# Increase cache TTL
# Reduce semantic cache threshold (0.95 -> 0.90)
```

---

## 🔒 Security Operations

### Daily Security Tasks

```bash
# 1. Check CrowdSec alerts
docker compose exec crowdsec cscli alerts list -s critical

# 2. Review banned IPs
docker compose exec crowdsec cscli decisions list

# 3. Check for failed auth
docker compose logs isabella-core | grep -i "auth.*fail" | tail -20

# 3. Review audit log
curl -s http://localhost:8080/api/v1/audit/recent | jq .
```

### Weekly Security Tasks

```bash
# 1. Update CrowdSec collections
docker compose exec crowdsec cscli hub update
docker compose exec crowdsec cscli collections upgrade

# 2. Update container images
docker compose pull
docker compose up -d --remove-orphans

# 3. Rotate secrets (monthly)
# Generate new BOOKPI_INTEGRITY_SECRET, tokens, etc.
# Update .env and restart

# 4. Review audit hash chain
curl http://localhost:8080/api/v1/audit/verify | jq .
```

### Monthly Security Tasks

```bash
# 1. Rotate API keys
# 2. Review user access
# 3. Penetration test (automated)
# 4. Update base images
# 5. Review CrowdSec hub for new collections
```

---

## 🔄 Rollback Procedures

### Quick Rollback (Last Deployment)

```bash
cd /opt/isabella

# 1. Get previous image tag
docker images --format "table {{.Repository}}:{{.Tag}}" | grep isabella-core

# 2. Rollback docker-compose
docker compose down
docker tag ghcr.io/osopanda1/isabella-genesis:sha-<previous> ghcr.io/osopanda1/isabella-genesis:latest
docker compose up -d

# 3. Verify
curl http://localhost:8080/api/v1/health
```

### Database Rollback

```bash
# 1. Stop app
docker compose stop isabella-core

# 2. Restore from backup
gunzip -c backups/20261022_020000/postgres_20261022_020000.sql.gz | \
  docker compose exec -T postgres psql -U isabella_admin -d isabella_db

# 3. Restart app
docker compose up -d isabella-core
```

### Full Environment Rollback (Disaster Recovery)

```bash
# 1. Provision new OCI instance
# 2. Run full deployment
# 3. Restore from latest backup
./scripts/backup.sh verify
gunzip -c backups/latest/postgres_*.sql.gz | docker compose exec -T postgres psql ...
# 4. Update DNS
# 5. Verify all endpoints
```

### Rollback Checklist

- [ ] Identify root cause
- [ ] Determine rollback target (image tag / backup timestamp)
- [ ] Notify stakeholders
- [ ] Execute rollback
- [ ] Verify health endpoints
- [ ] Run smoke tests
- [ ] Monitor for 30 minutes
- [ ] Document incident

---

## 📞 Contact & Escalation

| Role | Name | Contact | Availability |
|------|------|---------|--------------|
| **Platform Owner** | [Name] | [Email/Phone] | 24/7 |
| **Platform Engineer** | [Name] | [Email/Phone] | Business hours |
| **Security Lead** | [Name] | [Email/Phone] | 24/7 for SEV-1 |
| **Database Admin** | [Name] | [Email/Phone] | Business hours |
| **OCI Support** | Oracle | https://support.oracle.com | 24/7 (paid) |

### Escalation Matrix

| Time Elapsed | SEV-1 | SEV-2 | SEV-3 |
|--------------|-------|-------|-------|
| 0-15 min | Page Platform Owner | Notify Team Lead | - |
| 15-30 min | Page Security Lead | Page Platform Engineer | Create ticket |
| 30-60 min | Engage OCI Support | Escalate to Platform Owner | Assign owner |
| 1-2 hours | War room | War room | Status update |
| 2-4 hours | Executive notification | Status page update | Plan fix |

---

## 📚 Reference Links

- [OCI Always Free Documentation](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm)
- [Docker Compose Reference](https://docs.docker.com/compose/)
- [PostgreSQL 16 Documentation](https://www.postgresql.org/docs/16/)
- [Apache AGE Documentation](https://age.apache.org/)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Ollama Documentation](https://github.com/ollama/ollama)
- [CrowdSec Documentation](https://doc.crowdsec.net/)
- [Caddy Documentation](https://caddyserver.com/docs/)
- [VictoriaMetrics Documentation](https://victoriametrics.github.io/)
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)

---

## 📝 Change Log

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-10-22 | 3.0 | Platform Team | Genesis Zero-OPEX v3 initial release |

---

**Document Owner**: Platform Engineering Team
**Review Cycle**: Monthly
**Next Review**: 2026-11-22