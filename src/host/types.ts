/**
 * Structural views of the Host services this plugin consumes.
 *
 * They mirror the published DSH contracts the plugin was verified against
 * (`ctx.sessionPersistence`, `ctx.sessions`, `ctx.sessionQuery`,
 * `ctx.webServer`, `ctx.connection`, `ctx.workspaceRegistry`) without importing
 * an implementation package. The installed Harness remains the authority.
 */

/** One durable session event, as exposed by the persistence handle. */
export interface RawSessionEvent {
  readonly type: string
  readonly seq: number
  readonly time: number
  readonly data?: unknown
  readonly surfaceOp?: unknown
  readonly ignorable?: true
}

/** The immutable session header fields this plugin reads. */
export interface SessionHeaderLike {
  readonly id: string
  readonly createdAt?: number
  readonly cwd?: string
  readonly parentSession?: string
  readonly isSeeded?: boolean
  readonly origin?: 'subagent'
  readonly delegationDepth?: number
  readonly agentPreset?: string
}

/** Provider-reported usage, as logged on assistant events. */
export interface UsageSample {
  readonly inputTokens?: number
  readonly outputTokens?: number
  readonly cacheReadTokens?: number
  readonly cacheWriteTokens?: number
  readonly totalTokens?: number
  readonly reasoningTokens?: number
}

/** Persistence snapshot (`ctx.sessionPersistence.list()`). */
export interface PersistenceSnapshot {
  readonly header: SessionHeaderLike
  readonly revision: string
  readonly eventCount?: number
  readonly sizeBytes?: number
  readonly formatStatus?: string
}

/** Read-only persistence handle, narrowed to what this plugin calls. */
export interface PersistenceHandle {
  readonly id: string
  readonly header: SessionHeaderLike
  readonly inheritedEventCount: number
  read(offset?: number, length?: number): Promise<{ readonly events: readonly RawSessionEvent[] }>
  close(): Promise<void>
}

/** The persistence service face. */
export interface SessionPersistenceLike {
  list(options?: { signal?: AbortSignal }): Promise<readonly PersistenceSnapshot[]>
  open(id: string, access: 'read' | 'write', options?: { signal?: AbortSignal }): Promise<PersistenceHandle>
}

/** A live in-memory Session (`ctx.sessions.list()`). */
export interface LiveSessionLike {
  readonly id: string
  readonly header: SessionHeaderLike
  readonly inheritedEventCount: number
  readonly seq: number
  snapshotEvents(from: number, to: number): readonly RawSessionEvent[]
}

/** Live session store. */
export interface SessionsLike {
  list(): readonly LiveSessionLike[]
  get(id: string): LiveSessionLike | undefined
}

/** A session observation lease from `ctx.sessionQuery.observeSession()`. */
export interface SessionObservationLike {
  readonly projections?: { readonly values?: unknown }
  dispose?: () => void
}

/** Query service face used only by the diagnostic verification endpoint. */
export interface SessionQueryLike {
  observeSession(
    id: string,
    options?: { readonly projectionMode?: 'all' | 'none'; readonly signal?: AbortSignal },
  ): Promise<SessionObservationLike>
}

/** Workspace registry entry used for project labels. */
export interface WorkspaceLike {
  readonly id?: string
  readonly title?: string
  readonly path?: string
}

export interface WorkspaceRegistryLike {
  list(): readonly WorkspaceLike[]
}

/** The Host connection gate. */
export interface ConnectionLike {
  requestRejection?(request: unknown): number | undefined
}

/** The web server route registration face. */
export interface WebServerLike {
  register(route: {
    kind: 'exact' | 'prefix'
    path: string
    handler: (req: HttpRequestLike, res: HttpResponseLike) => void | Promise<void>
  }): () => void
}

/** Minimal HTTP request surface used by the route handler. */
export interface HttpRequestLike {
  readonly method?: string
  readonly url?: string
  readonly headers: Record<string, string | string[] | undefined>
}

/** Minimal HTTP response surface used by the route handler. */
export interface HttpResponseLike {
  statusCode: number
  readonly headersSent?: boolean
  setHeader(name: string, value: string): void
  writeHead(status: number, headers?: Record<string, string>): unknown
  end(body?: string): void
}

/** Services looked up at call time, so late mounts are not captured as absent. */
export interface HostServiceAccess {
  persistence(): SessionPersistenceLike | undefined
  sessions(): SessionsLike | undefined
  sessionQuery(): SessionQueryLike | undefined
  workspaces(): WorkspaceRegistryLike | undefined
}
