# §203 StGB Compliance Documentation

## Overview

Nexary provides compliance with §203 StGB (German Criminal Code) for legal professionals requiring confidential communications protection. This document outlines Nexary's implementation of §203 StGB requirements, including mandatory 10-year audit log retention and privileged communication protection.

## §203 StGB Requirements

### Protected Professions

§203 StGB protects the confidentiality of communications for:

1. **Attorneys, Rechtsanwälte** (Lawyers)
2. **Notare** (Notaries)
3. **Verteidiger** (Defense Counsel)
4. **Patentanwälte** (Patent Attorneys)
5. **Steuerberater** (Tax Advisors)
6. **Psychologische Psychotherapeuten** (Psychotherapists)
7. **Ärzte** (Doctors - separate medical confidentiality)

### Prohibited Actions (§203 Abs. 1 StGB)

Unauthorized disclosure of confidential information, including:
- Patient/client identity
- Nature of consultation
- Information about consultations
- Content of communications

### Penalties

- **Abs. 1**: Up to 1 year imprisonment or fine
- **Abs. 2**: Up to 2 years if for gain or intent to harm
- **Abs. 3**: Up to 2 years for negligent disclosure
- **Abs. 5**: Up to 1 year for use of disclosed information

## Nexary Implementation

### 1. Immutable Audit Logs (10-Year Retention)

#### Database Schema

```sql
-- Immutable audit log table
CREATE TABLE stgb203_immutable_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    action VARCHAR(255) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    performed_by UUID NOT NULL,
    performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address INET,
    metadata JSONB DEFAULT '{}',

    -- Tamper-evident chain
    previous_log_hash VARCHAR(64),
    current_log_hash VARCHAR(64) NOT NULL,

    -- Legal requirements
    professional_group VARCHAR(50) NOT NULL, -- e.g., 'attorney', 'notary'
    matter_id UUID, -- Case/matter reference
    privilege_level VARCHAR(20) NOT NULL CHECK (privilege_level IN ('attorney-client', 'professional', 'none')),

    -- Retention enforcement
    retention_until TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 years'),
    delete_locked BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent deletion
ALTER TABLE stgb203_immutable_audit_logs
ADD CONSTRAINT stgb203_no_delete CHECK (retention_until > NOW());

-- Prevent modification
CREATE TRIGGER stgb203_prevent_update
BEFORE UPDATE ON stgb203_immutable_audit_logs
FOR EACH STATEMENT
EXECUTE FUNCTION abort_update();

-- Index for querying
CREATE INDEX idx_stgb203_user_actions ON stgb203_immutable_audit_logs(user_id, performed_at DESC);
CREATE INDEX idx_stgb203_matter_actions ON stgb203_immutable_audit_logs(matter_id, performed_at DESC);
CREATE INDEX idx_stgb203_professional_group ON stgb203_immutable_audit_logs(professional_group, performed_at DESC);
```

#### Audit Log Implementation

