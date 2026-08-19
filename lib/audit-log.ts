import { query } from "./neon";

type AuditLogInput = {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  message: string;
  metadata?: Record<string, unknown>;
};

export async function writeAuditLog(input: AuditLogInput) {
  await query(
    `insert into audit_logs (actor_id, action, entity_type, entity_id, message, metadata)
     values ($1, $2, $3, $4, $5, $6::jsonb)`,
    [
      input.actorId ?? null,
      input.action,
      input.entityType,
      input.entityId ?? null,
      input.message,
      JSON.stringify(input.metadata ?? {})
    ]
  );
}
