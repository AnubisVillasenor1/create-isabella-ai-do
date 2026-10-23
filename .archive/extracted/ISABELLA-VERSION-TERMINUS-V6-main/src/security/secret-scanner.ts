/**
 * Secret Scanner - Detecta secretos en código, configuración y logs
 * state: engine-generated
 */

import { createHash } from "node:crypto";

export interface SecretMatch {
  readonly type: string;
  readonly value: string;
  readonly file: string;
  readonly line: number;
  readonly severity: "critical" | "high" | "medium" | "low";
}

export interface ScanResult {
  readonly matches: SecretMatch[];
  readonly summary: {
    readonly critical: number;
    readonly high: number;
    readonly medium: number;
    readonly low: number;
  };
}

const SECRET_PATTERNS: Array<{ pattern: RegExp; type: string; severity: "critical" | "high" | "medium" | "low" }> = [
  // AWS
  { pattern: /AKIA[0-9A-Z]{16}/g, type: "AWS_ACCESS_KEY_ID", severity: "critical" },
  { pattern: /[A-Za-z0-9/+=]{40}/g, type: "AWS_SECRET_ACCESS_KEY", severity: "critical" },
  
  // GitHub
  { pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g, type: "GITHUB_TOKEN", severity: "critical" },
  { pattern: /github_pat_[A-Za-z0-9_]{82,}/g, type: "GITHUB_PAT", severity: "critical" },
  
  // Stripe
  { pattern: /sk_live_[A-Za-z0-9]{24,}/g, type: "STRIPE_SECRET_KEY", severity: "critical" },
  { pattern: /sk_test_[A-Za-z0-9]{24,}/g, type: "STRIPE_TEST_KEY", severity: "high" },
  { pattern: /pk_live_[A-Za-z0-9]{24,}/g, type: "STRIPE_PUBLISHABLE_KEY", severity: "medium" },
  
  // OpenAI
  { pattern: /sk-[A-Za-z0-9]{48,}/g, type: "OPENAI_API_KEY", severity: "critical" },
  
  // Anthropic
  { pattern: /sk-ant-[A-Za-z0-9_-]{95,}/g, type: "ANTHROPIC_API_KEY", severity: "critical" },
  
  // Generic API keys
  { pattern: /[A-Za-z0-9_-]{32,}/g, type: "GENERIC_API_KEY", severity: "medium" },
  { pattern: /api[_-]?key["\s]*[:=]["\s]*[A-Za-z0-9_-]{16,}/gi, type: "API_KEY_ASSIGNMENT", severity: "high" },
  
  // Database URLs
  { pattern: /postgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@[^\s]+/gi, type: "POSTGRES_URL_WITH_CREDENTIALS", severity: "critical" },
  { pattern: /mysql:\/\/[^:\s]+:[^@\s]+@[^\s]+/gi, type: "MYSQL_URL_WITH_CREDENTIALS", severity: "critical" },
  { pattern: /mongodb(?:\+srv)?:\/\/[^:\s]+:[^@\s]+@[^\s]+/gi, type: "MONGODB_URL_WITH_CREDENTIALS", severity: "critical" },
  { pattern: /redis:\/\/[^:\s]+:[^@\s]+@[^\s]+/gi, type: "REDIS_URL_WITH_CREDENTIALS", severity: "critical" },
  
  // JWT
  { pattern: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, type: "JWT_TOKEN", severity: "high" },
  
  // Private keys
  { pattern: /-----BEGIN (?:RSA|EC|DSA|OPENSSH) PRIVATE KEY-----/g, type: "PRIVATE_KEY", severity: "critical" },
  { pattern: /-----BEGIN CERTIFICATE-----/g, type: "CERTIFICATE", severity: "high" },
  
  // Generic secrets
  { pattern: /(?:password|passwd|pwd)["\s]*[:=]["\s]*[^\s"']{8,}/gi, type: "PASSWORD_IN_CODE", severity: "high" },
  { pattern: /(?:secret|token)["\s]*[:=]["\s]*[A-Za-z0-9_-]{16,}/gi, type: "SECRET_IN_CODE", severity: "high" },
];

const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.git/,
  /dist\//,
  /build\//,
  /\.d\.ts$/,
  /\.map$/,
  /coverage\//,
  /\.min\.js$/,
  /package-lock\.json$/,
  /pnpm-lock\.yaml$/,
  /yarn\.lock$/,
  /\.log$/,
];

const EXCLUDE_LINE_PATTERNS = [
  /^\s*\/\//,  // Comments
  /^\s*\/\*/,  // Block comments start
  /\*\/\s*$/,  // Block comments end
  /console\.(log|warn|error)\(/,  // Console logs
  /expect\(.*toBe/,  // Test expectations
  /toEqual\(/,  // Test matchers
  /toBe\(/,     // Test matchers
  /toContain\(/, // Test matchers
  /\.toHave/,   // Test matchers
  /\.toMatch/,  // Test matchers
  /\.toThrow/,  // Test matchers
  /mockReturnValue/, // Test mocks
  /mockResolvedValue/, // Test mocks
  /jest\.fn/,   // Test mocks
  /vi\.fn/,     // Vitest mocks
  /cy\.request/, // Cypress
  /cy\.intercept/, // Cypress
];

export class SecretScanner {
  private readonly customPatterns: typeof SECRET_PATTERNS = [];
  private readonly excludePatterns: RegExp[] = EXCLUDE_PATTERNS;
  private readonly excludeLinePatterns: RegExp[] = EXCLUDE_LINE_PATTERNS;

  addCustomPattern(pattern: RegExp, type: string, severity: "critical" | "high" | "medium" | "low"): void {
    this.customPatterns.push({ pattern, type, severity });
  }

  addExcludePattern(pattern: RegExp): void {
    this.excludePatterns.push(pattern);
  }

  addExcludeLinePattern(pattern: RegExp): void {
    this.excludeLinePatterns.push(pattern);
  }

  async scanFile(filePath: string, content: string): Promise<SecretMatch[]> {
    if (this.shouldExcludeFile(filePath)) return [];
    
    const lines = content.split("\n");
    const matches: SecretMatch[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;
      
      if (this.shouldExcludeLine(line)) continue;
      
      const allPatterns = [...SECRET_PATTERNS, ...this.customPatterns];
      
      for (const { pattern, type, severity } of allPatterns) {
        // Reset regex lastIndex for global patterns
        const regex = new RegExp(pattern.source, pattern.flags);
        let match: RegExpExecArray | null;
        
        while ((match = regex.exec(line)) !== null) {
          const value = match[0];
          
          // Skip if it looks like a test expectation or mock
          if (this.isLikelyFalsePositive(line, value)) continue;
          
          matches.push({
            type,
            value: this.maskSecret(value),
            file: filePath,
            line: lineNumber,
            severity,
          });
          
          if (!regex.global) break;
        }
      }
    }
    
    return matches;
  }

  private shouldExcludeFile(filePath: string): boolean {
    return this.excludePatterns.some(pattern => pattern.test(filePath));
  }

  private shouldExcludeLine(line: string): boolean {
    const trimmed = line.trim();
    return this.excludeLinePatterns.some(pattern => pattern.test(trimmed));
  }

  private isLikelyFalsePositive(line: string, value: string): boolean {
    // Check if it's in a test file context
    const testPatterns = [
      /\.test\.ts$/,
      /\.spec\.ts$/,
      /__tests__/,
      /__mocks__/,
      /mocks?\//,
      /fixtures?\//,
      /test[-_]?data/,
      /fixtures?/,
    ];
    
    // Check if line contains test-related keywords
    const testKeywords = [
      "expect", "toBe", "toEqual", "toContain", "toMatch", "toHave",
      "mock", "spyOn", "jest.fn", "vi.fn", "sinon", "stub", "mockReturnValue",
      "mockResolvedValue", "mockRejectedValue", "mockImplementation",
    ];
    
    const lowerLine = line.toLowerCase();
    const hasTestKeyword = testKeywords.some(kw => lowerLine.includes(kw.toLowerCase()));
    
    // Check if value looks like a test constant
    const testValuePatterns = [
      /^test[_-]/i,
      /^mock[_-]/i,
      /^fake[_-]/i,
      /^dummy[_-]/i,
      /^placeholder[_-]/i,
      /^example[_-]/i,
      /^sample[_-]/i,
      /^demo[_-]/i,
      /^temp[_-]/i,
      /^temp$/i,
      /^xxx+$/i,
      /^yyy+$/i,
      /^zzz+$/i,
      /^123+$/,
      /^abc+$/i,
    ];
    
    const isTestValue = testValuePatterns.some(p => p.test(value));
    
    return hasTestKeyword || isTestValue;
  }

  private maskSecret(secret: string): string {
    if (secret.length <= 8) return "*".repeat(secret.length);
    return secret.slice(0, 4) + "*".repeat(secret.length - 8) + secret.slice(-4);
  }

  async scanDirectory(dirPath: string): Promise<ScanResult> {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    
    const allMatches: SecretMatch[] = [];
    
    async function scanDir(currentPath: string): Promise<void> {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        
        if (this.shouldExcludeFile(fullPath)) continue;
        
        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else if (entry.isFile() && this.isScannableFile(entry.name)) {
          try {
            const content = await fs.readFile(fullPath, "utf-8");
            const matches = await this.scanFile(fullPath, content);
            allMatches.push(...matches);
          } catch (error) {
            // Skip files that can't be read as UTF-8
          }
        }
      }
    }
    
    await scanDir(dirPath);
    
    const summary = {
      critical: allMatches.filter(m => m.severity === "critical").length,
      high: allMatches.filter(m => m.severity === "high").length,
      medium: allMatches.filter(m => m.severity === "medium").length,
      low: allMatches.filter(m => m.severity === "low").length,
    };
    
    return { matches: allMatches, summary };
  }

  private isScannableFile(fileName: string): boolean {
    const scannableExtensions = [
      ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
      ".json", ".yaml", ".yml", ".toml",
      ".env", ".env.*", ".config.*",
      ".md", ".txt",
      ".sh", ".bash", ".zsh",
      ".py", ".rb", ".go", ".rs", ".java",
      ".xml", ".html", ".css", ".scss", ".sass",
      ".sql", ".graphql", ".gql",
      ".yaml", ".yml",
      "Dockerfile", "dockerfile",
      "Makefile", "makefile",
    ];
    
    return scannableExtensions.some(ext => 
      fileName.endsWith(ext) || fileName === ext.replace(".", "")
    );
  }

  generateReport(result: ScanResult, format: "json" | "sarif" | "text" = "text"): string {
    if (format === "json") {
      return JSON.stringify(result, null, 2);
    }
    
    if (format === "sarif") {
      return this.generateSARIF(result);
    }
    
    return this.generateTextReport(result);
  }

  private generateTextReport(result: ScanResult): string {
    const lines = [
      "═══════════════════════════════════════",
      "SECRET SCAN REPORT",
      "═══════════════════════════════════════",
      `Critical: ${result.summary.critical}`,
      `High:     ${result.summary.high}`,
      `Medium:   ${result.summary.medium}`,
      `Low:      ${result.summary.low}`,
      `Total:    ${result.matches.length}`,
      "",
    ];
    
    for (const match of result.matches) {
      lines.push(
        `[${match.severity.toUpperCase()}] ${match.type}`,
        `  File: ${match.file}:${match.line}`,
        `  Value: ${match.value}`,
        "",
      );
    }
    
    return lines.join("\n");
  }

  private generateSARIF(result: ScanResult): string {
    const sarif = {
      version: "2.1.0",
      $schema: "https://schemastore.org/schemas/json/sarif-2.1.0.json",
      runs: [{
        tool: {
          driver: {
            name: "Isabella Secret Scanner",
            version: "1.0.0",
            informationUri: "https://github.com/OsoPanda1/ISABELLA-VERSION-TERMINUS-V6",
            rules: SECRET_PATTERNS.map(p => ({
              id: p.type,
              name: p.type,
              shortDescription: { text: `Detects ${p.type}` },
              defaultConfiguration: { level: p.severity === "critical" ? "error" : p.severity === "high" ? "error" : "warning" },
            })),
          },
        },
        results: result.matches.map(m => ({
          ruleId: m.type,
          level: m.severity === "critical" || m.severity === "high" ? "error" : "warning",
          message: { text: `${m.type}: ${m.value}` },
          locations: [{
            physicalLocation: {
              artifactLocation: { uri: m.file },
              region: { startLine: m.line },
            },
          }],
        })),
      }],
    };
    
    return JSON.stringify(sarif, null, 2);
  }
}

export const secretScanner = new SecretScanner();