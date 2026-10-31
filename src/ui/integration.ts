/**
 * React Frontend Integration Layer Ω
 * state: engine-generated
 * Part of ISABELLA-Q Ω Cognitive Architecture
 *
 * Integrates React components from:
 * - isabella-ai-genesis (isabella, ui, navigation, intro)
 * - isabella-s-core-intelligence (core, hooks, lib)
 *
 * Provides server-side rendering, hydration, and API integration
 */

import { EventEmitter } from 'node:events';

export type ComponentCategory =
  'isabella' | 'ui' | 'navigation' | 'intro' | 'core' | 'hooks' | 'lib';

export interface ComponentManifest {
  readonly category: ComponentCategory;
  readonly name: string;
  readonly path: string;
  readonly exports: string[];
  readonly dependencies: string[];
  readonly version: string;
}

export interface UIRegistry {
  readonly components: Map<string, ComponentManifest>;
  readonly categories: Map<ComponentCategory, string[]>;
}

export interface RenderContext {
  readonly requestId: string;
  readonly userId?: string;
  readonly sessionId?: string;
  readonly locale: string;
  readonly theme: 'light' | 'dark' | 'system';
  readonly capabilities: string[];
  readonly data: Record<string, unknown>;
}

export interface RenderedPage {
  readonly html: string;
  readonly head: string;
  readonly scripts: string[];
  readonly styles: string[];
  readonly hydrationData: Record<string, unknown>;
  readonly metadata: PageMetadata;
}

export interface PageMetadata {
  readonly title: string;
  readonly description: string;
  readonly canonicalUrl?: string;
  readonly ogTags: Record<string, string>;
  readonly twitterTags: Record<string, string>;
  readonly jsonLd?: Record<string, unknown>;
}