```typescript
// lib/stgb203/audit-logger.ts
import crypto from 'crypto';

interface STGB203AuditLog {
  user_id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  old_values?: any;
  new_values?: any;
  performed_by: string;
  ip_address?: string;
  professional_group: string;
  matter_id?: string;
  privilege_level: 'attorney-client' | 'professional' | 'none';
  metadata?: any;
}

async function createSTGB203AuditLog(log: STGB203AuditLog): Promise<string> {
  // Get previous log for chain
  const previousLog = await db.query(`
    SELECT current_log_hash
    FROM stgb203_immutable_audit_logs
    WHERE user_id = $1
    ORDER BY performed_at DESC
    LIMIT 1
  `, [log.user_id]);

  // Create tamper-evident chain
  const logData = {
    ...log,
    previous_log_hash: previousLog?.current_log_hash || 'genesis',
    timestamp: new Date().toISOString(),
    nonce: crypto.randomBytes(16).toString('hex')
  };

  // Calculate hash
  const logString = JSON.stringify(logData);
  const currentLogHash = crypto.createHash('sha256')
    .update(logString)
    .digest('hex');

  // Insert with hash chain
  const result = await db.query(`
    INSERT INTO stgb203_immutable_audit_logs (
      user_id, action, resource_type, resource_id,
      old_values, new_values, performed_by, performed_at,
      ip_address, metadata, professional_group, matter_id,
      privilege_level, retention_until, delete_locked,
      previous_log_hash, current_log_hash
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    RETURNING id
  `, [
    log.user_id, log.action, log.resource_type, log.resource_id,
    JSON.stringify(log.old_values), JSON.stringify(log.new_values),
    log.performed_by, new Date(), log.ip_address,
    JSON.stringify(log.metadata), log.professional_group,
    log.matter_id, log.privilege_level,
    new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000), // 10 years
    true,
    previousLog?.current_log_hash || 'genesis',
    currentLogHash
  ]);

  return result.id;
}

// Verify log integrity
async function verifyAuditLogIntegrity(userId: string): Promise<boolean> {
  const logs = await db.query(`
    SELECT * FROM stgb203_immutable_audit_logs
    WHERE user_id = $1
    ORDER BY performed_at ASC
  `, [userId]);

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];

    // Recalculate hash
    const logData = {
      user_id: log.user_id,
      action: log.action,
      resource_type: log.resource_type,
      resource_id: log.resource_id,
      old_values: log.old_values,
      new_values: log.new_values,
      performed_by: log.performed_by,
      performed_at: log.performed_at,
      previous_log_hash: log.previous_log_hash
    };

    const expectedHash = crypto.createHash('sha256')
      .update(JSON.stringify(logData))
      .digest('hex');

    if (expectedHash !== log.current_log_hash) {
      // Integrity violation detected
      await alertSecurityTeam({
        severity: 'critical',
        type: 'audit_log_tampering',
        log_id: log.id,
        user_id: userId
      });

      return false;
    }

    // Verify chain continuity
    if (i > 0) {
      const prevLog = logs[i - 1];
      if (prevLog.current_log_hash !== log.previous_log_hash) {
        await alertSecurityTeam({
          severity: 'critical',
          type: 'audit_log_chain_broken',
          log_id: log.id,
          user_id: userId
        });

        return false;
      }
    }
  }

  return true;
}
```

#### Audit Log Query Interface

```typescript
// app/api/stgb203/audit-logs/route.ts
export async function GET(req: Request) {
  const userId = await getUserId(req);
  const { searchParams } = new URL(req.url);

  // Verify professional privilege
  const user = await getVerifiedProfessional(userId);
  if (!user.professional_groups.includes('attorney')) {
    return new Response('Unauthorized', { status: 403 });
  }

  const filters = {
    start_date: searchParams.get('start_date'),
    end_date: searchParams.get('end_date'),
    matter_id: searchParams.get('matter_id'),
    action: searchParams.get('action'),
    professional_group: searchParams.get('professional_group')
  };

  // Query immutable logs
  const logs = await db.query(`
    SELECT
      id,
      action,
      resource_type,
      resource_id,
      performed_at,
      performed_by,
      professional_group,
      matter_id,
      privilege_level,
      metadata
    FROM stgb203_immutable_audit_logs
    WHERE user_id = $1
      AND ($2::timestamptz IS NULL OR performed_at >= $2)
      AND ($3::timestamptz IS NULL OR performed_at <= $3)
      AND ($4::uuid IS NULL OR matter_id = $4)
      AND ($5::varchar IS NULL OR action = $5)
      AND ($6::varchar IS NULL OR professional_group = $6)
    ORDER BY performed_at DESC
    LIMIT 1000
  `, [
    userId,
    filters.start_date,
    filters.end_date,
    filters.matter_id,
    filters.action,
    filters.professional_group
  ]);

  // Verify integrity before returning
  const integrityValid = await verifyAuditLogIntegrity(userId);
  if (!integrityValid) {
    return new Response('Audit log integrity verification failed', {
      status: 500,
      headers: {
        'X-Audit-Integrity': 'failed'
      }
    });
  }

  return Response.json({
    logs: logs,
    integrity_verified: true,
    retention_until: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString(),
    hash_chain_verified: true
  });
}
```

### 2. Professional Verification

```sql
-- Verified professionals table
CREATE TABLE verified_professionals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,

    -- Professional information
    professional_group VARCHAR(50) NOT NULL, -- 'attorney', 'notary', 'patent_attorney'
    title VARCHAR(100) NOT NULL, -- 'Rechtsanwalt', 'Notar', etc.
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,

    -- Verification
    verification_method VARCHAR(50) NOT NULL, -- 'bar_association', 'chamber', 'id_check'
    verification_reference VARCHAR(255), -- Bar association number, chamber ID
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified_by UUID, -- Admin who verified

    -- Professional credentials
    bar_association VARCHAR(255), -- Regional bar association
    registration_number VARCHAR(100), -- Professional registration number
    specialization TEXT[], -- Areas of specialization

    -- Active status
    is_active BOOLEAN DEFAULT true,
    verified_documents JSONB, -- Stored verification documents

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_professional_group CHECK (
        professional_group IN ('attorney', 'notary', 'patent_attorney', 'tax_advisor', 'psychotherapist')
    )
);

-- Professional activity log
CREATE TABLE professional_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    professional_id UUID NOT NULL REFERENCES verified_professionals(id),
    activity_type VARCHAR(100) NOT NULL, -- 'consultation', 'document_created', 'case_opened'
    matter_id UUID,
    client_identifier VARCHAR(255), -- Pseudonymized client ID
    activity_metadata JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);
```

```typescript
// lib/stgb203/professional-verification.ts
async function verifyProfessional(userId: string, credentials: ProfessionalCredentials): Promise<boolean> {
  // Verify against official registers
  let verified = false;
  let verificationReference: string;

  switch (credentials.professional_group) {
    case 'attorney':
      // Check with bar association (Rechtsanwaltskammer)
      verified = await verifyBarAssociation(
        credentials.bar_association,
        credentials.registration_number
      );
      verificationReference = `RAK:${credentials.bar_association}:${credentials.registration_number}`;
      break;

    case 'notary':
      // Check with notary chamber (Notarkammer)
      verified = await verifyNotaryChamber(
        credentials.chamber,
        credentials.registration_number
      );
      verificationReference = `NotarKammer:${credentials.chamber}:${credentials.registration_number}`;
      break;

    case 'patent_attorney':
      // Check with patent attorney chamber
      verified = await verifyPatentAttorneyChamber(
        credentials.chamber,
        credentials.registration_number
      );
      verificationReference = `PAK:${credentials.chamber}:${credentials.registration_number}`;
      break;

    default:
      return false;
  }

  if (verified) {
    // Store verification
    await db.query(`
      INSERT INTO verified_professionals (
        user_id, professional_group, title, first_name, last_name,
        verification_method, verification_reference, verified_at,
        bar_association, registration_number, specialization
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        userId,
        credentials.professional_group,
        credentials.title,
        credentials.first_name,
        credentials.last_name,
        'bar_association',
        verificationReference,
        new Date(),
        credentials.bar_association || credentials.chamber,
        credentials.registration_number,
        credentials.specialization
      ]);

    // Log verification
    await createSTGB203AuditLog({
      user_id: userId,
      action: 'professional_verified',
      resource_type: 'professional_verification',
      performed_by: 'system',
      professional_group: credentials.professional_group,
      privilege_level: 'professional',
      metadata: {
        verification_reference: verificationReference
      }
    });

    return true;
  }

  return false;
}

