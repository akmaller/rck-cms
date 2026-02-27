-- Optimize visit and audit log query patterns used by analytics/dashboard pages.
CREATE INDEX IF NOT EXISTS "VisitLog_path_ip_idx" ON "VisitLog"("path", "ip");
CREATE INDEX IF NOT EXISTS "VisitLog_createdAt_path_ip_idx" ON "VisitLog"("createdAt", "path", "ip");

CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_entity_createdAt_idx" ON "AuditLog"("entity", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
