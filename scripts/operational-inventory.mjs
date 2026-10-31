// state: draft | engine-generated
// Static evidence only. Import reachability does not prove execution or production readiness.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const root = process.cwd();
const destination = 'docs/audits/INVENTARIO-OPERATIVO-2026-10-24.json';
const omitted = new Set([
  '.git',
  'node_modules',
  '.netlify',
  '.vercel',
  'dist',
  'coverage',
  'artifacts',
  '.venv',
  'venv',
  '__pycache__',
  'target',
]);
const sensitive =
  /(?:^\.env(?:\.|$)|\.(?:pem|key|p12|pfx|keystore)$|credentials|secrets?\.(?:json|ya?ml)$)/i;
const files = [];
let excludedSensitive = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (omitted.has(entry.name)) continue;
    const file = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.isFile()) {
      if (sensitive.test(entry.name) && entry.name !== '.env.example') {
        excludedSensitive++;
        continue;
      }
      if (file === destination) continue;
      files.push(file);
    }
  }
}
walk('');
files.sort();
const known = new Set(files);
const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
const cache = ts.createModuleResolutionCache(root, (name) => name, parsed.options);
const nodes = new Map();
const code = /\.(?:[cm]?[jt]sx?)$/;
const unresolved = [];
const routes = [];
const functions = [];
const markers =
  /\b(?:mock|placeholder|simulated|simulation|stub|not_implemented|not_configured)\b/gi;
for (const file of files.filter((file) => code.test(file))) {
  const text = fs.readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const edges = [];
  let markerCount = 0;
  for (const _ of text.matchAll(markers)) markerCount++;
  function addImport(specifier, typeOnly, node) {
    if (!specifier.startsWith('.')) return;
    const resolved = ts.resolveModuleName(
      specifier,
      path.join(root, file),
      parsed.options,
      ts.sys,
      cache
    ).resolvedModule;
    let target = resolved
      ? path.relative(root, resolved.resolvedFileName).split(path.sep).join('/')
      : null;
    if (!target) {
      const raw = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
      target =
        [raw, `${raw}.js`, `${raw}.ts`, `${raw}/index.ts`, `${raw}/index.js`].find((candidate) =>
          known.has(candidate)
        ) ?? null;
    }
    const line = ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
    if (target) edges.push({ target, typeOnly, line });
    else unresolved.push({ file, line, specifier, typeOnly });
  }
  function visit(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const typeOnly =
        !!clause?.isTypeOnly ||
        (!!clause &&
          !clause.name &&
          !!clause.namedBindings &&
          ts.isNamedImports(clause.namedBindings) &&
          clause.namedBindings.elements.length > 0 &&
          clause.namedBindings.elements.every((element) => element.isTypeOnly));
      addImport(node.moduleSpecifier.text, typeOnly, node);
    }
    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      addImport(node.moduleSpecifier.text, !!node.isTypeOnly, node);
    if (
      ts.isCallExpression(node) &&
      node.arguments.length &&
      ts.isStringLiteral(node.arguments[0]) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    )
      addImport(node.arguments[0].text, false, node);
    if (
      (ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isGetAccessorDeclaration(node) ||
        ts.isSetAccessorDeclaration(node)) &&
      node.body
    ) {
      functions.push({
        file,
        name: node.name?.getText(ast) ?? '(anonymous)',
        line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1,
      });
    }
    if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    )
      functions.push({
        file,
        name: node.name.getText(ast),
        line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1,
      });
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      /^(?:app|router)$/.test(node.expression.expression.getText(ast)) &&
      /^(?:get|post|put|patch|delete|head|options|all)$/.test(node.expression.name.text) &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    )
      routes.push({
        file,
        method: node.expression.name.text.toUpperCase(),
        path: node.arguments[0].text,
        line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1,
      });
    ts.forEachChild(node, visit);
  }
  visit(ast);
  nodes.set(file, { edges, markerCount });
}
function closure(entries) {
  const found = new Set();
  function visit(file) {
    if (found.has(file) || !known.has(file)) return;
    found.add(file);
    for (const edge of nodes.get(file)?.edges ?? []) if (!edge.typeOnly) visit(edge.target);
  }
  for (const entry of entries) visit(entry);
  return found;
}
const server = closure(['src/server.ts', 'netlify/functions/app.mts']);
const browser = closure(['src/ui/app.js', 'src/ui/chat-plus.js']);
const inTests = closure(files.filter((file) => /^(?:test|tests)\/.*\.[cm]?[jt]sx?$/.test(file)));
const counts = {};
const fileEntries = files.map((file) => {
  const bytes = fs.readFileSync(file);
  const area = file.startsWith('src/') ? file.split('/').slice(0, 2).join('/') : file.split('/')[0];
  let role = server.has(file)
    ? 'server-import-reachable'
    : browser.has(file)
      ? 'browser-entry-or-import'
      : code.test(file) && file.startsWith('src/')
        ? 'no-runtime-import-path-found'
        : /^(?:test|tests)\//.test(file)
          ? 'test'
          : file.startsWith('docs/')
            ? 'documentation'
            : /\.(?:java|rs|py)$/.test(file)
              ? 'separate-runtime-source'
              : /\.(?:json|jsonl|csv|sql|ya?ml|mp4|jpe?g|png|svg|txt|md|docx)$/.test(file)
                ? 'data-or-configuration'
                : 'other';
  let jsonValidity;
  if (file.endsWith('.json')) {
    try {
      JSON.parse(bytes.toString('utf8'));
      jsonValidity = 'valid';
    } catch {
      jsonValidity = 'invalid';
    }
  }
  counts[role] = (counts[role] ?? 0) + 1;
  return {
    file,
    area,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    role,
    referencedByTestImport: inTests.has(file),
    markerCount: nodes.get(file)?.markerCount ?? 0,
    ...(jsonValidity ? { jsonValidity } : {}),
  };
});
for (const item of functions)
  item.runtimeImportReachable = server.has(item.file) || browser.has(item.file);