// Require verified professional for privileged communications
async function requireVerifiedProfessional(userId: string, requiredGroup: string): Promise<boolean> {
  const professional = await db.query(`
    SELECT * FROM verified_professionals
    WHERE user_id = $1
    AND professional_group = $2
    AND is_active = true
  `, [userId, requiredGroup]);

  if (!professional) {
    return false;
  }

  return true;
}
```

### 3. Legal Matters (Cases) Management

```sql
-- Legal matters/cases table
CREATE TABLE legal_matters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Matter information
    matter_number VARCHAR(100) NOT NULL UNIQUE, -- Internal case number
    matter_title VARCHAR(500) NOT NULL,
    matter_type VARCHAR(100) NOT NULL, -- 'litigation', 'contract', 'advisory', etc.

    -- Professional assignment
    professional_id UUID NOT NULL REFERENCES verified_professionals(id),
    team_id UUID REFERENCES teams(id),

    -- Privilege protection
    privilege_level VARCHAR(20) NOT NULL DEFAULT 'attorney-client',
    is_privileged BOOLEAN DEFAULT true,
    conflict_checked BOOLEAN DEFAULT false,

    -- Client (pseudonymized)
    client_identifier VARCHAR(255), -- Non-identifying client reference

    -- Dates
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    statute_of_limitations TIMESTAMPTZ, -- For retention calculation

    -- Metadata
    jurisdiction VARCHAR(100),
    court VARCHAR(255),
    opposing_party VARCHAR(500),
    matter_metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attorney-client privilege tracking
