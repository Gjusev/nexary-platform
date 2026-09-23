import crypto from 'crypto';
import { loadSAMLConfig } from './saml-provider';

export interface SAMLMetadataOptions {
  spEntityId: string;
  acsUrl: string;
  sloUrl?: string;
  signAssertions?: boolean;
  signRequests?: boolean;
  nameIdFormat?: string;
}

/**
 * Generate SAML 2.0 Service Provider Metadata XML
 * This XML file is typically uploaded to the Identity Provider configuration
 */
export function generateSAMLMetadata(options: SAMLMetadataOptions): string {
  const {
    spEntityId,
    acsUrl,
    sloUrl,
    signAssertions = true,
    signRequests = true,
    nameIdFormat = 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
  } = options;

  const cert = getSPCert();
  const now = new Date().toISOString();

  // Generate a unique ID for this metadata document
  const metadataId = `_${crypto.randomUUID()}`;

  let metadata = `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
                     xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
                     entityID="${escapeXml(spEntityId)}"
                     ID="${metadataId}">
  <md:SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol"
                      AuthnRequestsSigned="${signRequests ? 'true' : 'false'}"
                      WantAssertionsSigned="${signAssertions ? 'true' : 'false'}">
    <md:NameIDFormat>${escapeXml(nameIdFormat)}</md:NameIDFormat>

    <!-- Assertion Consumer Service (ACS) - Where IdP sends SAML responses -->
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                                  Location="${escapeXml(acsUrl)}"
                                  index="1"
                                  isDefault="true"/>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
                                  Location="${escapeXml(acsUrl)}"
                                  index="2"/>

    ${sloUrl ? `
    <!-- Single Logout Service (SLO) -->
    <md:SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
                            Location="${escapeXml(sloUrl)}"/>
    <md:SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                            Location="${escapeXml(sloUrl)}"/>
    ` : ''}

    ${cert ? `
    <!-- X.509 Certificate for Signature Verification -->
    <md:KeyDescriptor use="signing">
      <ds:KeyInfo>
        <ds:X509Data>
          <ds:X509Certificate>${formatPEM(cert)}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
    <md:KeyDescriptor use="encryption">
      <ds:KeyInfo>
        <ds:X509Data>
          <ds:X509Certificate>${formatPEM(cert)}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
    ` : ''}

  </md:SPSSODescriptor>

  <!-- Contact Information -->
  <md:ContactPerson contactType="technical">
    <md:GivenName>Nexary Support</md:GivenName>
    <md:EmailAddress>support@nexary.app</md:EmailAddress>
  </md:ContactPerson>

  <!-- Organization Information -->
  <md:Organization>
    <md:OrganizationName xml:lang="en">Nexary</md:OrganizationName>
    <md:OrganizationDisplayName xml:lang="en">Nexary AI Platform</md:OrganizationDisplayName>
    <md:OrganizationURL xml:lang="en">${escapeXml(spEntityId)}</md:OrganizationURL>
  </md:Organization>

</md:EntityDescriptor>`;

  return metadata;
}

/**
 * Generate SAML metadata for a specific team
 */
export async function generateTeamSAMLMetadata(teamSlug: string): Promise<string | null> {
  const config = await loadSAMLConfig(teamSlug);

  if (!config) {
    return null;
  }

  return generateSAMLMetadata({
    spEntityId: config.spEntityId,
    acsUrl: config.acsUrl,
    sloUrl: config.sloUrl,
    signAssertions: true,
    signRequests: true,
    nameIdFormat: config.nameIdFormat,
  });
}

/**
 * Escape special characters for XML
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Format PEM certificate (remove headers and newlines)
 */
function formatPEM(pem: string): string {
  return pem
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\s/g, '')
    .trim();
}

/**
 * Get SP X.509 certificate from environment
 * This certificate is used to sign SAML requests and verify responses
 */
