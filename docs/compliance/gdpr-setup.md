# Guía GDPR - Configuración de Cuentas AI para Nexary

**Fecha:** Enero 2026
**Objetivo:** Guía paso a paso para crear y configurar cuentas de AI con cumplimiento GDPR

---

## 📋 Tabla de Contenidos

1. [Requisitos Previos](#requisitos-previos)
2. [Azure OpenAI - Microsoft](#1-azure-openai-microsoft)
3. [Mistral AI](#2-mistral-ai)
4. [Anthropic Claude](#3-anthropic-claude)
5. [Meta Llama (Opcional)](#4-meta-llama-opcional)
6. [Configuración GDPR Común](#configuración-gdpr-común)
7. [Checklist Final](#checklist-final)
8. [Troubleshooting](#troubleshooting)

---

## Requisitos Previos

### 📄 Documentación Necesaria

Antes de empezar, asegúrate de tener:

- [ ] **Nombre de la empresa** oficial (ej: "Nexary GmbH")
- [ ] **Dirección fiscal** en Alemania/UE
- [ ] **Número de IVA/VAT** (ej: DE123456789)
- [ ] **Dirección de correo** corporativa
- [ ] **Método de pago** válido (tarjeta corporativa)
- [ ] **Datos de contacto** del representante legal

### 🔐 Herramientas Necesarias

- [ ] Navegador (Chrome, Firefox, Edge)
- [ ] Teléfono móvil (para verificación 2FA)
- [ ] Tarjeta de crédito/débito corporativa
- [ ] Microsoft Account (para Azure)
- [ ] GitHub account (para algunos proveedores)

---

## 1. Azure OpenAI (Microsoft)

### Paso 1: Crear Cuenta Azure

#### 1.1 Registrarse en Azure Portal

```
1. Ir a: https://portal.azure.com
2. Clic en "Cuenta gratuita de Azure"
3. Registrarse con:
   - Correo corporativo
   - Contraseña segura
4. Verificar identidad:
   - Teléfono móvil
   - Tarjeta de crédito (sin cargo, solo verificación)
```

**Tiempo estimado:** 5-10 minutos

#### 1.2 Configurar Perfil de Organización

```
1. Ir a: https://portal.azure.com/#blade/Microsoft_AAD_Company/IAMCompanyMenuBlade/Overview
2. Actualizar información:
   - Nombre organización: "Nexary GmbH"
   - País: "Alemania"
   - Dirección fiscal: [Tu dirección]
   - Número IVA: DE123456789
3. Guardar cambios
```

### Paso 2: Crear Subscription Azure

```
1. En Azure Portal, buscar "Subscriptions"
2. Clic en "Agregar"
3. Seleccionar plan:
   - "Pay As You Go" (para empezar)
   - O enterprise agreement si tienes
4. Configurar:
   - Nombre: "Nexary-Production"
   - Región de facturación: "Germany"
5. Completar compra (sin cargo inicial)
```

**Importante:** Anota el **Subscription ID** para referencia futura.

### Paso 3: Solicitar Acceso a Azure OpenAI

⚠️ **IMPORTANTE:** Azure OpenAI requiere aprobación previa.

#### 3.1 Solicitud de Acceso

**Opción A: Vía Azure Portal (Recomendado)**

```
1. Ir a: https://aka.ms/oaiapply
2. Clic en "Apply for access"
3. Completar formulario:

   Company Information:
   - Company Name: Nexary GmbH
   - Company Website: https://nexary.de
   - Email: corporate@nexary.de

   Product Interest:
   - Which products: ☑ Azure OpenAI
   - Use case: RAG-based AI chat platform for German enterprises

   Region Preference:
   - Primary region: Germany North
   - Why Germany: "Data residency requirements for GDPR compliance"

   Estimated Usage:
   - Monthly tokens: ~50M to start
   - Expected users: 100

   Compliance:
   - GDPR requirements: Yes
   - Industry: Technology/SaaS
```

**Opción B: Vía Azure Direct**

```
1. Llamar a Microsoft Germany:
   Tel: +49 180 6 75 75 75*0
   Email: eu-sales@microsoft.com

2. Contactar partner Microsoft:
   - Buscar "Azure OpenAI Partner Germany"
   - Ej: T-Systems, Avanade, etc.

3. Explicar:
   - Caso de uso
   - Requisitos GDPR
   - Volumen esperado
```

#### 3.2 Tiempos de Aprobación

- **Standard**: 3-5 días laborables
- **Enterprise**: 1-2 semanas
- **Urgente**: Contactar ventas directamente

**Durante la espera:**
- ✅ Puedes explorar Azure Portal
- ✅ Configurar recursos previos
- ✅ Revisar documentación

### Paso 4: Crear Recurso Azure OpenAI

Una vez aprobado:

```
1. En Azure Portal, buscar "Azure OpenAI"
2. Clic en "Create" → "Azure OpenAI"
3. Configurar:

   Basics:
   - Subscription: Nexary-Production
   - Resource Group: (crear nuevo) "nexary-ai-rg"
   - Resource name: "nexary-openai"
   - Region: "Germany North" ⭐ CRÍTICO PARA GDPR
   - Pricing tier: Standard S0

4. Clic en "Next" → "Review + create"
5. Esperar despliegue (~2-5 minutos)
```

### Paso 5: Configurar Data Residency (CRÍTICO)

#### 5.1 Seleccionar Deployment Type Correcto

```
1. En el recurso Azure OpenAI, ir a "Deployments"
2. Crear nuevo deployment:
   - Model: "gpt-4o-mini"
   - Deployment name: "gpt-4o-main"
   - ✅ IMPORTANT: Deployment Type: "Data Zone" ⭐

3. Opciones de deployment:
   ❌ NO seleccionar "Global" (procesa fuera de UE)
   ✅ SELECCIONAR "Data Zone" (procesa solo en UE)
   ❌ "Regional" solo si necesitas máxima garantía

4. Explicación:
   Data Zone: Procesamiento dentro de UE (Alemania, Francia, etc.)
   Global: Procesamiento global (no GDPR compliant por defecto)
```

#### 5.2 Verificar Configuración GDPR

```bash
# Usar Azure CLI para verificar
az cognitiveservices account show \
  --name nexary-openai \
  --resource-group nexary-ai-rg \
  --query "properties.capabilities"

# Debe mostrar:
# - "ContentLogging": false (o ausente si está off)
# - "quota": "Data Zone" o EU-specific
```

### Paso 6: Obtener API Keys

```
1. En recurso Azure OpenAI, ir a "Keys and Endpoint"
2. Copiar:
   - Endpoint: https://nexary-openai.openai.azure.com
   - API Key: <tu-key-aqui>
   - Anotar fecha de caducidad (normalmente nunca)

3. ⚠️ CRÍTICO: No compartir nunca:
   - En código público (GitHub, etc.)
   - En commits de git
   - En documentación pública
```

### Paso 7: Configurar Azure DPA (Data Processing Addendum)

```
1. Ir a: https://www.microsoft.com/trustcenter
2. Buscar: "Data Processing Addendum"
3. Descargar DPA específico para:
   - Azure OpenAI Service
   - Región: UE
4. Revisar cláusulas:
   ✅ Data location: UE
   ✅ Data processing: solo para提供服务
   ✅ No training: datos no se usan para entrenar
   ✅ Data deletion: procedimiento para borrar datos
5. Guardar copia firmada para compliance
```

### Paso 8: Configurar Content Logging (GDPR)

**IMPORTANTE PARA GDPR:** Desactivar logging de datos

```
1. En recurso Azure OpenAI → "Settings"
2. Buscar: "Abuse monitoring" o "Content logging"
3. Configurar:
   ❌ Data logging for abuse monitoring: OFF
   ✅ Reason: "GDPR compliance - minimize data retention"

⚠️ Nota: Esto requiere aprobación especial de Microsoft
   - Contactar a soporte enterprise
   - Explicar caso de uso GDPR
   - Normalmente aprobado para empresas UE
```

### Paso 9: Configurar Billing y Budget Alerts

```
1. En Azure Portal → "Cost Management + Billing"
2. Configurar budget:
   - Budget mensual: ej. €500
   - Alertas:
     ✅ 80% del budget: email
     ✅ 100% del budget: email + bloqueo temporal
3. Configurar cost tags:
   - Project: Nexary
   - Department: Engineering
   - Environment: Production
```

### Paso 10: Documentar para Compliance

```
Crear documento con:

1. Azure Subscription ID
2. Resource IDs
3. Region deployment: Germany North
4. Data residency confirmation
5. DPA signed and dated
6. Content logging status
7. Billing contact
8. Support contact (ticket numbers)

Guardar en: /docs/compliance/azure-openai-setup.pdf
```

---

## 2. Mistral AI

### Paso 1: Crear Cuenta Mistral

#### 1.1 Registrarse

```
1. Ir a: https://console.mistral.ai
2. Clic en "Sign up"
3. Opciones de registro:

   ✅ Opción A: Email corporativo (Recomendado)
   - Email: corporate@nexary.de
   - Contraseña segura
   - Nombre: Nexary GmbH

   ✅ Opción B: GitHub OAuth
   - Conectar cuenta GitHub corporativa

4. Verificar email:
   - Clic en enlace de confirmación
   - Login de nuevo
```

**Tiempo estimado:** 2-3 minutos

**Ventaja Mistral:** No requiere aprobación previa (acceso inmediato) ✅

### Paso 2: Configurar Perfil de Empresa

```
1. En Mistral Console, ir a "Settings" → "Organization"
2. Configurar:

   Organization Details:
   - Name: Nexary GmbH
   - Email: contact@nexary.de
   - Website: https://nexary.de
   - Country: Germany 🇩🇪
   - VAT Number: DE123456789
   - Industry: Technology/SaaS

3. Guardar cambios
```

### Paso 3: Configurar Billing

```
1. Ir a: "Billing" → "Payment Methods"
2. Añadir método de pago:
   - Tarjeta corporativa (Mastercard/Visa)
   - O SEPA (para empresas UE)

3. Seleccionar plan:
   - "Pay As You Go" (recomendado para empezar)
   - O "Enterprise" para alto volumen

4. Configurar facturación:
   - Company name: Nexary GmbH
   - Billing address: [Tu dirección Alemania]
   - VAT ID: DE123456789 (para deducir IVA)
   - Invoice frequency: Monthly
   - Invoice currency: EUR €
```

### Paso 4: Obtener API Keys

```
1. En Mistral Console, ir a "API Keys"
2. Crear nueva API key:
   - Name: "Nexary Production"
   - Permissions: "Can generate chat completions"
   - IP whitelist (opcional pero recomendado):
     - Añadir IPs de servidores Nexary
     - Añadir IP local para desarrollo

3. Copiar API key:
   sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

4. ⚠️ GUARDAR CÓPIA SEGURA:
   - No en código
   - Usar Azure Key Vault o similar
   - Variables de entorno
```

### Paso 5: Configurar GDPR Settings

#### 5.1 Revisar Política de Datos Mistral

```
1. Ir a: https://mistral.ai/privacy
2. Revisar secciones clave:

   ✅ Data Location:
   - "Todos los datos se procesan en UE"
   - "Data centers: París, Francia 🇫🇷"
   - "Backup: Alemania"

   ✅ Data Training:
   - "Opt-in only" (no por defecto)
   - Configurable en dashboard

   ✅ Data Retention:
   - 30 días por defecto
   - Solicitar eliminación en cualquier momento
```

#### 5.2 Configurar Data Settings

```
1. En Mistral Console → "Settings" → "Data"
2. Configurar:

   Data Training:
   ❌ Train on my data: OFF (CRÍTICO PARA GDPR)

   Data Retention:
   - Logs retention: 30 días (o menos para compliance)
   - Conversations: 30 días
   - Custom data: Immediate delete on request

   Data Location:
   ✅ Region: Europe (auto-detected)
   - Confirmed: Paris, France
```

### Paso 6: Descargar y Firmar DPA

```
1. Ir a: https://mistral.ai/terms
2. Descargar documentos:
   - Data Processing Addendum (DPA)
   - GDPR Compliance Statement
   - ISO 27001 Certification (disponible)

3. Revisar DPA:
   ✅ Controller: Nexary GmbH
   ✅ Processor: Mistral AI
   ✅ Data location: UE (France)
   ✅ Subprocessors: Listed in Appendix A
   ✅ Data subject rights: Supported

4. Firmar digitalmente o solicitar firma electrónica

5. Guardar en: /docs/compliance/mistral-dpa.pdf
```

### Paso 7: Configurar Monitoreo de Uso

```
1. En Mistral Console → "Usage"
2. Configurar alertas:
   - Daily budget: €100
   - Monthly budget: €1,000
   - Email alerts: billing@nexary.de

3. Verificar tags de uso:
   - Project: Nexary-Chat
   - Environment: Production
```

### Paso 8: Configurar Webhooks (Opcional)

```
1. Ir a "Settings" → "Webhooks"
2. Configurar webhook para:
   - Event logs
   - Usage alerts
   - Billing notifications

3. Endpoint: https://nexary.de/api/webhooks/mistral
4. Verificar handshake
```

---

## 3. Anthropic Claude

### Paso 1: Crear Cuenta Anthropic

⚠️ **IMPORTANTE:** Claude solo disponible en **Suecia Central** en Azure (preview).

```
1. Ir a: https://console.anthropic.com
2. Clic en "Sign up"
3. Opciones:

   ✅ Email corporativo:
   - Email: corporate@nexary.de
   - Password: [Segura]
   - Company: Nexary GmbH

   ✅ O OAuth (Google, GitHub)
   - Usar cuenta corporativa

4. Verificar email
```

**Tiempo estimado:** 3-5 minutos

### Paso 2: Verificar Disponibilidad en Azure

```
1. Ir a: https://azure.microsoft.com/products/ai-foundry/models
2. Buscar: "Anthropic Claude"
3. Verificar regiones disponibles:
   - ✅ Sweden Central (preview)
   - ❌ Germany North (no disponible aún)
   - ❌ France Central (no disponible aún)

⚠️ NOTA: Claude en Azure es PREVIEW
- Limitaciones de cuota
- SLA no garantizado
- No recomendado para producción crítica aún
```

### Paso 3: Solicitar Acceso a Claude API

```
1. En Anthropic Console, ir a "API Access"
2. Completar formulario:

   Use Case Details:
   - Company: Nexary GmbH
   - Website: https://nexary.de
   - Industry: SaaS / AI Platform
   - Use Case: "AI assistant for enterprise knowledge management"
   - Monthly volume: ~10M tokens initially
   - Region: "European customers" (mencionar)

3. Request specific:
   ✅ Claude 4.5 Haiku (más económico)
   ✅ Claude 4.5 Sonnet (uso general)
   ✅ Region: Europe via Azure

4. Submit request
```

**Tiempo de aprobación:** 1-3 días laborables

### Paso 4: Configurar Azure Integration (Opcional)

```
Si tienes acceso a Azure Foundry:

1. Ir a: https://ai.azure.com
2. Buscar: "Anthropic" en modelo catalog
3. Seleccionar modelo:
   - Claude 4.5 Haiku
   - Claude 4.5 Sonnet
   - Region: Sweden Central

4. Deploy:
   - Resource group: nexary-ai-rg
   - Resource name: nexary-claude
   - Region: Sweden Central

⚠️ IMPORTANTE:
- Data residency: NO es Data Zone UE
- Solo Sweden Central
- Procesamiento puede ocurrir fuera de UE
- NO recomendado como único provider para GDPR crítico
```

### Paso 5: Configurar GDPR Settings

#### 5.1 Descargar DPA

```
1. Ir a: https://www.anthropic.com/legal/dpa
2. Descargar "Data Processing Addendum"
3. Revisar secciones:
   - Data location: US y Europa
   - Subprocessors: Listado
   - GDPR provisions: Incluidas

⚠️ LIMITACIÓN CONOCIDA:
- Claude data residency NO es 100% UE
- Procesamiento puede ocurrir en US
- DPA menciona "global infrastructure"
```

#### 5.2 Configurar Data Settings

```
1. En Anthropic Console → "Settings" → "Data"
2. Configurar:

   Data Training:
   - ❌ Train on my data: Ensure OFF
   - Check: https://console.anthropic.com/settings/data

   Data Retention:
   - Request custom retention: 30 days
   - Contact: support@anthropic.com
```

### Paso 6: Obtener API Keys

```
1. En Anthropic Console → "API Keys"
2. Create new key:
   - Name: "Nexary-Production"
   - Project: Nexary Chat
   - Permissions: "All API endpoints"

3. Copy key:
   sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

4. Configure usage limits:
   - Monthly spend limit: $500
   - Per-request limits: Configure based on needs
```

### Paso 7: Configuración de Billing

```
1. Anthropic Console → "Billing"
2. Configurar:

   Payment Method:
   - Tarjeta corporativa
   - O facturación mensual (enterprise)

   Billing Address:
   - Nexary GmbH
   - [Tu dirección Alemania]
   - VAT ID: DE123456789

   Budget Alerts:
   - €100 daily
   - €1,000 monthly
```

### ⚠️ Conclusión Claude

**Veredicto para Nexary:**

```
PROS:
+ Modelo razonamiento superior
+ Output largo (200K tokens)
+ Bueno para análisis complejo

CONTRAS:
- Data residency NO garantizada UE
- Solo disponible en Suecia (preview)
- Más caro que alternativas
- No Data Zone deployment
- SLA no garantizado (preview)

RECOMENDACIÓN:
⚠️ USAR SOLO SECUNDARIO (10-20% requests)
✅ Para tareas muy específicas de análisis
❌ NO como provider principal para GDPR crítico
```

---

## 4. Meta Llama (Opcional)

Llama es **open source**, por lo que tienes 3 opciones:

### Opción A: Azure AI Foundry (Hosted)

```
1. Crear cuenta Azure (ver sección 1)
2. Ir a: https://ai.azure.com
3. Buscar: "Llama" en modelo catalog
4. Seleccionar modelo:
   - Llama 4.1-8B (recomendado)
   - Llama 4.1-70B (para tareas complejas)
5. Deploy:
   - Region: Germany North
   - No requiere approval (open source)

Ventajas:
✅ Azure infrastructure (GDPR compliant)
✅ Data Zone disponible
✅ Sin approval previo

Desventajas:
❌ Aún requiere Azure
❌ Coste de hosting
```

### Opción B: Self-Hosted (Máximo GDPR Compliance)

```
1. Alquilar servidor en Alemania:
   - Hetzner: https://www.hetzner.com
   - Contabo: https://www.contabo.com
   - DigitalOcean: https://www.digitalocean.com

2. Especificaciones servidor:
   - CPU: 16 cores (AMD Ryzen 9 7950X)
   - RAM: 128GB DDR4 ECC
   - GPU: RTX 4090 24GB (opcional para Llama 70B)
   - SSD: 2TB NVMe
   - Coste: ~€400/mes

3. Instalar ollama:
   curl https://ollama.com/install.sh | sh

4. Descargar modelo:
   ollama pull llama4.1

5. Ejecutar:
   ollama run llama4.1

Ventajas:
✅ 100% data sovereignty
✅ Coste único: €400/mes
✅ Sin límites de tasa
✅ Actualizaciones controladas

Desventajas:
❌ Mantenimiento requerido
❌ SLA depende de ti
❌ Actualizaciones manuales
```

### Opción C: Hugging Face Inference

```
1. Ir a: https://huggingface.co
2. Crear cuenta corporativa
3. Ir a: https://huggingface.co/inference/endpoints/meta-llama/Llama-4.1-8b
4. Deploy endpoint:
   - Region: EU (Frankfurt)
   - Serverless: pagar por uso
   - Dedicated: opción más costosa

Ventajas:
✅ Data residency UE
✅ Sin mantenimiento
✅ Pay-as-you-go

Desventajas:
❌ Más caro que self-hosted
❌ Cold starts
```

### Recomendación Llama para Nexary

```
PARA PRODUCCIÓN:
❌ NO recomendado como principal
- Necesita GPU dedicado
- Mantenimiento complejo
- Costoso a escala

PARA FUTURO:
✅ Considerar cuando:
- Tengas equipo DevOps maduro
- Necesities máximo control
- Escalando a >1,000 usuarios
```

---

## Configuración GDPR Común

Todos los providers requieren configuraciones GDPR similares:

### 1. Data Processing Addendum (DPA)

```markdown
Para CADA provider, obtener y firmar DPA que incluya:

✅ Controller: Nexary GmbH
✅ Processor: [Provider]
✅ Data Location: UE (especificar país/región)
✅ Processing Purposes: "Providing AI chat services"
✅ Data Types: Chat messages, documents, user queries
✅ Data Subjects: Employees, customers of Nexary
✅ Security Measures: Encryption at rest and in transit
✅ Subprocessors: Approved list only
✅ Data Deletion: Within 30 days of request
✅ Data Portability: Available upon request
✅ Audit Rights: Quarterly reports

Documentos a guardar:
/docs/compliance/
├── azure-openai-dpa.pdf
├── mistral-dpa.pdf
└── anthropic-dpa.pdf (si usas Claude)
```

### 2. Configurar Azure Key Vault

```bash
# Crear Key Vault en Azure
az keyvault create \
  --name nexary-kv \
  --resource-group nexary-rg \
  --location germanycentral \
  --enable-rbac-authorization

# Almacenar API keys de forma segura
az keyvault secret set \
  --vault-name nexary-kv \
  --name AzureOpenAIKey \
  --value "tu-api-key-aqui"

az keyvault secret set \
  --vault-name nexary-kv \
  --name MistralApiKey \
  --value "tu-mistral-key-aqui"

# Acceder desde código
# Nunca hardcoded en archivos
```

### 3. Variables de Entorno (.env.local)

```bash
# Estructura recomendada

# Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://nexary-openai.openai.azure.com
AZURE_OPENAI_API_KEY= kv-never-log-this # Usar Key Vault en prod
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
AZURE_OPENAI_API_VERSION=2024-08-01-preview
AZURE_OPENAI_EMBEDDINGS=text-embedding-3-small

# Mistral AI
MISTRAL_API_KEY= kv-never-log-this # Usar Key Vault en prod
MISTRAL_MODEL=mistral-7b
MISTRAL_ENDPOINT=https://api.mistral.ai

# Anthropic Claude (opcional)
ANTHROPIC_API_KEY= kv-never-log-this
ANTHROPIC_MODEL=claude-4.5-haiku
ANTHROPIC_VERSION=2025-01-08

# Compliance
ENABLE_CONTENT_LOGGING=false # CRÍTICO PARA GDPR
DATA_RETENTION_DAYS=30
ALLOW_DATA_TRAINING=false # CRÍTICO PARA GDPR

# RAG Local
QDRANT_ENDPOINT=http://localhost:6333
QDRANT_COLLECTION=nexary-docs
QDRANT_API_KEY=tu-qdrant-key

# Router
ROUTER_STRATEGY=hybrid
DEFAULT_PROVIDER=mistral
COMPLEXITY_THRESHOLD=0.7
```

### 4. Configurar Audit Logging

```typescript
// lib/monitoring/gdpr-logger.ts

export class GDPRLogger {
  private logFile: string;

  async logAIRequest(params: {
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    userId?: string;
    ipAddress?: string;
  }) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      provider: params.provider,
      model: params.model,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      cost: this.calculateCost(params),
      userId: params.userId ? this.hashUserId(params.userId) : null,
      ipAddress: params.ipAddress ? this.hashIP(params.ipAddress) : null,
      dataLocation: "UE", // Confirmar
      trainingConsent: false // Confirmar
    };

    // Guardar en log seguro
    await this.appendToLog(logEntry);
  }

  private hashUserId(userId: string): string {
    // Hash para GDPR - no identificar directamente
    return crypto.createHash('sha256')
      .update(userId + process.env.HASH_SALT!)
      .digest('hex')
      .substring(0, 16);
  }

  private hashIP(ip: string): string {
    // Hash IP - solo para auditoría, no identificación
    return crypto.createHash('sha256')
      .update(ip + process.env.HASH_SALT!)
      .digest('hex')
      .substring(0, 16);
  }
}
```

---

## Checklist Final

### ✅ Pre-Setup

```
Requisitos:
[ ] Documentación empresa (nombre, dirección, IVA)
[ ] Tarjeta corporativa
[ ] Microsoft account
[ ] GitHub account
[ ] Teléfono móvil (2FA)
[ ] Directorio para documentos: /docs/compliance/
```

### ✅ Azure OpenAI

```
Cuenta y Acceso:
[ ] Cuenta Azure creada
[ ] Subscription Azure creada
[ ] Acceso Azure OpenAI aprobado
[ ] Recurso Azure OpenAI creado
[ ] Region: Germany North configurado

Configuración GDPR:
[ ] Data Zone deployment seleccionado
[ ] Content logging: OFF
[ ] DPA descargado y firmado
[ ] Data residency confirmada: UE
[ ] Billing alerts configurados

Technical:
[ ] API key obtenida
[ ] Endpoint anotado
[ ] Deployment name: gpt-4o-mini
[ ] Models deployed: gpt-4o-mini, text-embedding-3-small
[ ] Key Vault configurado
```

### ✅ Mistral AI

```
Cuenta y Acceso:
[ ] Cuenta Mistral creada
[ ] Verificación email completada
[ ] Perfil empresa configurado
[ ] Billing method añadido

Configuración GDPR:
[ ] Train on my data: OFF
[ ] Data retention: 30 días
[ ] DPA descargado y firmado
[ ] Data location confirmada: Francia
[ ] VAT ID configurado

Technical:
[ ] API key creada
[ ] IP whitelist configurado
[ ] Usage alerts activadas
[ ] Model seleccionado: mistral-7b
```

### ✅ Anthropic Claude (Opcional)

```
Cuenta y Acceso:
[ ] Cuenta Anthropic creada
[ ] API access solicitado
[ ] Disponibilidad confirmada

Configuración GDPR:
[ ] Train on my data: OFF
[ ] DPA descargado
[ ] Limitaciones entendidas:
  - ❌ Data residency NO 100% UE
  - ❌ Solo disponible en Suecia

Technical:
[ ] API key creada
[ ] Budget alerts configurados
[ ] Model: claude-4.5-haiku
```

### ✅ Compliance General

```
Documentación:
[ ] Directorio /docs/compliance/ creado
[ ] Todos los DPA firmados guardados
[ ] Azure Subscription ID documentado
[ ] Resource IDs documentados
[ ] Billing contacts guardados
[ ] Support tickets guardados

Seguridad:
[ ] Key Vault configurado
[ ] API keys NUNCA en código
[ ] .env.local en .gitignore
[ ] Hash salt configurado
[ ] Audit logging implementado

Legal:
[ ] Revisión legal de DPAs completada
[ ] Política de privacidad actualizada
[ ] Términos de uso actualizados
[ ] Política de cookies actualizada
```

---

## Troubleshooting

### Problema: Acceso Denegado Azure OpenAI

```
Error: "Access denied to Azure OpenAI"

Solución:
1. Verificar que tu solicitud fue aprobada
2. Esperar 3-5 días laborables
3. Revisar email: acceso aprobado
4. Si urgente, llamar: +49 180 6 75 75 75*0
```

### Problema: Content Logging No Se Puede Desactivar

```
Error: "Cannot disable content logging"

Solución:
1. Contactar Azure Support
2. Explicar caso de uso GDPR
3. Solicitar "Modified abuse monitoring"
4. Normalmente aprobado para empresas UE
5. Documentar solicitud y aprobación
```

### Problema: Mistral API No Funciona

```
Error: "Invalid API key"

Solución:
1. Verificar API key correcta
2. Comprobar que no tenga espacios extra
3. Verificar billing activo
4. Revisar IP whitelist (si configurada)
5. Regenerar API key si es necesario
```

### Problema: Claude No Disponible en Región

```
Error: "Model not available in region"

Solución:
1. Claude solo en Sweden Central (preview)
2. O usar API directa (no Azure)
3. Considerar alternativa: Mistral
4. Esperar GA (disponibilidad general)
```

### Problema: Costes Inesperados

```
Error: "Bill higher than expected"

Solución:
1. Verificar deployment type:
   - ❌ Global (más caro)
   - ✅ Data Zone (+10%)
   - ❌ Regional (+20%)
2. Configurar budget alerts
3. Revisar uso por modelo
4. Considerar Mistral para ahorro
```

---

## Resumen Ejecutivo

### Proveedores Recomendados para Nexary

| Prioridad | Provider | GDPR | Coste | Facilidad Setup |
|-----------|----------|------|-------|-----------------|
| **⭐ #1** | Mistral AI | ✅✅✅ | 💰 | ⚡⚡⚡ Muy fácil |
| **⭐ #2** | Azure OpenAI | ✅✅✅ | 💰💰 | ⚡⚡ Fácil |
| **⭐ #3** | Azure Llama | ✅✅ | 💰💰 | ⚡⚡ Fácil |
| ❌ | Claude (Azure) | ⚠️ | 💰💰💰 | ⚠️ Preview |

### Tiempos de Setup Estimados

```
Azure OpenAI:  1 semana (incluyendo approval)
Mistral AI:   1 hora (inmediato)
Claude:        3 días (approval)
Llama:        2-4 horas (Azure) o 1 semana (servidor propio)
```

### Costos Iniciales (Estimado)

```
Setup (primer mes):
- Azure OpenAI: €50 (crédito gratuito incluido)
- Mistral AI: €0-50 (depende uso)
- Infraestructura: €67/mes
- Total inicial: ~€117-167

Mensual (100 usuarios):
- Mistral (70%): €3,200
- Azure OpenAI (20%): €3,000
- Infraestructura: €67
- Total: ~€6,267/mes (vs €17,300 solo Azure)
```

---

## Siguientes Pasos

1. **Esta semana:**
   - [ ] Crear cuenta Azure
   - [ ] Solicitar acceso Azure OpenAI
   - [ ] Crear cuenta Mistral (por si acaso)

2. **Semana 2:**
   - [ ] Recibir aprobación Azure OpenAI
   - [ ] Desplegar recursos
   - [ ] Configurar Key Vault

3. **Semana 3:**
   - [ ] Implementar POC
   - [ ] Testing con usuarios beta
   - [ ] Ajustar configuración

---

**¿Necesitas ayuda con algún paso específico o tienes alguna duda durante el proceso?**
