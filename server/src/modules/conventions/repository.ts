import { and, asc, eq, ne } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type {
  ConventionPatch,
  ConventionRecord,
  ConventionsRepositoryPort,
  NewConvention,
} from './types.js';

type Row = typeof t.conventions.$inferSelect;

function toRecord(r: Row): ConventionRecord {
  return {
    id: r.id,
    workspaceId: r.workspaceId,
    repoId: r.repoId ?? '',
    rule: r.rule,
    evidencePath: r.evidencePath ?? '',
    evidenceSnippet: r.evidenceSnippet ?? '',
    confidence: r.confidence ?? 0,
    status: r.status,
    createdAt: r.createdAt,
  };
}

/** The ONLY place that touches the `conventions` table. Workspace-scoped. */
export class ConventionsRepository implements ConventionsRepositoryPort {
  constructor(private db: Db) {}

  async listByRepo(workspaceId: string, repoId: string): Promise<ConventionRecord[]> {
    const rows = await this.db
      .select()
      .from(t.conventions)
      .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.repoId, repoId)))
      .orderBy(asc(t.conventions.createdAt), asc(t.conventions.id));
    return rows.map(toRecord);
  }

  async get(workspaceId: string, id: string): Promise<ConventionRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(t.conventions)
      .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.id, id)));
    return row ? toRecord(row) : undefined;
  }

  async update(
    workspaceId: string,
    id: string,
    patch: ConventionPatch,
  ): Promise<ConventionRecord | undefined> {
    const values: Partial<Row> = {};
    if (patch.rule !== undefined) values.rule = patch.rule;
    if (patch.status !== undefined) values.status = patch.status;
    if (Object.keys(values).length === 0) return this.get(workspaceId, id);
    const [row] = await this.db
      .update(t.conventions)
      .set(values)
      .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.id, id)))
      .returning();
    return row ? toRecord(row) : undefined;
  }

  async replaceNonAccepted(
    workspaceId: string,
    repoId: string,
    rows: NewConvention[],
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .delete(t.conventions)
        .where(
          and(
            eq(t.conventions.workspaceId, workspaceId),
            eq(t.conventions.repoId, repoId),
            ne(t.conventions.status, 'accepted'),
          ),
        );
      if (rows.length === 0) return;
      // One base timestamp + per-row offset keeps the model's order stable.
      const base = Date.now();
      await tx.insert(t.conventions).values(
        rows.map((r, i) => ({
          workspaceId,
          repoId,
          rule: r.rule,
          evidencePath: r.evidencePath,
          evidenceSnippet: r.evidenceSnippet,
          confidence: r.confidence,
          status: 'pending' as const,
          createdAt: new Date(base + i),
        })),
      );
    });
  }
}