function getSPCert(): string | null {
  // Try environment variable first (without headers)
  let cert = process.env.SAML_SP_CERT || process.env.SAML_SP_X509_CERT;

  if (!cert) {
    // Try to generate self-signed cert (for development only)
    if (process.env.NODE_ENV === 'development') {
      return generateSelfSignedCert();
    }
    return null;
  }

  // Add headers if not present
  if (!cert.includes('-----BEGIN CERTIFICATE-----')) {
    cert = `-----BEGIN CERTIFICATE-----\n${cert}\n-----END CERTIFICATE-----`;
  }

  return cert;
}

/**
 * Generate a self-signed certificate for development
 * WARNING: This should NOT be used in production
 */
function generateSelfSignedCert(): string {
  // For development, return a placeholder
  // In production, you should use a real certificate from environment
  const placeholderCert = `-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAJC1HiIAZAiIMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV
BAYTAkFVMRMwEQYDVQQIDApTb21lLVN0YXRlMSEwHwYDVQQKDBhJbnRlcm5ldCBX
aWRnaXRzIFB0eSBMdGQwHhcNMjQwMTAxMDAwMDAwWhcNMjUwMTAxMDAwMDAwWjBF
MQswCQYDVQQGEwJBVTETMBEGA1UECAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50
ZXJuZXQgV2lkZ2l0cyBQdHkgTHRkMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIB
CgKCAQEAyKf7KmNyBm8aLf+1dX3fKQRKlYQMqFQvLQlJJkK3V5NQZb2MqFGnPEqT
eW4k5qTBjtUGaXpVQZRYPLmFhJGxCbVlZKGgM7Pt0PyG7X3VZNdXJvVXvCQoMPLsD
JP8GGzKRGN9yQFjN3qNzVGqDK9VvqGX5eSVvDSKdWZVQZkVhQd9ZvQZJZJZJZJZJZ
-----END CERTIFICATE-----`;

  return placeholderCert;
}

/**
 * Generate metadata XML for download
 */
export async function generateMetadataDownloadUrl(teamSlug: string): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${baseUrl}/api/saml/metadata/${teamSlug}`;
}

/**
 * Preconfigured Identity Provider templates
 */
export const IDP_TEMPLATES: Record<
  string,
  {
    name: string;
    idpEntityId: string;
    idpSsoUrl: string;
    idpSloUrl?: string;
    instructions: string;
  }
> = {
  okta: {
    name: 'Okta',
    idpEntityId: '{your-okta-issuer-url}',
    idpSsoUrl: '{your-okta-domain}/sso/saml',
    instructions: `
1. Log in to your Okta Admin Console
2. Go to Applications > Create App Integration
3. Select "SAML 2.0" as the sign-on method
4. Configure the application with:
   - Single Sign On URL: ${process.env.NEXT_PUBLIC_APP_URL}/api/saml/acs
   - Audience URI (SP Entity ID): ${process.env.NEXT_PUBLIC_APP_URL}
   - Name ID Format: EmailAddress
5. Download the X.509 certificate from Okta
6. Copy the Identity Provider SS0 URL and Issuer URL
    `.trim(),
  },
  azure: {
    name: 'Azure AD / Microsoft Entra ID',
    idpEntityId: 'https://sts.windows.net/{your-tenant-id}/',
    idpSsoUrl: 'https://login.microsoftonline.com/{your-tenant-id}/saml2',
    instructions: `
1. Log in to Azure Portal (portal.azure.com)
2. Go to Azure Active Directory > Enterprise Applications
3. Click "New application" > "Create your own application"
4. Select "Integrate any other application you don't find in the gallery"
5. Go to "Single sign-on" > Select "SAML"
6. Configure:
   - Identifier (Entity ID): ${process.env.NEXT_PUBLIC_APP_URL}
   - Reply URL (Assertion Consumer Service URL): ${process.env.NEXT_PUBLIC_APP_URL}/api/saml/acs
   - Sign on URL: ${process.env.NEXT_PUBLIC_APP_URL}/login
7. Download the certificate (Base64) from the "SAML Signing Certificate" section
8. Copy "Login URL" and "Azure AD Identifier"
    `.trim(),
  },
  google: {
    name: 'Google Workspace',
    idpEntityId: 'https://accounts.google.com/o/saml2?idpid={your-idp-id}',
    idpSsoUrl: 'https://accounts.google.com/o/saml2/initsso?idpid={your-idp-id}&spid={your-sp-id}',
    instructions: `