const ATTRIBUTE_NAME = /^[A-Za-z_:][-A-Za-z0-9_:.]*$/;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** JSON that is safe to embed inside an inline <script>: `</script>` and HTML comments cannot be formed. */
export function safeJsonForScript(value: unknown): string {
  return (JSON.stringify(value) ?? 'null')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** Shape of a loaded UI module: named exports only (no implicit `any`). */
export type ComponentModule = Record<string, unknown>;

/**
 * Component Loader - Dynamic imports with caching
 */
export class ComponentLoader extends EventEmitter {
  private manifests: Map<string, ComponentManifest> = new Map();
  private moduleCache: Map<string, Promise<ComponentModule>> = new Map();
  private categories: Map<ComponentCategory, Set<string>> = new Map();

  registerManifest(manifest: ComponentManifest): void {
    this.manifests.set(manifest.name, manifest);

    const categorySet = this.categories.get(manifest.category) || new Set();
    categorySet.add(manifest.name);
    this.categories.set(manifest.category, categorySet);

    this.emit('manifest:registered', manifest);
  }

  async loadComponent(category: ComponentCategory, name: string): Promise<ComponentModule> {
    const manifest = this.manifests.get(name);
    if (!manifest || manifest.category !== category) {
      throw new Error(`COMPONENT_NOT_FOUND: ${category}/${name}`);
    }

    const cacheKey = `${category}/${name}`;
    let modulePromise = this.moduleCache.get(cacheKey);

    if (!modulePromise) {
      modulePromise = this.importModule(manifest.path);
      this.moduleCache.set(cacheKey, modulePromise);
    }

    try {
      const module = await modulePromise;
      this.emit('component:loaded', { category, name, exports: Object.keys(module) });
      return module;
    } catch (error) {
      this.moduleCache.delete(cacheKey);
      throw error;
    }
  }

  private async importModule(path: string): Promise<ComponentModule> {
    // In production, would use dynamic import with proper bundler
    // For now, return mock module structure
    return {
      default: () => null,
      ...this.createMockExports(path),
    };
  }

  private createMockExports(path: string): ComponentModule {
    // Generate mock exports based on path
    const exports: ComponentModule = {};

    if (path.includes('ui')) {
      exports.Button = () => null;
      exports.Card = () => null;
      exports.Input = () => null;
      exports.Modal = () => null;
      exports.Dropdown = () => null;
      exports.Tooltip = () => null;
      exports.Avatar = () => null;
      exports.Badge = () => null;
      exports.Separator = () => null;
      exports.Skeleton = () => null;
    }

    if (path.includes('navigation')) {
      exports.NavBar = () => null;
      exports.Sidebar = () => null;
      exports.Breadcrumb = () => null;
      exports.Tabs = () => null;
      exports.Pagination = () => null;
    }

    if (path.includes('intro')) {
      exports.Hero = () => null;
      exports.FeatureGrid = () => null;
      exports.Testimonial = () => null;
      exports.CTA = () => null;
    }

    if (path.includes('isabella')) {
      exports.CognitiveDock = () => null;
      exports.CommandCenter = () => null;
      exports.ThinkingIndicator = () => null;
      exports.MemoryVisualizer = () => null;
      exports.ExpertRouter = () => null;
    }

    if (path.includes('core')) {
      exports.useCognitiveState = () => ({});
      exports.useMemoryMesh = () => ({});
      exports.useExpertRouter = () => ({});
      exports.useGovernance = () => ({});
    }

    if (path.includes('hooks')) {
      exports.useWebSocket = () => ({});
      exports.useSSE = () => ({});
      exports.useLocalStorage = () => ({});
      exports.useDebounce = () => ({});
    }

    if (path.includes('lib')) {
      exports.cn = (...args: unknown[]) => args.filter(Boolean).join(' ');
      exports.formatDate = (date: Date) => date.toISOString();
      exports.generateId = () => Math.random().toString(36).slice(2);
    }

    return exports;
  }

  getManifest(name: string): ComponentManifest | undefined {
    return this.manifests.get(name);
  }

  getCategoryComponents(category: ComponentCategory): ComponentManifest[] {
    const names = this.categories.get(category) || new Set();
    return Array.from(names)
      .map((name) => this.manifests.get(name)!)
      .filter(Boolean);
  }

  getAllManifests(): ComponentManifest[] {
    return Array.from(this.manifests.values());
  }
}

/**
 * Server-Side Renderer
 */
export class SSRRenderer extends EventEmitter {
  private loader: ComponentLoader;
  private templateCache: Map<string, string> = new Map();

  constructor(loader: ComponentLoader) {
    super();
    this.loader = loader;
    this.loadBaseTemplate();
  }

  private loadBaseTemplate(): void {
    // Base HTML template with hydration points
    this.templateCache.set(
      'base',
      `
<!DOCTYPE html>
<html lang="{{locale}}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}}</title>
  <meta name="description" content="{{description}}">
  {{#each headTags}}
  <{{tag}} {{#each attributes}}{{@key}}="{{this}}" {{/each}}>{{/each}}
  {{/each}}
  {{#each styles}}
  <link rel="stylesheet" href="{{this}}">
  {{/each}}
  {{#each scripts}}
  <script src="{{this}}" defer></script>
  {{/each}}
  <script>
    window.__ISABELLA_HYDRATION__ = {{{hydrationData}}};
    window.__ISABELLA_CONFIG__ = {{{config}}};
  </script>
</head>
<body class="{{theme}}">
  <div id="root">{{{html}}}</div>
  <script>
    (function() {
      const data = window.__ISABELLA_HYDRATION__;
      if (data && data.hydrate) {
        import('/hydration.js').then(m => m.hydrate(data));
      }
    })();
  </script>
</body>
</html>
    `
    );
  }

  async renderPage(
    pageName: string,
    context: RenderContext,
    components: Array<{ category: ComponentCategory; name: string; props: Record<string, unknown> }>
  ): Promise<RenderedPage> {
    const startTime = Date.now();

    // Load all required components
    const loadedComponents = await Promise.all(
      components.map(async ({ category, name, props }) => {
        const module = await this.loader.loadComponent(category, name);
        return { module, props, name, category };
      })
    );

    // Render components to HTML strings
    const renderedComponents = loadedComponents.map(({ module, props, name }) => {
      // In production, would use ReactDOMServer.renderToString
      return this.mockRender(module, name, props, context);
    });

    // Assemble page
    const html = this.assembleHTML(pageName, renderedComponents, context);
    const head = this.generateHead(context);
    const hydrationData = this.prepareHydrationData(loadedComponents, context);

    const result: RenderedPage = {
      html,
      head,
      scripts: ['/bundle.js', '/hydration.js'],
      styles: ['/styles/crystal-omega.css'],
      hydrationData,
      metadata: this.generateMetadata(pageName, context),
    };

    this.emit('page:rendered', { pageName, duration: Date.now() - startTime });
    return result;
  }

  private mockRender(
    module: ComponentModule,
    name: string,
    props: Record<string, unknown>,
    context: RenderContext
  ): string {
    // Mock rendering - in production uses ReactDOMServer. Every interpolated value is escaped:
    // component names and props can originate from manifests or request data.
    const propsStr = Object.entries(props)
      .filter(([k]) => ATTRIBUTE_NAME.test(k))
      .map(([k, v]) => `${k}="${escapeHtml(JSON.stringify(v) ?? 'null')}"`)
      .join(' ');
    const category =
      Object.keys(module).find((k) => {
        const exported = module[k];
        return typeof exported === 'function' && exported.name === name;
      }) ?? 'unknown';

    return `<div data-component="${escapeHtml(name)}" data-category="${escapeHtml(category)}" ${propsStr}><!-- ${escapeHtml(name).replace(/--/g, '- -')} --></div>`;
  }

  private assembleHTML(pageName: string, components: string[], context: RenderContext): string {
    const layout = this.getLayout(pageName);
    // Function replacer: `$&`/`$1` sequences inside component HTML must not be interpreted as patterns.
    // Slots after the first stay empty instead of leaking the literal `{{content}}` marker.
    const joined = components.join('\n');
    return layout
      .replace('{{content}}', () => joined)
      .split('{{content}}')
      .join('');
  }

  private getLayout(pageName: string): string {
    // Page-specific layouts
    const layouts: Record<string, string> = {
      home: `
        <header>{{content}}</header>
        <main>{{content}}</main>
        <footer>{{content}}</footer>
      `,
      dashboard: `
        <div class="dashboard-layout">
          <nav class="sidebar">{{content}}</nav>
          <main class="main-content">{{content}}</main>
        </div>
      `,
      cognitive: `
        <div class="cognitive-interface">
          <div class="cognitive-dock">{{content}}</div>
          <div class="command-center">{{content}}</div>
        </div>
      `,
    };

    return layouts[pageName] || `<div class="page">{{content}}</div>`;
  }

  private generateHead(context: RenderContext): string {
    return `
      <meta name="theme-color" content="#0a0a0f">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    `;
  }

  private prepareHydrationData(
    components: Array<{
      module: ComponentModule;
      props: Record<string, unknown>;
      name: string;
      category: ComponentCategory;
    }>,
    context: RenderContext
  ): Record<string, unknown> {
    return {
      components: components.map((c) => ({
        name: c.name,
        category: c.category,
        props: c.props,
      })),
      context: {
        userId: context.userId,
        sessionId: context.sessionId,
        locale: context.locale,
        theme: context.theme,
        capabilities: context.capabilities,
      },
      timestamp: Date.now(),
    };
  }

  private generateMetadata(pageName: string, context: RenderContext): PageMetadata {
    const titles: Record<string, string> = {
      home: 'ISABELLA-Q Ω | Cognitive Sovereign Runtime',
      dashboard: 'Dashboard | ISABELLA-Q Ω',
      cognitive: 'Cognitive Interface | ISABELLA-Q Ω',
      governance: 'Governance Console | ISABELLA-Q Ω',
      learning: 'Learning Lab | ISABELLA-Q Ω',
      security: 'Security Center | ISABELLA-Q Ω',
    };

    return {
      title: titles[pageName] || 'ISABELLA-Q Ω',
      description: 'ISABELLA-Q Ω - Quantum-Ready Cognitive Sovereign Runtime',
      canonicalUrl: `https://isabella.ai/${pageName}`,
      ogTags: {
        'og:title': titles[pageName] || 'ISABELLA-Q Ω',
        'og:description': 'Quantum-Ready Cognitive Sovereign Runtime',
        'og:type': 'website',
        'og:url': `https://isabella.ai/${pageName}`,
      },
      twitterTags: {
        'twitter:card': 'summary_large_image',
        'twitter:title': titles[pageName] || 'ISABELLA-Q Ω',
        'twitter:description': 'Quantum-Ready Cognitive Sovereign Runtime',
      },
    };
  }
}

/**
 * Client-Side Hydration Manager
 */
export class HydrationManager extends EventEmitter {
  private hydratedComponents: Set<string> = new Set();
  private pendingHydration: Map<string, HydrationTask> = new Map();

  async hydrate(
    container: Element,
    hydrationData: Record<string, unknown>,
    loader: ComponentLoader
  ): Promise<void> {
    const components = hydrationData.components as Array<{
      name: string;
      category: ComponentCategory;
      props: Record<string, unknown>;
    }>;

    for (const { name, category, props } of components) {
      const componentId = `${category}/${name}`;

      if (this.hydratedComponents.has(componentId)) continue;

      const task: HydrationTask = {
        componentId,
        container: this.findContainer(container, name),
        category,
        name,
        props,
        status: 'pending',
        startTime: Date.now(),
      };

      this.pendingHydration.set(componentId, task);

      try {
        await this.hydrateComponent(task, loader);
        this.hydratedComponents.add(componentId);
        task.status = 'completed';
        this.emit('component:hydrated', task);
      } catch (error) {
        task.status = 'failed';
        task.error = String(error);
        this.emit('component:hydration_failed', task);
      }
    }
  }

  private findContainer(root: Element, componentName: string): Element | null {
    return root.querySelector(`[data-component="${componentName.replace(/["\\]/g, '\\$&')}"]`);
  }

  private async hydrateComponent(task: HydrationTask, loader: ComponentLoader): Promise<void> {
    if (!task.container) {
      throw new Error(`CONTAINER_NOT_FOUND: ${task.componentId}`);
    }

    const module = await loader.loadComponent(task.category, task.name);
    const Component = module.default || module[task.name];

    if (!Component) {
      throw new Error(`COMPONENT_EXPORT_NOT_FOUND: ${task.componentId}`);
    }

    // In production, would use ReactDOM.hydrateRoot
    // For now, simulate hydration
    task.container.setAttribute('data-hydrated', 'true');
    task.container.setAttribute('data-hydration-time', String(Date.now() - task.startTime));
  }

  getHydrationStatus(): Array<{ componentId: string; status: string; duration?: number }> {
    return Array.from(this.pendingHydration.values()).map((t) => ({
      componentId: t.componentId,
      status: t.status,
      duration: t.status === 'completed' ? Date.now() - t.startTime : undefined,
    }));
  }
}

interface HydrationTask {
  componentId: string;
  container: Element | null;
  category: ComponentCategory;
  name: string;
  props: Record<string, unknown>;
  status: 'pending' | 'completed' | 'failed';
  startTime: number;
  error?: string;
}

/**
 * API Integration Layer - Connects UI to backend services
 */
export class APIIntegration extends EventEmitter {
  private baseUrl: string;
  private authToken?: string;
  private wsConnections: Map<string, WebSocket> = new Map();

  constructor(baseUrl: string = '') {
    super();
    this.baseUrl = baseUrl;
  }

  setAuthToken(token: string): void {
    this.authToken = token;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (this.authToken) {
      requestHeaders['Authorization'] = `Bearer ${this.authToken}`;
    }

    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`API_ERROR: ${error.message || response.statusText}`);
    }

    return response.json();
  }

  // Identity & Auth APIs
  async login(credentials: {
    email: string;
    password: string;
  }): Promise<{ token: string; user: Record<string, unknown> }> {
    return this.request('POST', '/api/auth/login', credentials);
  }

  async register(data: {
    email: string;
    password: string;
    name: string;
  }): Promise<{ user: Record<string, unknown> }> {
    return this.request('POST', '/api/auth/register', data);
  }

  async refreshToken(): Promise<{ token: string }> {
    return this.request('POST', '/api/auth/refresh');
  }

  // Cognitive APIs
  async queryRAG(query: string, config?: unknown): Promise<unknown> {
    return this.request('POST', '/api/cognition/rag/query', { query, config });
  }

  async routeToExpert(task: string, context?: unknown): Promise<unknown> {
    return this.request('POST', '/api/cognition/moe/route', { task, context });
  }

  // Memory APIs
  async searchMemory(query: string, filters?: unknown): Promise<unknown> {
    return this.request('POST', '/api/memory/search', { query, filters });
  }

  async addMemory(content: string, metadata?: unknown): Promise<unknown> {
    return this.request('POST', '/api/memory/add', { content, metadata });
  }

  // Governance APIs
  async evaluatePolicy(domain: string, input: unknown): Promise<unknown> {
    return this.request('POST', '/api/governance/evaluate', { domain, input });
  }

  async getAuditTrail(filters?: unknown): Promise<unknown> {
    return this.request('GET', '/api/governance/audit', filters);
  }

  // Learning APIs
  async startTraining(config: unknown): Promise<unknown> {
    return this.request('POST', '/api/learning/train', config);
  }

  async getTrainingStatus(jobId: string): Promise<unknown> {
    return this.request('GET', `/api/learning/status/${jobId}`);
  }

  // Federation APIs
  async getFederationStatus(federationId: string): Promise<unknown> {
    return this.request('GET', `/api/federation/${federationId}/status`);
  }

  async crossFederationRequest(request: unknown): Promise<unknown> {
    return this.request('POST', '/api/federation/cross', request);
  }

  // Pipeline APIs
  async executePipeline(pipelineId: string, input: unknown): Promise<unknown> {
    return this.request('POST', `/api/pipeline/${pipelineId}/execute`, input);
  }

  // WebSocket Connections
  connectWebSocket(
    endpoint: string,
    handlers: {
      onMessage?: (data: unknown) => void;
      onOpen?: () => void;
      onClose?: () => void;
      onError?: (error: Event) => void;
    }
  ): WebSocket {
    const ws = new WebSocket(`${this.baseUrl.replace('http', 'ws')}${endpoint}`);

    ws.onopen = () => handlers.onOpen?.();
    ws.onmessage = (event) => handlers.onMessage?.(JSON.parse(event.data));
    ws.onclose = () => {
      handlers.onClose?.();
      this.wsConnections.delete(endpoint);
    };
    ws.onerror = (error) => handlers.onError?.(error);

    this.wsConnections.set(endpoint, ws);
    return ws;
  }

  disconnectWebSocket(endpoint: string): void {
    const ws = this.wsConnections.get(endpoint);
    if (ws) {
      ws.close();
      this.wsConnections.delete(endpoint);
    }
  }

  disconnectAll(): void {
    for (const [, ws] of this.wsConnections) {
      ws.close();
    }
    this.wsConnections.clear();
  }
}

