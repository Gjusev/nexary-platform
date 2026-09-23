# Nexary API Documentation

This directory contains the API specification and documentation for the Nexary platform.

## OpenAPI/Swagger Specification

The main API specification is available in [`openapi-spec.yaml`](./openapi-spec.yaml). This file follows the OpenAPI 3.1.0 specification and describes all available endpoints, request/response formats, authentication methods, and more.

## Viewing the Documentation

### Using Swagger Editor

1. Go to [https://editor.swagger.io/](https://editor.swagger.io/)
2. Import the `openapi-spec.yaml` file
3. Explore and interact with the API documentation

### Using Swagger UI (Local Setup)

```bash
npm install -g swagger-ui
swagger-ui -p 8080 docs/api/openapi-spec.yaml
```

Then visit `http://localhost:8080` in your browser.

### Using Redoc

```bash
npm install -g @redocly/cli
redocly preview-docs docs/api/openapi-spec.yaml
```

## API Overview

### Base URL

- **Production**: `https://api.nexary.ai`
- **Staging**: `https://staging-api.nexary.ai`
- **Development**: `http://localhost:3000`

### Authentication

Most endpoints require authentication using one of the following methods:

1. **Cookie-based Authentication** (Stack Auth)
   - Automatically handled when using the web interface
   - Session token stored in `next-auth.session-token` cookie

2. **API Key Authentication**
   - Include in `Authorization` header: `Bearer YOUR_API_KEY`
   - Manage API keys through the user dashboard

### API Categories

#### Authentication
- User registration and login
- Team registration
- Session management

#### Chat
- Create and manage conversations
- Send and receive messages
- Streaming responses via SSE
- RAG-augmented queries

#### RAG (Retrieval-Augmented Generation)
- Create and manage knowledge base packages
- Upload and process documents
- Vector similarity search
- Knowledge graph visualization

#### Teams
- Team creation and management
- Member management
- Role-based permissions
- Invitations and join requests

#### Compliance
- GDPR consent management
- Data access requests
- Data erasure requests
- Compliance reports

#### Admin
- User management
- Audit logs
- System monitoring
- Billing management

## Rate Limiting

API requests are rate-limited based on subscription plan:

| Plan | Requests/Hour | Requests/Day |
|------|--------------|--------------|
| Free | 100 | 1,000 |
| Pro | 1,000 | 10,000 |
| Enterprise | Unlimited | Unlimited |

Rate limit headers are included in responses:

- `X-RateLimit-Limit`: Request limit per time window
- `X-RateLimit-Remaining`: Requests remaining in window
- `X-RateLimit-Reset`: Unix timestamp when limit resets

## Error Handling

All errors follow a consistent format:

```json
{
  "error": "ErrorType",
  "message": "Human-readable error message",
  "details": {
    "field": "Additional error context"
  }
}
```

### Common HTTP Status Codes

- `200 OK` - Request succeeded
- `201 Created` - Resource created successfully
- `204 No Content` - Request succeeded, no content returned
- `400 Bad Request` - Invalid request parameters
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `413 Payload Too Large` - File size exceeds limit (10MB)
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

## SDK Examples

### JavaScript/TypeScript

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://api.nexary.ai',
  headers: {
    'Authorization': `Bearer ${API_KEY}`
  }
});

// Create a conversation
const conversation = await api.post('/api/chat/conversations', {
  title: 'My Chat',
  modelId: 'gpt-4'
});

// Send a message
const response = await api.post(`/api/chat/conversations/${conversation.data.id}/stream`, {
  content: 'Hello, AI!'
});
```

### Python

```python
import requests

api = requests.Session()
api.headers.update({'Authorization': f'Bearer {API_KEY}'})

# Create a conversation
conversation = api.post('https://api.nexary.ai/api/chat/conversations', json={
    'title': 'My Chat',
    'modelId': 'gpt-4'
}).json()

# Send a message
response = api.post(
    f'https://api.nexary.ai/api/chat/conversations/{conversation["id"]}/stream',
    json={'content': 'Hello, AI!'}
)
```

### cURL

```bash
# Create a conversation
curl -X POST https://api.nexary.ai/api/chat/conversations \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"My Chat","modelId":"gpt-4"}'

# Send a message
curl -X POST https://api.nexary.ai/api/chat/conversations/{id}/stream \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"content":"Hello, AI!"}'
```

## Streaming Responses

Chat and streaming endpoints use Server-Sent Events (SSE):

```typescript
const response = await fetch('/api/chat/conversations/{id}/stream', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`
  },
  body: JSON.stringify({ content: 'Hello!' })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value);
  console.log(chunk); // Process SSE data
}
```

## Webhooks

Nexary supports webhooks for event notifications. Configure webhook URLs in your dashboard:

### Supported Events

- `conversation.created` - New conversation created
- `conversation.deleted` - Conversation deleted
- `message.sent` - Message sent
- `rag.document.processed` - Document processing completed
- `team.member_joined` - New team member
- `team.member_left` - Member left team

### Webhook Payload Format

```json
{
  "id": "evt_1234567890",
  "event": "conversation.created",
  "data": {
    "conversationId": "uuid",
    "title": "My Chat",
    "createdAt": "2025-01-01T00:00:00Z"
  },
  "timestamp": "2025-01-01T00:00:00Z"
}
```

## Versioning

The API uses URL-based versioning. The current version is `v1`:

```
https://api.nexary.ai/v1/...
```

Legacy versions will be supported for at least 12 months after deprecation notice.

## Support

For API support and questions:
- Documentation: https://docs.nexary.ai
- Email: api-support@nexary.ai
- Status Page: https://status.nexary.ai
- GitHub Issues: https://github.com/nexary/nexary/issues
