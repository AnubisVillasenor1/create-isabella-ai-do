# Kubernetes deployment

1. Build/publish the image from `ige-omega/` and replace the tag with an immutable digest.
2. Provision PostgreSQL 16 separately and permit only the required database network path.
3. Create the Secret outside Git. `api-tokens` must use `token|tenant_uuid|user_uuid;token2|tenant_uuid|user_uuid`, with one random token (64 hexadecimal characters) per principal: `kubectl -n isabella-ige-omega create secret generic ige-omega-secrets --from-literal=database-url='postgres://...' --from-literal=api-tokens='token|tenant-uuid|user-uuid'`.
4. Apply namespace first, then namespaced resources: `kubectl apply -f ige-omega/deployment/k8s/namespace.yaml` and `kubectl apply -f ige-omega/deployment/k8s/`.
5. Check rollout, readiness and authenticated audit verification.

PostgreSQL, TLS ingress, backups, external secret manager, PodDisruptionBudget and certificate management are not provisioned here. Review the namespace selectors in NetworkPolicy for the target cluster before deployment.