CREATE TABLE legal_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    matter_id UUID NOT NULL REFERENCES legal_matters(id),

    -- Resource information
    resource_type VARCHAR(50) NOT NULL, -- 'document', 'conversation', 'note'
    resource_id UUID NOT NULL,
    resource_title VARCHAR(500),

    -- Privilege protection
    is_privileged BOOLEAN DEFAULT true,
    privilege_claimed_by UUID REFERENCES verified_professionals(id),
    privilege_claimed_at TIMESTAMPTZ DEFAULT NOW(),

    -- Content protection
    client_communication BOOLEAN DEFAULT false,
    legal_strategy BOOLEAN DEFAULT false,
    work_product BOOLEAN DEFAULT false,

    -- Access control
    access_restricted_to UUID[], -- List of allowed user IDs

    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

```typescript
// lib/stgb203/legal-matters.ts
async function createLegalMatter(matter: LegalMatter): Promise<string> {
  // Verify professional status
  const isVerified = await requireVerifiedProfessional(
    matter.professional_id,
    'attorney'
  );

  if (!isVerified) {
    throw new Error('Only verified attorneys can create privileged matters');
  }

  // Create matter with automatic privilege protection
  const matterId = await db.query(`
    INSERT INTO legal_matters (
      matter_number, matter_title, matter_type,
      professional_id, team_id, privilege_level,
      is_privileged, client_identifier, opened_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id
  `, [
    matter.matter_number,
    matter.matter_title,
    matter.matter_type,
    matter.professional_id,
    matter.team_id,
    'attorney-client',
    true,
    matter.client_identifier || '#' + crypto.randomBytes(4).toString('hex'),
    new Date()
  ]);

  // Log matter creation (privileged)
  await createSTGB203AuditLog({
    user_id: matter.professional_id,
    action: 'matter_created',
    resource_type: 'legal_matter',
    resource_id: matterId,
    new_values: {
      matter_number: matter.matter_number,
      matter_type: matter.matter_type,
      privilege_level: 'attorney-client'
    },
    performed_by: matter.professional_id,
    professional_group: 'attorney',
    matter_id: matterId,
    privilege_level: 'attorney-client'
  });

  return matterId;
}

// Check privilege before access
async function checkPrivilegeAccess(
  userId: string,
  resourceId: string
): Promise<boolean> {
  // Get resource privilege level
  const resource = await db.query(`
    SELECT lr.*, lm.professional_id, lm.team_id, vp.professional_group
    FROM legal_resources lr
    JOIN legal_matters lm ON lr.matter_id = lm.id
    JOIN verified_professionals vp ON lm.professional_id = vp.id
    WHERE lr.resource_id = $1
  `, [resourceId]);

  if (!resource || !resource.is_privileged) {
    // Not privileged, normal access rules apply
    return true;
  }

  // Privileged resource - check access rights
  const isProfessional = await requireVerifiedProfessional(
    userId,
    resource.professional_group
  );

  if (!isProfessional) {
    // Log unauthorized access attempt
    await createSTGB203AuditLog({
      user_id: userId,
      action: 'privileged_access_denied',
      resource_type: resource.resource_type,
      resource_id: resourceId,
      performed_by: userId,
      professional_group: 'none',
      privilege_level: 'attorney-client',
      metadata: {
        attempted_access: 'unverified_user',
        privilege_level: resource.privilege_level
      }
    });

    return false;
  }

  // Check if user is in allowed access list
  if (resource.access_restricted_to.length > 0) {
    if (!resource.access_restricted_to.includes(userId)) {
      await createSTGB203AuditLog({
        user_id: userId,
        action: 'privileged_access_denied',
        resource_type: resource.resource_type,
        resource_id: resourceId,
        performed_by: userId,
        professional_group: resource.professional_group,
        privilege_level: 'attorney-client',
        metadata: {
          reason: 'not_in_access_list'
        }
      });

      return false;
    }
  }

  // Log privileged access
  await createSTGB203AuditLog({
    user_id: userId,
    action: 'privileged_access_granted',
    resource_type: resource.resource_type,
    resource_id: resourceId,
    performed_by: userId,
    professional_group: resource.professional_group,
    matter_id: resource.matter_id,
    privilege_level: 'attorney-client'
  });

  return true;
}
```

### 4. Litigation Hold (Beweissicherung)

```sql
-- Legal holds for litigation preservation
CREATE TABLE legal_holds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Hold information
    hold_name VARCHAR(500) NOT NULL,
    hold_type VARCHAR(50) NOT NULL, -- 'litigation', 'investigation', 'regulatory'
    case_number VARCHAR(100),
    court VARCHAR(255),
    jurisdiction VARCHAR(100),

    -- Hold scope
    matter_ids UUID[], -- Specific matters under hold
    user_ids UUID[], -- Specific users under hold
    date_range_start TIMESTAMPTZ, -- Preserve documents after this date
    date_range_end TIMESTAMPTZ, -- Preserve documents before this date

    -- Hold status
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'released', 'expired'
    issued_by UUID NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    released_at TIMESTAMPTZ,
    release_reason TEXT,

    -- Legal requirements
    preservation_requirement TEXT, -- Specific preservation requirements
    destruction_prohibited BOOLEAN DEFAULT true,
    retention_beyond_policy BOOLEAN DEFAULT true,

    -- Metadata
    hold_metadata JSONB DEFAULT '{}'
);

-- Hold preservation snapshots
CREATE TABLE legal_hold_preservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legal_hold_id UUID NOT NULL REFERENCES legal_holds(id),

    -- Preserved resource
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID NOT NULL,
    resource_checksum VARCHAR(64),

    -- Preservation details
    preserved_at TIMESTAMPTZ DEFAULT NOW(),
    preserved_by UUID NOT NULL,

    -- Content snapshot (for critical documents)
    content_snapshot TEXT,

    -- Verification
    integrity_verified BOOLEAN DEFAULT false,
    last_verified_at TIMESTAMPTZ
);
```

```typescript
// lib/stgb203/legal-holds.ts
async function createLegalHold(hold: LegalHold): Promise<string> {
  const holdId = await db.query(`
    INSERT INTO legal_holds (
      hold_name, hold_type, case_number, court, jurisdiction,
      issued_by, preservation_requirement, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id
  `, [
    hold.hold_name,
    hold.hold_type,
    hold.case_number,
    hold.court,
    hold.jurisdiction,
    hold.issued_by,
    hold.preservation_requirement,
    'active'
  ]);

  // Identify resources to preserve
  const resourcesToPreserve = await identifyResourcesForHold(hold);

  // Create preservation snapshots
  for (const resource of resourcesToPreserve) {
    await preserveResource(holdId, resource);
  }

  // Prevent deletion of held resources
  await applyHoldProtection(holdId, resourcesToPreserve);

  // Log hold creation
  await createSTGB203AuditLog({
    user_id: hold.issued_by,
    action: 'legal_hold_created',
    resource_type: 'legal_hold',
    resource_id: holdId,
    new_values: {
      hold_name: hold.hold_name,
      hold_type: hold.hold_type,
      case_number: hold.case_number,
      resources_preserved: resourcesToPreserve.length
    },
    performed_by: hold.issued_by,
    professional_group: 'attorney',
    privilege_level: 'attorney-client',
    metadata: {
      preservation_requirement: hold.preservation_requirement
    }
  });

  return holdId;
}

// Preserve resource under legal hold
async function preserveResource(holdId: string, resource: any): Promise<void> {
  // Calculate checksum
  const checksum = await calculateResourceChecksum(resource);

  // Create preservation snapshot
  await db.query(`
    INSERT INTO legal_hold_preservations (
      legal_hold_id, resource_type, resource_id,
      resource_checksum, preserved_at, preserved_by,
      content_snapshot, integrity_verified
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `, [
    holdId,
    resource.type,
    resource.id,
    checksum,
    new Date(),
    resource.preserved_by || 'system',
    resource.critical ? await getResourceContent(resource.id) : null,
    false
  ]);
}

// Check if resource is under legal hold
async function isUnderLegalHold(resourceId: string): Promise<boolean> {
  const hold = await db.query(`
    SELECT 1 FROM legal_hold_preservations lhp
    JOIN legal_holds lh ON lhp.legal_hold_id = lh.id
    WHERE lhp.resource_id = $1
    AND lh.status = 'active'
    LIMIT 1
  `, [resourceId]);

  return hold ? true : false;
}

// Prevent deletion of held resources
async function applyHoldProtection(holdId: string, resources: any[]): Promise<void> {
  for (const resource of resources) {
    // Mark resource as protected from deletion
    await db.query(`
      UPDATE ${resource.table_name}
      SET legal_hold_protected = true,
          legal_hold_id = $1
      WHERE id = $2
    `, [holdId, resource.id]);
  }
}
```

### 5. Data Residency in Germany

```typescript
// Ensure data remains in Germany
const dataRegionConfig = {
  primary_region: 'eu-central-1', // Frankfurt
  secondary_region: 'eu-central-2', // Other German region
  data_residency_required: true,
  cross_border_transfer_prohibited: true
};

// Verify data location
async function verifyDataResidency(resourceId: string): Promise<boolean> {
  const resourceLocation = await getResourceLocation(resourceId);

  if (resourceLocation.region !== 'eu-central-1' &&
      resourceLocation.region !== 'eu-central-2') {
    // Data outside Germany - violation
    await alertSecurityTeam({
      severity: 'critical',
      type: 'data_residency_violation',
      resource_id: resourceId,
      location: resourceLocation
    });

    return false;
  }

  return true;
}
```

## Operational Procedures

### Audit Log Export for Legal Proceedings

```typescript
// Export audit logs in legally admissible format
async function exportAuditLogsForMatter(matterId: string): Promise<ExportPackage> {
  // Get all logs for matter
  const logs = await db.query(`
    SELECT * FROM stgb203_immutable_audit_logs
    WHERE matter_id = $1
    ORDER BY performed_at ASC
  `, [matterId]);

  // Verify integrity
  const integrityVerified = await verifyAuditLogIntegrity(logs[0]?.user_id);

  // Create export package
  const exportPackage = {
    export_id: generateUUID(),
    matter_id: matterId,
    export_date: new Date(),
    exported_by: await getCurrentUser(),
    logs: logs,
    integrity_verification: {
      verified: integrityVerified,
      method: 'sha256_hash_chain',
      verification_timestamp: new Date()
    },
    chain_of_custody: {
      export_method: 'digital',
      export_system: 'Nexary §203 StGB System',
      export_version: '1.0',
      checksums: logs.map(log => ({
        log_id: log.id,
        hash: log.current_log_hash
      }))
    },
    legal_declaration: {
      declaration: 'Diese Exportdatei enthält vollständige und unveränderte Aufzeichnungen gemäß §203 StGB.',
      signature: await signExport(logs)
    }
  };

  // Store export
  await storeExport(exportPackage);

  // Log export
  await createSTGB203AuditLog({
    user_id: exportPackage.exported_by.id,
    action: 'audit_logs_exported',
    resource_type: 'legal_matter_export',
    resource_id: matterId,
    new_values: {
      export_id: exportPackage.export_id,
      log_count: logs.length
    },
    performed_by: exportPackage.exported_by.id,
    professional_group: 'attorney',
    matter_id: matterId,
    privilege_level: 'attorney-client'
  });

  return exportPackage;
}
```

## Contact

**§203 StGB Compliance Officer**: stgb203@nexary.ai
**Legal Counsel**: legal@nexary.ai
**Data Protection (Germany)**: datenschutz@nexary.ai

---

*Last updated: January 2025*
*Jurisdiction: Germany (Bundesrepublik Deutschland)*
*Applicable Law: Strafgesetzbuch (StGB) §203*

*Disclaimer: This documentation is for informational purposes only and does not constitute legal advice. Consult with qualified German legal counsel for specific §203 StGB compliance requirements.*