1. Log in to Google Admin Console (admin.google.com)
2. Go to Apps > Web and mobile apps > Add app > Add custom SAML app
3. Enter "Nexary" as the app name
4. Download the Google IDP metadata XML
5. Configure the SSO settings:
   - ACS URL: ${process.env.NEXT_PUBLIC_APP_URL}/api/saml/acs
   - Entity ID: ${process.env.NEXT_PUBLIC_APP_URL}
   - Name ID: Basic Information > Primary email
   - Name ID Format: EMAIL
6. Copy the SSO URL and Entity ID from Google
7. Download the certificate from the service provider details
    `.trim(),
  },
  onelogin: {
    name: 'OneLogin',
    idpEntityId: '{your-onelogin-issuer-url}',
    idpSsoUrl: 'https://{your-onelogin-domain}.onelogin.com/trust/saml2/http-post/sso/{your-app-id}',
    instructions: `
1. Log in to OneLogin
2. Go to Applications > Add Apps
3. Search for "SAML Test Connector (Advanced)" or create a custom app
4. Configure SSO settings:
   - ACS (Consumer) URL: ${process.env.NEXT_PUBLIC_APP_URL}/api/saml/acs
   - Audience (Entity ID): ${process.env.NEXT_PUBLIC_APP_URL}
   - NameID format: EmailAddress
5. Download the X.509 certificate from OneLogin
6. Copy the SAML endpoint URL and Issuer URL
    `.trim(),
  },
  adfs: {
    name: 'Active Directory Federation Services (ADFS)',
    idpEntityId: '{your-adfs-relying-party-trust-identifier}',
    idpSsoUrl: 'https://{your-adfs-server}/adfs/ls/',
    instructions: `
1. Open AD FS Management on your ADFS server
2. Go to Relying Party Trusts > Add Relying Party Trust
3. Select "Enter data about the relying party manually"
4. Configure:
   - Display name: Nexary
   - Relying party trust identifier: ${process.env.NEXT_PUBLIC_APP_URL}
5. Configure endpoints:
   - SAML ACS URL: ${process.env.NEXT_PUBLIC_APP_URL}/api/saml/acs
   - Binding: POST
6. Update the encryption certificate (optional)
7. Update the claim rules to send email address as Name ID
8. Copy the federation service URL and token signing certificate
    `.trim(),
  },
  authentik: {
    name: 'Authentik',
    idpEntityId: 'https://{authentik-url}/application/saml/{app-slug}/',
    idpSsoUrl: 'https://{authentik-url}/application/saml/{app-slug}/sso/binding/',
    instructions: `
1. Log in to your Authentik admin panel
2. Go to Applications > Create Application
3. Select "SAML 2.0" as provider type
4. Configure the application:
   - Name: Nexary Enterprise
   - Slug: nexary-enterprise (or your preferred slug)
   - ACS URL: ${process.env.NEXT_PUBLIC_APP_URL}/api/saml/acs
   - Audience (Entity ID): ${process.env.NEXT_PUBLIC_APP_URL}
   - Assertion valid hours: 24
5. In "Settings", configure:
   - Name ID: Use "Email" as source
   - Binding: POST
6. Save and download the SAML Metadata or copy:
   - SSO URL: https://{your-authentik-url}/application/saml/{app-slug}/sso/binding/
   - Entity ID: https://{your-authentik-url}/application/saml/{app-slug}/
   - X.509 Certificate: Download from the application page
7. Upload the metadata XML from Nexary to Authentik (optional but recommended)
    `.trim(),
  },
};

/**
 * Get IdP template by name
 */
export function getIdpTemplate(name: string): typeof IDP_TEMPLATES[keyof typeof IDP_TEMPLATES] | null {
  return IDP_TEMPLATES[name.toLowerCase()] || null;
}

/**
 * Get all available IdP templates
 */
export function listIdpTemplates(): Array<{ id: string; name: string; instructions: string }> {
  return Object.entries(IDP_TEMPLATES).map(([id, template]) => ({
    id,
    name: template.name,
    instructions: template.instructions,
  }));
}
