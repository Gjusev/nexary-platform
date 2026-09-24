# Stack Auth Implementation Guide

## Overview

This document provides a comprehensive guide to the Stack Auth implementation in this Next.js application. The implementation includes authentication, team management, invitations, and security features.

## Architecture

### Core Components

1. **Authentication Layer** (`lib/auth/options.ts`)
   - NextAuth.js integration with Stack Auth
   - JWT-based session management
   - Custom claims for team and role information

2. **Stack Auth Client** (`lib/stack/client.ts`)
   - Direct API integration with Stack Auth
   - Enhanced error handling
   - Type-safe request methods

3. **Team Management** (`lib/stack/invitations.ts`)
   - Team invitation system
   - Role-based access control
   - Invitation lifecycle management

4. **Security Features** (`lib/rate-limit.ts`)
   - Rate limiting for auth endpoints
   - IP-based request throttling
   - Protection against brute force attacks

5. **Password Management** (`lib/stack/password-reset.ts`)
   - Password reset functionality
   - Password strength validation
   - Secure token handling

6. **Logging** (`lib/stack/logging.ts`)
   - Comprehensive audit logging
   - Security event tracking
   - Error monitoring
7. **RAG Vector Pipelines** (`app/dashboard/rag`, `lib/rag/*`)
   - Gestión de paquetes RAG por administradores de equipo
   - Procesamiento, chunking y embeddings de documentos
   - Integración con Qdrant para almacenamiento vectorial


## Environment Variables

```bash
# Stack Auth Configuration
NEXT_PUBLIC_STACK_API_URL=https://sa-api.mokka-dev.de
NEXT_PUBLIC_STACK_PROJECT_ID=314f18d9-337e-4f4d-90f2-8a60f089257f
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=pck_gp3k6957d3353kyrcwekpmxgf178m0qjk2v5djfwkq2q8
STACK_SECRET_SERVER_KEY=***REMOVED***
STACK_AUTH_API_URL=https://sa-api.mokka-dev.de
STACK_PROJECT_ID=314f18d9-337e-4f4d-90f2-8a60f089257f
STACK_AUTH_PROJECT_ID=314f18d9-337e-4f4d-90f2-8a60f089257f
# Vector Store & Embeddings
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
QDRANT_VECTOR_SIZE=1536
QDRANT_DISTANCE=Cosine
OPENAI_API_KEY=
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret
```

## API Endpoints

### Authentication

#### POST /api/auth/register-team
Register a new user and create/join a team.

**Request Body:**
```json
{
  "mode": "create" | "join",
  "name": "string",
  "email": "string",
  "password": "string",
  "teamName": "string",
  "inviteCode": "string", // Required for join mode
  "notes": "string" // Optional
}
```

**Response:**
```json
{
  "success": true,
  "team": { "id": "string", "slug": "string", "name": "string" },
  "message": "string"
}
```

#### Rate Limits
- Registration: 50 requests per 5 minutes per IP
- Team creation: 10 requests per hour per IP

### Team Management

#### Team Creation
```typescript
import { createTeamWithOwner } from '@/lib/stack/client';

const { team, owner } = await createTeamWithOwner({
  teamName: "My Team",
  ownerName: "John Doe",
  ownerEmail: "john@example.com",
  ownerPassword: "securePassword123"
});
```

#### Team Invitations
```typescript
import { createTeamInvitation } from '@/lib/stack/invitations';

const invitation = await createTeamInvitation({
  teamId: "team-id",
  email: "newuser@example.com",
  role: "team-member",
  expiresInDays: 7
});
```

### Password Reset

#### Request Password Reset
```typescript
import { requestPasswordReset } from '@/lib/stack/password-reset';

await requestPasswordReset({
  email: "user@example.com",
  redirectUrl: "https://app.example.com/reset-password"
});
```

#### Confirm Password Reset
```typescript
import { confirmPasswordReset } from '@/lib/stack/password-reset';

await confirmPasswordReset({
  token: "reset-token",
  newPassword: "newSecurePassword123"
});
```

## Security Features

### Rate Limiting
- **Registration**: 50 requests per 5 minutes
- **Team Creation**: 10 requests per hour
- **Login**: 100 requests per minute

### Password Requirements
- Minimum 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### Error Handling
All API endpoints include comprehensive error handling:
- Validation errors with detailed messages
- Rate limit exceeded responses
- Network error handling
- Stack Auth API error propagation

## Logging

### Available Loggers
- `authLogger`: Authentication events
- `teamLogger`: Team management events
- `invitationLogger`: Invitation lifecycle events
- `passwordResetLogger`: Password reset events

### Usage Example
```typescript
import { authLogger } from '@/lib/stack/logging';

authLogger.logRegistration(userId, email, teamId, clientIp);
authLogger.logLogin(userId, email, teamId, clientIp);
authLogger.logLoginFailed(email, 'Invalid credentials', clientIp);
```

## Frontend Integration

### Login Page
Located at `/login` with Stack Auth integration:
- Email/password authentication
- Error handling and user feedback
- Redirect to dashboard on success

### Registration Page
Located at `/register` with two modes:
- **Create Team**: New user creates a team
- **Join Team**: New user joins existing team with invitation code

### Session Management
- JWT tokens stored in secure HTTP-only cookies
- Automatic token refresh
- Team and role information in session

## Migration from ZITADEL

The implementation supports migration from ZITADEL with:
- Dual authentication during transition
- User data export/import
- Password reset for migrated users
- Gradual migration strategy

## Testing

### Manual Testing Checklist
- [ ] User registration (create team)
- [ ] User registration (join team)
- [ ] Login with valid credentials
- [ ] Login with invalid credentials
- [ ] Password reset flow
- [ ] Team invitation flow
- [ ] Rate limiting behavior
- [ ] Error handling

### Automated Testing
```bash
# Run tests
npm test

# Run specific test suite
npm test -- --testNamePattern="StackAuth"
```

## Monitoring

### Key Metrics
- Registration success rate
- Login success rate
- Password reset completion rate
- Team invitation acceptance rate
- Error rates by endpoint

### Health Checks
- Stack Auth API connectivity
- Database connection
- Rate limiting functionality
- Logging system

## Troubleshooting

### Common Issues

1. **"Missing env var" error**
   - Check all required environment variables are set
   - Verify variable names match exactly

2. **"Stack Auth request failed"**
   - Check API URL and credentials
   - Verify network connectivity
   - Check Stack Auth service status

3. **Rate limit exceeded**
   - Check IP-based rate limiting
   - Review rate limit configuration
   - Monitor for abuse patterns

### Debug Mode
Enable debug logging:
```typescript
import { authLogger } from '@/lib/stack/logging';
authLogger.debug('Debug message', { additional: 'data' });
```

## Future Enhancements

1. **MFA Support**
   - TOTP implementation
   - SMS verification
   - WebAuthn support

2. **Advanced Analytics**
   - User behavior tracking
   - Security event analysis
   - Performance metrics

3. **Admin Dashboard**
   - User management
   - Team management
   - Invitation management
   - Security settings

## Support

For issues or questions:
- Check the troubleshooting section
- Review Stack Auth documentation
- Contact the development team
