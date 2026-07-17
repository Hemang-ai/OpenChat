import assert from "node:assert/strict";
import test from "node:test";
import { hasWorkspacePermission } from "../lib/auth/workspace-permissions.ts";

test("viewer access is read-only", () => {
  assert.equal(hasWorkspacePermission("VIEWER", "bot:read"), true);
  assert.equal(hasWorkspacePermission("VIEWER", "analytics:read"), false);
  assert.equal(hasWorkspacePermission("VIEWER", "bot:write"), false);
});

test("support agents can operate conversations without changing bots", () => {
  assert.equal(hasWorkspacePermission("SUPPORT_AGENT", "conversation:write"), true);
  assert.equal(hasWorkspacePermission("SUPPORT_AGENT", "knowledge:write"), false);
  assert.equal(hasWorkspacePermission("SUPPORT_AGENT", "publish:write"), false);
});

test("analysts can inspect outcomes without operating conversations", () => {
  assert.equal(hasWorkspacePermission("ANALYST", "analytics:read"), true);
  assert.equal(hasWorkspacePermission("ANALYST", "conversation:read"), true);
  assert.equal(hasWorkspacePermission("ANALYST", "conversation:write"), false);
});

test("builders can publish but cannot administer the workspace", () => {
  assert.equal(hasWorkspacePermission("BUILDER", "publish:write"), true);
  assert.equal(hasWorkspacePermission("BUILDER", "tool:write"), true);
  assert.equal(hasWorkspacePermission("BUILDER", "workspace:manage"), false);
});

test("admins and owners can administer workspace policy", () => {
  assert.equal(hasWorkspacePermission("ADMIN", "workspace:manage"), true);
  assert.equal(hasWorkspacePermission("OWNER", "workspace:manage"), true);
});