for (const item of routes) item.runtimeImportReachable = server.has(item.file);
const duplicateMap = new Map();
for (const file of fileEntries.filter((entry) => code.test(entry.file) && entry.bytes > 0)) {
  const group = duplicateMap.get(file.sha256) ?? [];
  group.push(file.file);
  duplicateMap.set(file.sha256, group);
}
const exactDuplicateCodeGroups = [...duplicateMap.values()].filter((group) => group.length > 1);
const summary = {
  files: files.length,
  exactDuplicateCodeGroups: exactDuplicateCodeGroups.length,
  codeFilesInDuplicateGroups: exactDuplicateCodeGroups.reduce(
    (sum, group) => sum + group.length,
    0
  ),
  bytes: fileEntries.reduce((sum, file) => sum + file.bytes, 0),
  roles: counts,
  sourceCodeFiles: files.filter((file) => file.startsWith('src/') && code.test(file)).length,
  serverImportReachableFiles: server.size,
  browserEntryOrImportFiles: browser.size,
  functionDeclarations: functions.length,
  sourceFunctionDeclarations: functions.filter((item) => item.file.startsWith('src/')).length,
  functionsInRuntimeReachableFiles: functions.filter((item) => item.runtimeImportReachable).length,
  literalRouteRegistrations: routes.length,
  routeRegistrationsInReachableFiles: routes.filter((item) => item.runtimeImportReachable).length,
  unresolvedRelativeImports: unresolved.length,
  unresolvedRelativeImportsInRuntimeFiles: unresolved.filter(
    (item) => server.has(item.file) || browser.has(item.file)
  ).length,
  invalidJsonFiles: fileEntries
    .filter((item) => item.jsonValidity === 'invalid')
    .map((item) => item.file),
  excludedSensitiveFiles: excludedSensitive,
};
const report = {
  state: 'draft',
  authorship: 'engine-generated',
  generatedAt: new Date().toISOString(),
  method:
    'TypeScript AST + relative import closure + SHA-256 file inventory; no code execution or external calls.',
  limits: [
    'Import reachability is file-level evidence, not proof that each function executes or is authorized.',
    'Type-only imports do not add runtime edges. Conditional and literal dynamic imports add possible paths, not confirmed execution.',
    'Computed imports, dependency injection, inline HTML scripts, bundler transformations and Python/Java/Rust call graphs are not resolved.',
    'Marker counts are review candidates and can occur in legitimate tests or policy text; they are not automatically defects.',
    'No file contents, secret values, environment values or data records are exported.',
    'Hidden generated folders, dependencies, binaries in build outputs, credentials and environment files are excluded; .env.example contributes metadata only.',
    'JSON syntax validity and file hashes do not establish semantic validity, ingestion, provenance or persistence.',
  ],
  summary,
  roots: {
    server: ['src/server.ts', 'netlify/functions/app.mts'],
    browser: ['src/ui/app.js', 'src/ui/chat-plus.js'],
  },
  exactDuplicateCodeGroups,
  files: fileEntries,
  functions,
  routes,
  unresolvedRelativeImports: unresolved.map((item) => ({
    ...item,
    runtimeImportReachable: server.has(item.file) || browser.has(item.file),
  })),
};
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
