# OpenBusinessChat Plugin Manifest v1

OpenBusinessChat plugins are declarative integration manifests. A manifest never receives database access, provider keys, or unrestricted network access. Owners review requested permissions before installation and the platform applies the existing tool egress, approval, timeout, secret-reference, idempotency, and audit controls.

## Example

```json
{
  "schemaVersion": "1.0",
  "id": "com.example.order-status",
  "name": "Order Status",
  "version": "1.2.0",
  "compatibility": ">=0.4.0 <1.0.0",
  "description": "Read-only order status lookup",
  "publisher": { "name": "Example", "url": "https://example.com", "security": "security@example.com" },
  "permissions": ["network:api.example.com", "tool:read"],
  "tools": [{
    "name": "lookup_order",
    "description": "Look up an order after the customer supplies its identifier",
    "method": "GET",
    "endpoint": "https://api.example.com/orders/{order_id}",
    "riskTier": "READ_ONLY",
    "approvalMode": "AUTO",
    "timeoutMs": 8000,
    "inputSchema": { "type": "object", "properties": { "order_id": { "type": "string" } }, "required": ["order_id"] }
  }]
}
```

## Review requirements

- Fixed HTTPS domains; no wildcard, private-network, credential-in-URL, or model-selected host.
- Minimal permissions, explicit data classification, bounded response size and timeout.
- Write, communication, identity, financial, and destructive actions require confirmation by default.
- Credentials use encrypted secret references and never appear in the manifest, prompt, logs, or test output.
- Side effects accept an idempotency key and document replay behavior.
- Publisher provides vulnerability disclosure and compatibility/support windows.
- Review status is `PENDING`, `APPROVED`, `REJECTED`, or `SUSPENDED`; only approved versions appear in the catalog.

Community review does not certify a plugin or replace the deployer's security and privacy assessment.
