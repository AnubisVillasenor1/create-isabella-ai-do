# SOPS/AGE Secrets Management for ISABELLA GENESIS ZERO-OPEX v3

## Quick Start

### 1. Generate AGE Keys
```bash
# Install age
# macOS: brew install age
# Linux: apt install age / yay -S age
# Windows: scoop install age

# Generate key pair
age-keygen -o age.key

# This creates age.key (private) and outputs public key
# Add the public key (age1...) to .sops.yaml
```

### 2. Configure .sops.yaml
```bash
# Edit .sops.yaml and add your public key(s)
# Example:
# age: >
#   age1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 3. Create Plaintext Secrets File
```bash
# Create secrets.yaml with your actual values
cat > secrets.yaml << 'EOF'
DATABASE_URL: "postgresql://isabella_admin:supersecret@postgres:5432/isabella_db"
STRIPE_SECRET_KEY: "sk_live_xxxxxxxxxxxxxxxxxxxx"
STRIPE_WEBHOOK_SECRET: "whsec_xxxxxxxxxxxxxxxxxxxx"
STRIPE_PUBLISHABLE_KEY: "pk_live_xxxxxxxxxxxxxxxxxxxx"
OPENROUTER_API_KEY: "sk-or-v1-xxxxxxxxxxxxxxxxxxxx"
GEMINI_API_KEY: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
HF_TOKEN: "hf_xxxxxxxxxxxxxxxxxxxx"
GROQ_API_KEY: "gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
STEP_API_KEY: "sk_step_xxxxxxxxxxxxxxxxxxxx"
BOOKPI_INTEGRITY_SECRET: "supersecret32charminimumsopsk"
GENESIS_ADMIN_API_TOKEN: "openssl-rand-base64-32"
OPS_API_TOKEN: "openssl-rand-base64-32"
HSF_API_TOKEN: "openssl-rand-base64-32"
GENESIS_PUBLIC_API_TOKEN: "openssl-rand-base64-32"
ISABELLA_APPROVAL_PRIVATE_KEY_PEM: |
  -----BEGIN PRIVATE KEY-----
  MC4CAQAwBQYDK2VwBCIEI...
  -----END PRIVATE KEY-----
ISABELLA_APPROVAL_TRUSTED_PUBLIC_KEY_PEM: |
  -----BEGIN PUBLIC KEY-----
  MCowBQYDK2VwAyE...
  -----END PUBLIC KEY-----
EOF
```

### 4. Encrypt Secrets
```bash
# Encrypt the file
sops --config .sops.yaml --encrypt --in-place secrets.yaml

# This creates secrets.enc.yaml (encrypted)
# The original secrets.yaml should be deleted or added to .gitignore
```

### 5. Commit Encrypted File
```bash
git add secrets.enc.yaml .sops.yaml
git commit -m "feat: add encrypted secrets for production"
git push
```

### 6. Decrypt in CI/CD
```yaml
# .github/workflows/deploy.yml
- name: Decrypt secrets
  run: |
    sops --config .sops.yaml --decrypt secrets.enc.yaml > secrets.yaml
    # Use secrets.yaml in deployment
```

### 7. Decrypt Locally for Development
```bash
# Decrypt to .env file
sops --config .sops.yaml --decrypt secrets.enc.yaml > .env

# Or decrypt to stdout
sops --config .sops.yaml --decrypt secrets.enc.yaml
```

## Key Management Best Practices

1. **Never commit private keys** - Only commit `.enc.yaml` files
2. **Use multiple recipients** - Add multiple team members' public keys
2. **Rotate keys periodically** - Re-encrypt with new keys annually
3. **Backup private keys** - Store in 1Password, Bitwarden, or hardware security module
4. **Use different keys per environment** - Separate dev/staging/prod keys

## Integration with Docker

```dockerfile
# Dockerfile
# Decrypt at build time (not recommended for production)
# ARG SOPS_AGE_KEY_FILE
# RUN sops --config .sops.yaml --decrypt secrets.enc.yaml > .env

# Better: Decrypt at runtime in entrypoint
# ENTRYPOINT ["sh", "-c", "sops --config .sops.yaml --decrypt secrets.enc.yaml > .env && exec dumb-init -- node dist/server.js"]
```

## GitHub Actions Integration

```yaml
# .github/workflows/secrets.yml
name: Secrets Management

on:
  workflow_dispatch:
    inputs:
      action:
        description: 'Action to perform'
        required: true
        type: choice
        options:
          - encrypt
          - decrypt
          - rotate

jobs:
  secrets:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install sops and age
        run: |
          sudo apt-get update && sudo apt-get install -y age
          curl -sSL https://github.com/getsops/sops/releases/download/v3.8.1/sops-v3.8.1.linux.amd64 -o /usr/local/bin/sops
          chmod +x /usr/local/bin/sops
      
      - name: Decrypt secrets
        if: github.event.inputs.action == 'decrypt'
        run: sops --config .sops.yaml --decrypt secrets.enc.yaml > secrets.yaml
      
      - name: Encrypt secrets
        if: github.event.inputs.action == 'encrypt'
        run: sops --config .sops.yaml --encrypt --in-place secrets.yaml
      
      - name: Rotate keys
        if: github.event.inputs.action == 'rotate'
        run: |
          age-keygen -o age.key.new
          # Update .sops.yaml with new public key
          sops --config .sops.yaml --rotate --in-place secrets.enc.yaml
```

## Directory Structure
```
├── .sops.yaml              # SOPS configuration
├── age.key                 # Private key (gitignored, backed up securely)
├── age.key.pub             # Public key (can be committed)
├── secrets.enc.yaml        # Encrypted secrets (committed)
├── .env                    # Decrypted at runtime (gitignored)
├── .env.example            # Template (committed)
└── .github/workflows/
    └── secrets.yml         # Rotation workflow
```

## Verification
```bash
# Verify encryption works
sops --config .sops.yaml --decrypt secrets.enc.yaml | head -5

# Verify file is encrypted
head -1 secrets.enc.yaml
# Should show: sops: ...
```