/**
 * UI State Manager - Global state for frontend
 */
export class UIStateManager extends EventEmitter {
  private state: Map<string, unknown> = new Map();
  private subscribers: Map<string, Set<StateSubscriber>> = new Map();

  setState(key: string, value: unknown): void {
    const oldValue = this.state.get(key);
    this.state.set(key, value);

    const subs = this.subscribers.get(key) || new Set();
    for (const sub of subs) {
      sub(value, oldValue);
    }

    this.emit('state:changed', { key, value, oldValue });
  }

  getState<T>(key: string): T | undefined {
    return this.state.get(key) as T | undefined;
  }

  subscribe(key: string, callback: StateSubscriber): () => void {
    const subs = this.subscribers.get(key) || new Set();
    subs.add(callback);
    this.subscribers.set(key, subs);

    return () => {
      subs.delete(callback);
      if (subs.size === 0) this.subscribers.delete(key);
    };
  }

  // Computed state
  computed<T>(keys: string[], compute: (...values: unknown[]) => T): T {
    const values = keys.map((k) => this.state.get(k));
    return compute(...values);
  }

  // Batch updates
  batch(updates: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(updates)) {
      this.setState(key, value);
    }
  }
}

type StateSubscriber = (newValue: unknown, oldValue: unknown) => void;

