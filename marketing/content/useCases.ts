export interface UseCase {
  slug: string
  category: 'finance' | 'healthcare' | 'industry' | 'legal' | 'public' | 'retail'
  audience: string[]
  titles: {
    de: string
    en: string
    es: string
  }
  summaries: {
    de: string
    en: string
    es: string
  }
  sections: {
    de: {
      context: string
      objective: string
      workflow: string
      inputs: string
      outputs: string
      benefits: string[]
      risks: string[]
    }
    en: {
      context: string
      objective: string
      workflow: string
      inputs: string
      outputs: string
      benefits: string[]
      risks: string[]
    }
    es: {
      context: string
      objective: string
      workflow: string
      inputs: string
      outputs: string
      benefits: string[]
      risks: string[]
    }
  }
  ctaLabel: {
    de: string
    en: string
    es: string
  }
}

export const useCases: UseCase[] = [
  {
    slug: 'bank-kreditanalyse',
    category: 'finance',
    audience: ['CIO', 'IT-Leiter', 'Risk-Manager'],
    titles: {
      de: 'Effiziente Kreditanalysen mit KI',
      en: 'Efficient Credit Analysis with AI',
      es: 'Análisis de Crédito Eficiente con IA'
    },
    summaries: {
      de: 'Automatisierte Kreditanalysen in Sekunden statt Stunden – mit voller Audit-Fähigkeit und DSGVO-Konformität.',
      en: 'Automated credit analysis in seconds instead of hours – with full audit capability and GDPR compliance.',
      es: 'Análisis de crédito automatizados en segundos en lugar de horas – con completa capacidad de auditoría y cumplimiento GDPR.'
    },
    sections: {
      de: {
        context: 'Banken stehen unter enormem Druck, Kreditanfragen schneller zu bearbeiten und gleichzeitig strikte Compliance-Anforderungen einzuhalten.',
        objective: 'Reduktion der Bearbeitungszeit von Kreditanträgen von Stunden auf Sekunden bei gleichzeitiger Verbesserung der Risikobewertung.',
        workflow: '1. Kunde reicht Kreditantrag ein\n2. KI analysiert Bonitätsdaten, Einkommensnachweise und historische Daten\n3. Automatische Risikobewertung mit Quellenangabe\n4. Vorschlag für Kreditentscheidung mit Begründung',
        inputs: 'Kreditantragsdaten, Bonitätsauskunft, Einkommensnachweise, Kundenhistorie',
        outputs: 'Risikobewertung, Kreditentscheidungsvorschlag, Dokumentation, Quellenangaben',
        benefits: [
          '30% Zeitersparnis bei der Kreditbearbeitung',
          'Konsistente und nachvollziehbare Entscheidungen',
          'Einhaltung aller Compliance-Regeln',
          'Vollständige Dokumentation für Audits'
        ],
        risks: [
          'Fehlende Datenqualität',
          'Regulatorische Änderungen'
        ]
      },
      en: {
        context: 'Banks are under immense pressure to process credit applications faster while maintaining strict compliance requirements.',
        objective: 'Reduce credit application processing time from hours to seconds while improving risk assessment.',
        workflow: '1. Customer submits credit application\n2. AI analyzes credit data, income proof, and historical data\n3. Automated risk assessment with source citations\n4. Credit decision proposal with justification',
        inputs: 'Credit application data, credit check, income proof, customer history',
        outputs: 'Risk assessment, credit decision proposal, documentation, source citations',
        benefits: [
          '30% time savings in credit processing',
          'Consistent and traceable decisions',
          'Compliance with all regulatory requirements',
          'Complete documentation for audits'
        ],
        risks: [
          'Poor data quality',
          'Regulatory changes'
        ]
      },
      es: {
        context: 'Los bancos están bajo una inmensa presión para procesar solicitudes de crédito más rápido mientras cumplen con estrictos requisitos de cumplimiento.',
        objective: 'Reducir el tiempo de procesamiento de solicitudes de crédito de horas a segundos mejorando la evaluación de riesgos.',
        workflow: '1. El cliente presenta la solicitud de crédito\n2. La IA analiza datos de crédito, pruebas de ingresos e historial\n3. Evaluación automática de riesgos con citas de fuentes\n4. Propuesta de decisión de crédito con justificación',
        inputs: 'Datos de solicitud de crédito, verificación de crédito, pruebas de ingresos, historial del cliente',
        outputs: 'Evaluación de riesgos, propuesta de decisión de crédito, documentación, citas de fuentes',
        benefits: [
          '30% de ahorro de tiempo en el procesamiento de créditos',
          'Decisiones consistentes y rastreables',
          'Cumplimiento de todos los requisitos regulatorios',
          'Documentación completa para auditorías'
        ],
        risks: [
          'Mala calidad de datos',
          'Cambios regulatorios'
        ]
      }
    },
    ctaLabel: {
      de: 'Demo für Finanzbranche buchen',
      en: 'Book Finance Demo',
      es: 'Reservar Demo del Sector Financiero'
    }
  },
  {
    slug: 'customer-service-automation',
    category: 'retail',
    audience: ['Head of Service', 'CTO', 'Support-Leiter'],
    titles: {
      de: 'Intelligenter Kundenservice mit KI',
      en: 'Intelligent Customer Service with AI',
      es: 'Atención al Cliente Inteligente con IA'
    },
    summaries: {
      de: 'Automatisierte Beantwortung von Kundenanfragen basierend auf Unternehmenswissen – 24/7 verfügbar und konsistent.',
      en: 'Automated response to customer inquiries based on company knowledge – available 24/7 and consistent.',
      es: 'Respuesta automatizada a consultas de clientes basada en conocimiento de la empresa – disponible 24/7 y consistente.'
    },
    sections: {
      de: {
        context: 'Kunden erwarten schnelle und präzise Antworten rund um die Uhr. Manuelle Prozesse stoßen an ihre Grenzen.',
        objective: 'Automatisierung von bis zu 80% der Kundenanfragen bei gleichzeitiger Steigerung der Kundenzufriedenheit.',
        workflow: '1. Kunde stellt Frage per Chat oder Email\n2. KI durchsucht Wissensdatenbank, FAQs und Dokumentation\n3. Antwort wird mit Quellenangabe generiert\n4. Bei komplexen Fällen: Eskalation an menschlichen Agenten',
        inputs: 'Kundenanfragen, Wissensdatenbank, Dokumentation, Ticket-Historie',
        outputs: 'Antworten, Quellenangaben, Ticket-Klassifikation, Eskalations-Vorschläge',
        benefits: [
          '80% Erstkontaktauflösung',
          '24/7 Verfügbarkeit',
          'Konsistente Antworten',
          'Massive Kostenersparnis'
        ],
        risks: [
          'Fehlende Aktualisierung der Wissensdatenbank',
          'Komplexe Fälle benötigen menschliche Intervention'
        ]
      },
      en: {
        context: 'Customers expect fast and accurate answers around the clock. Manual processes reach their limits.',
        objective: 'Automate up to 80% of customer inquiries while increasing customer satisfaction.',
        workflow: '1. Customer submits question via chat or email\n2. AI searches knowledge base, FAQs, and documentation\n3. Response is generated with source citations\n4. For complex cases: escalation to human agents',
        inputs: 'Customer inquiries, knowledge base, documentation, ticket history',
        outputs: 'Responses, source citations, ticket classification, escalation suggestions',
        benefits: [
          '80% first contact resolution',
          '24/7 availability',
          'Consistent responses',
          'Massive cost savings'
        ],
        risks: [
          'Outdated knowledge base',
          'Complex cases require human intervention'
        ]
      },
      es: {
        context: 'Los clientes esperan respuestas rápidas y precisas las 24 horas. Los procesos manuales alcanzan sus límites.',
        objective: 'Automatizar hasta el 80% de las consultas de clientes mientras se aumenta la satisfacción del cliente.',
        workflow: '1. El cliente presenta una pregunta por chat o email\n2. La IA busca en la base de conocimiento, FAQs y documentación\n3. Se genera una respuesta con citas de fuentes\n4. Para casos complejos: escalación a agentes humanos',
        inputs: 'Consultas de clientes, base de conocimiento, documentación, historial de tickets',
        outputs: 'Respuestas, citas de fuentes, clasificación de tickets, sugerencias de escalación',
        benefits: [
          '80% de resolución en el primer contacto',
          'Disponibilidad 24/7',
          'Respuestas consistentes',
          'Ahorro masivo de costos'
        ],
        risks: [
          'Base de conocimiento desactualizada',
          'Los casos complejos requieren intervención humana'
        ]
      }
    },
    ctaLabel: {
      de: 'Kundenservice Demo ansehen',
      en: 'View Customer Service Demo',
      es: 'Ver Demo de Atención al Cliente'
    }
  },
  {
    slug: 'legal-document-analysis',
    category: 'legal',
    audience: ['Chief Legal Officer', 'Rechtsanwalt', 'Legal-Tech-Leiter'],
    titles: {
      de: 'KI-gestützte Vertragsanalyse',
      en: 'AI-Powered Contract Analysis',
      es: 'Análisis de Contratos con IA'
    },
    summaries: {
      de: 'Automatische Analyse von Verträgen auf Risiken, Klauseln und Abweichungen von Standardmustern.',
      en: 'Automated analysis of contracts for risks, clauses, and deviations from standard patterns.',
      es: 'Análisis automático de contratos para riesgos, cláusulas y desviaciones de patrones estándar.'
    },
    sections: {
      de: {
        context: 'Rechtsabteilungen müssen täglich hunderte Verträge prüfen – eine zeitraubende und fehleranfällige Aufgabe.',
        objective: 'Reduktion des Zeitaufwands für Vertragsanalysen um 70% bei gleichzeitiger Verbesserung der Risikobeurteilung.',
        workflow: '1. Vertrag wird in Nexus hochgeladen\n2. KI extrahiert und analysiert alle relevanten Klauseln\n3. Identifikation von Risiken und Abweichungen\n4. Vergleich mit Standardmustern und Compliance-Richtlinien\n5. Generierung eines Audit-Berichts mit Handlungsempfehlungen',
        inputs: 'Vertragsdokumente (PDF, DOCX), Vertragsvorlagen, Compliance-Richtlinien',
        outputs: 'Klausel-Analyse, Risiko-Bericht, Compliance-Check, Handlungsempfehlungen',
        benefits: [
          '70% Zeitersparnis',
          'Erhöhte Genauigkeit bei der Risikobeurteilung',
          'Konsistente Anwendung von Standards',
          'Vollständige Dokumentation'
        ],
        risks: [
          'Komplexe oder mehrsprachige Verträge',
          'Spezifische Branchen-Klauseln'
        ]
      },
      en: {
        context: 'Legal departments need to review hundreds of contracts daily – a time-consuming and error-prone task.',
        objective: 'Reduce time spent on contract analysis by 70% while improving risk assessment.',
        workflow: '1. Contract is uploaded to Nexary\n2. AI extracts and analyzes all relevant clauses\n3. Identification of risks and deviations\n4. Comparison with standard patterns and compliance guidelines\n5. Generation of audit report with action recommendations',
        inputs: 'Contract documents (PDF, DOCX), contract templates, compliance guidelines',
        outputs: 'Clause analysis, risk report, compliance check, action recommendations',
        benefits: [
          '70% time savings',
          'Improved accuracy in risk assessment',
          'Consistent application of standards',
          'Complete documentation'
        ],
        risks: [
          'Complex or multilingual contracts',
          'Industry-specific clauses'
        ]
      },
      es: {
        context: 'Los departamentos legales necesitan revisar cientos de contratos diariamente – una tarea que consume mucho tiempo y es propensa a errores.',
        objective: 'Reducir el tiempo dedicado al análisis de contratos en un 70% mientras se mejora la evaluación de riesgos.',
        workflow: '1. El contrato se carga en Nexary\n2. La IA extrae y analiza todas las cláusulas relevantes\n3. Identificación de riesgos y desviaciones\n4. Comparación con patrones estándar y pautas de cumplimiento\n5. Generación de un informe de auditoría con recomendaciones de acción',
        inputs: 'Documentos de contrato (PDF, DOCX), plantillas de contrato, pautas de cumplimiento',
        outputs: 'Análisis de cláusulas, informe de riesgos, verificación de cumplimiento, recomendaciones de acción',
        benefits: [
          '70% de ahorro de tiempo',
          'Mejora de precisión en evaluación de riesgos',
          'Aplicación consistente de estándares',
          'Documentación completa'
        ],
        risks: [
          'Contratos complejos o multilingües',
          'Cláusulas específicas de la industria'
        ]
      }
    },
    ctaLabel: {
      de: 'Legal Demo vereinbaren',
      en: 'Book Legal Demo',
      es: 'Reservar Demo Legal'
    }
  },
  {
    slug: 'hr-employee-support',
    category: 'industry',
    audience: ['HR-Leiter', 'Chief People Officer', 'IT-Direktor'],
    titles: {
      de: 'KI-Assistent für HR und Recruiting',
      en: 'AI Assistant for HR and Recruiting',
      es: 'Asistente de IA para RRHH y Reclutamiento'
    },
    summaries: {
      de: 'Intelligenter HR-Assistent für Onboarding, Mitarbeiterfragen und Recruiting – mit vollem Datenschutz.',
      en: 'Intelligent HR assistant for onboarding, employee inquiries, and recruiting – with full data protection.',
      es: 'Asistente de RRHH inteligente para incorporación, consultas de empleados y reclutamiento – con completa protección de datos.'
    },
    sections: {
      de: {
        context: 'HR-Teams werden von wiederkehrenden Fragen überlastet und verbringen viel Zeit mit administrativen Aufgaben.',
        objective: 'Automatisierung von bis zu 60% der HR-Anfragen und Unterstützung beim Recruiting-Prozess.',
        workflow: '1. Mitarbeiter stellt Frage an KI-Assistenten\n2. KI durchsucht Mitarbeiterhandbuch, Richtlinien und FAQ\n3. Antwort wird mit Quellen generiert\n4. Bei Bedarf: Erstellung von Dokumenten oder Vorlagen',
        inputs: 'Mitarbeiterfragen, Mitarbeiterhandbuch, Richtlinien, Job-Beschreibungen',
        outputs: 'Antworten, Dokumente, Vorlagen, Recruiting-Vorschläge',
        benefits: [
          '60% weniger administrative Arbeit',
          'Schnellere Onboarding-Prozesse',
          'Konsistente Informationen',
          'Verbesserter Recruiting-Workflow'
        ],
        risks: [
          'Sensible Personaldaten',
          'Notwendigkeit menschlicher Überprüfung'
        ]
      },
      en: {
        context: 'HR teams are overwhelmed by recurring questions and spend a lot of time on administrative tasks.',
        objective: 'Automate up to 60% of HR inquiries and support the recruiting process.',
        workflow: '1. Employee asks AI assistant a question\n2. AI searches employee handbook, policies, and FAQs\n3. Response is generated with sources\n4. If needed: creation of documents or templates',
        inputs: 'Employee inquiries, employee handbook, policies, job descriptions',
        outputs: 'Responses, documents, templates, recruiting suggestions',
        benefits: [
          '60% less administrative work',
          'Faster onboarding processes',
          'Consistent information',
          'Improved recruiting workflow'
        ],
        risks: [
          'Sensitive personal data',
          'Need for human review'
        ]
      },
      es: {
        context: 'Los equipos de RRHH están abrumados por preguntas recurrentes y dedican mucho tiempo a tareas administrativas.',
        objective: 'Automatizar hasta el 60% de las consultas de RRHH y apoyar el proceso de reclutamiento.',
        workflow: '1. El empleado hace una pregunta al asistente de IA\n2. La IA busca en el manual del empleado, políticas y FAQs\n3. Se genera una respuesta con fuentes\n4. Si es necesario: creación de documentos o plantillas',
        inputs: 'Consultas de empleados, manual del empleado, políticas, descripciones de puestos',
        outputs: 'Respuestas, documentos, plantillas, sugerencias de reclutamiento',
        benefits: [
          '60% menos trabajo administrativo',
          'Procesos de incorporación más rápidos',
          'Información consistente',
          'Flujo de reclutamiento mejorado'
        ],
        risks: [
          'Datos personales sensibles',
          'Necesidad de revisión humana'
        ]
      }
    },
    ctaLabel: {
      de: 'HR Demo testen',
      en: 'Test HR Demo',
      es: 'Probar Demo de RRHH'
    }
  },
  {
    slug: 'healthcare-patient-support',
    category: 'healthcare',
    audience: ['Medical Director', 'Chief Information Officer', 'Klinik-IT-Leiter'],
    titles: {
      de: 'Patientensupport mit KI',
      en: 'Patient Support with AI',
      es: 'Soporte al Paciente con IA'
    },
    summaries: {
      de: 'Intelligenter Patientenservice für Kliniken und Praxen – DSGVO-konform und mit lokalen Daten.',
      en: 'Intelligent patient service for clinics and practices – GDPR compliant with local data.',
      es: 'Servicio de pacientes inteligente para clínicas y consultorios – conforme a GDPR con datos locales.'
    },
    sections: {
      de: {
        context: 'Gesundheitswesen steht unter hohem Druck, Patienten effizienter zu unterstützen und gleichzeitig Datenschutzbedenken zu adressieren.',
        objective: 'Verbesserung des Patientenservices und Reduktion der administrativen Belastung bei gleichzeitiger Sicherstellung der Datenschutzkonformität.',
        workflow: '1. Patient stellt Frage über Online-Portal oder Chat\n2. KI durchsucht Patienteninformationen, Behandlungsleitfäden und medizinische Wissensdatenbank\n3. Antwort wird generiert und geprüft\n4. Notwendige Buchungen oder Überweisungen werden vorgeschlagen',
        inputs: 'Patientenfragen, Akten, Behandlungsleitfäden, medizinische Datenbank',
        outputs: 'Antworten, Buchungsvorschläge, Überweisungsempfehlungen, Dokumentation',
        benefits: [
          'Bessere Patientenzufriedenheit',
          'Entlastung des medizinischen Personals',
          '100% DSGVO-Konformität',
          'Konsistente Qualität'
        ],
        risks: [
          'Kritische medizinische Fälle',
          'Vertraulichkeit der Patientendaten'
        ]
      },
      en: {
        context: 'Healthcare is under high pressure to support patients more efficiently while addressing data protection concerns.',
        objective: 'Improve patient service and reduce administrative burden while ensuring GDPR compliance.',
        workflow: '1. Patient asks question via online portal or chat\n2. AI searches patient information, treatment guidelines, and medical knowledge base\n3. Response is generated and reviewed\n4. Necessary bookings or referrals are suggested',
        inputs: 'Patient questions, records, treatment guidelines, medical database',
        outputs: 'Responses, booking suggestions, referral recommendations, documentation',
        benefits: [
          'Better patient satisfaction',
          'Relief for medical staff',
          '100% GDPR compliance',
          'Consistent quality'
        ],
        risks: [
          'Critical medical cases',
          'Patient data confidentiality'
        ]
      },
      es: {
        context: 'El sector sanitario está bajo una alta presión para apoyar a los pacientes de manera más eficiente mientras aborda las preocupaciones de protección de datos.',
        objective: 'Mejorar el servicio al paciente y reducir la carga administrativa garantizando el cumplimiento GDPR.',
        workflow: '1. El paciente hace una pregunta a través del portal en línea o chat\n2. La IA busca información del paciente, guías de tratamiento y base de conocimientos médicos\n3. Se genera y revisa la respuesta\n4. Se sugieren reservas o derivaciones necesarias',
        inputs: 'Preguntas de pacientes, expedientes, guías de tratamiento, base de datos médica',
        outputs: 'Respuestas, sugerencias de reserva, recomendaciones de derivación, documentación',
        benefits: [
          'Mejor satisfacción del paciente',
          'Alivio para el personal médico',
          '100% cumplimiento GDPR',
          'Calidad consistente'
        ],
        risks: [
          'Casos médicos críticos',
          'Confidencialidad de los datos del paciente'
        ]
      }
    },
    ctaLabel: {
      de: 'Healthcare Demo anfordern',
      en: 'Request Healthcare Demo',
      es: 'Solicitar Demo del Sector Sanitario'
    }
  },
  {
    slug: 'public-sector-document-processing',
    category: 'public',
    audience: ['Department Head', 'CIO', 'Chief Digital Officer'],
    titles: {
      de: 'Effiziente Bearbeitung von Dokumenten',
      en: 'Efficient Document Processing',
      es: 'Procesamiento Eficiente de Documentos'
    },
    summaries: {
      de: 'Automatisierte Dokumentenverarbeitung für Behörden – von der Klassifizierung bis zur Inhaltsanalyse.',
      en: 'Automated document processing for authorities – from classification to content analysis.',
      es: 'Procesamiento automatizado de documentos para autoridades – desde la clasificación hasta el análisis de contenido.'
    },
    sections: {
      de: {
        context: 'Öffentliche Verwaltungen müssen täglich tausende Dokumente verarbeiten – ein komplexer und zeitraubender Prozess.',
        objective: 'Automatisierung der Dokumentenbearbeitung bei gleichzeitiger Einhaltung aller Datenschutz- und Sicherheitsanforderungen.',
        workflow: '1. Dokument wird eingereicht\n2. KI erkennt Dokumententyp und Klasse\n3. Inhalt wird extrahiert und analysiert\n4. Automatische Weiterleitung an zuständige Stelle\n5. Vollständige Protokollierung für Audit-Zwecke',
        inputs: 'Eingereichte Dokumente, Dokumentvorlagen, Prozessrichtlinien',
        outputs: 'Klassifizierung, Extraktion, Weiterleitung, Protokollierung',
        benefits: [
          '80% schnellere Bearbeitung',
          'Konsistente Qualität',
          'Vollständige Nachvollziehbarkeit',
          'DSGVO-Konformität'
        ],
        risks: [
          'Hohe Anforderungen an Datenschutz',
          'Behördenspezifische Formate'
        ]
      },
      en: {
        context: 'Public authorities need to process thousands of documents daily – a complex and time-consuming process.',
        objective: 'Automate document processing while complying with all data protection and security requirements.',
        workflow: '1. Document is submitted\n2. AI recognizes document type and class\n3. Content is extracted and analyzed\n4. Automatic forwarding to responsible department\n5. Complete logging for audit purposes',
        inputs: 'Submitted documents, document templates, process guidelines',
        outputs: 'Classification, extraction, forwarding, logging',
        benefits: [
          '80% faster processing',
          'Consistent quality',
          'Complete traceability',
          'GDPR compliance'
        ],
        risks: [
          'High data protection requirements',
          'Authority-specific formats'
        ]
      },
      es: {
        context: 'Las autoridades públicas necesitan procesar miles de documentos diariamente – un proceso complejo y que consume mucho tiempo.',
        objective: 'Automatizar el procesamiento de documentos cumpliendo con todos los requisitos de protección de datos y seguridad.',
        workflow: '1. Se presenta el documento\n2. La IA reconoce el tipo y clase de documento\n3. Se extrae y analiza el contenido\n4. Reenvío automático al departamento responsable\n5. Registro completo para fines de auditoría',
        inputs: 'Documentos presentados, plantillas de documentos, pautas de proceso',
        outputs: 'Clasificación, extracción, reenvío, registro',
        benefits: [
          '80% de procesamiento más rápido',
          'Calidad consistente',
          'Rastreabilidad completa',
          'Cumplimiento GDPR'
        ],
        risks: [
          'Altos requisitos de protección de datos',
          'Formatos específicos de autoridades'
        ]
      }
    },
    ctaLabel: {
      de: 'Public Sector Demo vereinbaren',
      en: 'Book Public Sector Demo',
      es: 'Reservar Demo del Sector Público'
    }
  }
]