/**
 * Default UI Integration Instance
 */
export function createDefaultUIIntegration(baseUrl: string = '') {
  const loader = new ComponentLoader();

  // Register component manifests from isabella-ai-genesis
  const genesisComponents: ComponentManifest[] = [
    {
      category: 'isabella',
      name: 'CognitiveDock',
      path: '@isabella/ui/CognitiveDock',
      exports: ['CognitiveDock'],
      dependencies: ['react'],
      version: '1.0.0',
    },
    {
      category: 'isabella',
      name: 'CommandCenter',
      path: '@isabella/ui/CommandCenter',
      exports: ['CommandCenter'],
      dependencies: ['react'],
      version: '1.0.0',
    },
    {
      category: 'isabella',
      name: 'ThinkingIndicator',
      path: '@isabella/ui/ThinkingIndicator',
      exports: ['ThinkingIndicator'],
      dependencies: ['react'],
      version: '1.0.0',
    },
    {
      category: 'isabella',
      name: 'MemoryVisualizer',
      path: '@isabella/ui/MemoryVisualizer',
      exports: ['MemoryVisualizer'],
      dependencies: ['react', 'd3'],
      version: '1.0.0',
    },
    {
      category: 'isabella',
      name: 'ExpertRouter',
      path: '@isabella/ui/ExpertRouter',
      exports: ['ExpertRouter'],
      dependencies: ['react'],
      version: '1.0.0',
    },

    {
      category: 'ui',
      name: 'Button',
      path: '@isabella/ui/Button',
      exports: ['Button'],
      dependencies: ['react'],
      version: '1.0.0',
    },
    {
      category: 'ui',
      name: 'Card',
      path: '@isabella/ui/Card',
      exports: ['Card'],
      dependencies: ['react'],
      version: '1.0.0',
    },
    {
      category: 'ui',
      name: 'Input',
      path: '@isabella/ui/Input',
      exports: ['Input'],
      dependencies: ['react'],
      version: '1.0.0',
    },
    {
      category: 'ui',
      name: 'Modal',
      path: '@isabella/ui/Modal',
      exports: ['Modal'],
      dependencies: ['react', '@radix-ui/react-dialog'],
      version: '1.0.0',
    },
    {
      category: 'ui',
      name: 'Dropdown',
      path: '@isabella/ui/Dropdown',
      exports: ['Dropdown'],
      dependencies: ['react', '@radix-ui/react-dropdown-menu'],
      version: '1.0.0',
    },
    {
      category: 'ui',
      name: 'Tooltip',
      path: '@isabella/ui/Tooltip',
      exports: ['Tooltip'],
      dependencies: ['react', '@radix-ui/react-tooltip'],
      version: '1.0.0',
    },
    {
      category: 'ui',
      name: 'Avatar',
      path: '@isabella/ui/Avatar',
      exports: ['Avatar'],
      dependencies: ['react'],
      version: '1.0.0',
    },
    {
      category: 'ui',
      name: 'Badge',
      path: '@isabella/ui/Badge',
      exports: ['Badge'],
      dependencies: ['react'],
      version: '1.0.0',
    },
    {
      category: 'ui',
      name: 'Separator',
      path: '@isabella/ui/Separator',
      exports: ['Separator'],
      dependencies: ['react'],
      version: '1.0.0',
    },
    {
      category: 'ui',
      name: 'Skeleton',
      path: '@isabella/ui/Skeleton',
      exports: ['Skeleton'],
      dependencies: ['react'],
      version: '1.0.0',
    },

    {
      category: 'navigation',
      name: 'NavBar',
      path: '@isabella/navigation/NavBar',
      exports: ['NavBar'],
      dependencies: ['react'],
      version: '1.0.0',
    },
    {
      category: 'navigation',
      name: 'Sidebar',
      path: '@isabella/navigation/Sidebar',
      exports: ['Sidebar'],
      dependencies: ['react'],
      version: '1.0.0',
    },
    {
      category: 'navigation',
      name: 'Breadcrumb',
      path: '@isabella/navigation/Breadcrumb',
      exports: ['Breadcrumb'],
      dependencies: ['react'],
      version: '1.0.0',
    },
    {
      category: 'navigation',
      name: 'Tabs',
      path: '@isabella/navigation/Tabs',
      exports: ['Tabs'],
      dependencies: ['react', '@radix-ui/react-tabs'],
      version: '1.0.0',
    },
    {
      category: 'navigation',
      name: 'Pagination',
      path: '@isabella/navigation/Pagination',
      exports: ['Pagination'],
      dependencies: ['react'],
      version: '1.0.0',
    },

    {
      category: 'intro',
      name: 'Hero',
      path: '@isabella/intro/Hero',
      exports: ['Hero'],
      dependencies: ['react'],
      version: '1.0.0',
    },
    {
      category: 'intro',
      name: 'FeatureGrid',
      path: '@isabella/intro/FeatureGrid',
      exports: ['FeatureGrid'],
      dependencies: ['react'],
      version: '1.0.0',
    },
    {
      category: 'intro',
      name: 'Testimonial',
      path: '@isabella/intro/Testimonial',
      exports: ['Testimonial'],
      dependencies: ['react'],
      version: '1.0.0',
    },
    {
      category: 'intro',
      name: 'CTA',
      path: '@isabella/intro/CTA',
      exports: ['CTA'],
      dependencies: ['react'],
      version: '1.0.0',
    },
  ];

  // Register components from isabella-s-core-intelligence
  const coreComponents: ComponentManifest[] = [
    {
      category: 'core',
      name: 'useCognitiveState',
      path: '@isabella/core/hooks/useCognitiveState',
      exports: ['useCognitiveState'],
      dependencies: ['react'],
      version: '1.0.0',
    },
    {
      category: 'core',
      name: 'useMemoryMesh',
      path: '@isabella/core/hooks/useMemoryMesh',
      exports: ['useMemoryMesh'],
      dependencies: ['react'],
      version: '1.0.0',
    },
    {
      category: 'core',
      name: 'useExpertRouter',
      path: '@isabella/core/hooks/useExpertRouter',
      exports: ['useExpertRouter'],
      dependencies: ['react'],
      version: '1.0.0',
    },
    {
      category: 'core',
      name: 'useGovernance',
      path: '@isabella/core/hooks/useGovernance',
      exports: ['useGovernance'],
      dependencies: ['react'],
      version: '1.0.0',
    },

    {
      category: 'hooks',
      name: 'useWebSocket',
      path: '@isabella/hooks/useWebSocket',
      exports: ['useWebSocket'],
      dependencies: ['react'],
      version: '1.0.0',
    },
    {
      category: 'hooks',
      name: 'useSSE',
      path: '@isabella/hooks/useSSE',
      exports: ['useSSE'],
      dependencies: ['react'],
      version: '1.0.0',
    },
    {
      category: 'hooks',
      name: 'useLocalStorage',
      path: '@isabella/hooks/useLocalStorage',
      exports: ['useLocalStorage'],
      dependencies: ['react'],
      version: '1.0.0',
    },
    {
      category: 'hooks',
      name: 'useDebounce',
      path: '@isabella/hooks/useDebounce',
      exports: ['useDebounce'],
      dependencies: ['react'],
      version: '1.0.0',
    },

    {
      category: 'lib',
      name: 'utils',
      path: '@isabella/lib/utils',
      exports: ['cn', 'formatDate', 'generateId'],
      dependencies: [],
      version: '1.0.0',
    },
  ];

  for (const manifest of [...genesisComponents, ...coreComponents]) {
    loader.registerManifest(manifest);
  }

  const renderer = new SSRRenderer(loader);
  const hydration = new HydrationManager();
  const api = new APIIntegration(baseUrl);
  const uiState = new UIStateManager();

  return {
    loader,
    renderer,
    hydration,
    api,
    uiState,
  };
}
