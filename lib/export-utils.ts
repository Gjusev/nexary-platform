/**
 * Utilities for exporting chat conversations to various formats
 */

export interface ExportMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt: string;
}

export interface ExportConversation {
    title: string;
    messages: ExportMessage[];
    createdAt: string;
}

/**
 * Export conversation to Markdown format
 */
export function exportToMarkdown(conversation: ExportConversation): string {
    const lines: string[] = [];

    // Header
    lines.push(`# ${conversation.title}`);
    lines.push('');
    lines.push(`*Exported on ${new Date().toLocaleDateString()}*`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // Messages
    for (const message of conversation.messages) {
        const timestamp = new Date(message.createdAt).toLocaleString();
        const roleEmoji = message.role === 'user' ? '👤' : message.role === 'assistant' ? '🤖' : '⚙️';
        const roleName = message.role === 'user' ? 'You' : message.role === 'assistant' ? 'Assistant' : 'System';

        lines.push(`### ${roleEmoji} ${roleName}`);
        lines.push(`*${timestamp}*`);
        lines.push('');
        lines.push(message.content);
        lines.push('');
        lines.push('---');
        lines.push('');
    }

    return lines.join('\n');
}

/**
 * Download a file with the given content
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Export conversation as Markdown file download
 */
export function downloadConversationAsMarkdown(conversation: ExportConversation): void {
    const markdown = exportToMarkdown(conversation);
    const filename = `${sanitizeFilename(conversation.title)}-${formatDateForFilename(new Date())}.md`;
    downloadFile(markdown, filename, 'text/markdown');
}

/**
 * Export conversation as plain text
 */
export function exportToPlainText(conversation: ExportConversation): string {
    const lines: string[] = [];

    lines.push(`=== ${conversation.title} ===`);
    lines.push(`Exported: ${new Date().toLocaleDateString()}`);
    lines.push('');
    lines.push('='.repeat(50));
    lines.push('');

    for (const message of conversation.messages) {
        const timestamp = new Date(message.createdAt).toLocaleString();
        const roleName = message.role === 'user' ? 'YOU' : message.role === 'assistant' ? 'ASSISTANT' : 'SYSTEM';

        lines.push(`[${roleName}] ${timestamp}`);
        lines.push(message.content);
        lines.push('');
        lines.push('-'.repeat(50));
        lines.push('');
    }

    return lines.join('\n');
}

/**
 * Export conversation as JSON
 */
export function exportToJSON(conversation: ExportConversation): string {
    return JSON.stringify(
        {
            ...conversation,
            exportedAt: new Date().toISOString(),
        },
        null,
        2
    );
}

/**
 * Download conversation as JSON file
 */
export function downloadConversationAsJSON(conversation: ExportConversation): void {
    const json = exportToJSON(conversation);
    const filename = `${sanitizeFilename(conversation.title)}-${formatDateForFilename(new Date())}.json`;
    downloadFile(json, filename, 'application/json');
}

/**
 * Generate PDF content (returns HTML that can be printed to PDF)
 * Note: For actual PDF generation, you would use a library like jspdf or html2pdf
 */
export function generatePrintableHTML(conversation: ExportConversation): string {
    const styles = `
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; }
      h1 { border-bottom: 2px solid #333; padding-bottom: 0.5rem; }
      .message { margin: 1.5rem 0; padding: 1rem; border-radius: 8px; }
      .user { background: #e3f2fd; }
      .assistant { background: #f5f5f5; }
      .system { background: #fff3e0; font-style: italic; }
      .role { font-weight: bold; margin-bottom: 0.5rem; }
      .timestamp { color: #666; font-size: 0.8rem; }
      .content { white-space: pre-wrap; line-height: 1.6; }
      pre { background: #1e1e1e; color: #d4d4d4; padding: 1rem; border-radius: 4px; overflow-x: auto; }
      code { font-family: 'Consolas', 'Monaco', monospace; }
      @media print { body { padding: 0; } }
    </style>
  `;

    const messages = conversation.messages
        .map((msg) => {
            const roleLabel = msg.role === 'user' ? '👤 You' : msg.role === 'assistant' ? '🤖 Assistant' : '⚙️ System';
            const timestamp = new Date(msg.createdAt).toLocaleString();
            return `
        <div class="message ${msg.role}">
          <div class="role">${roleLabel}</div>
          <div class="timestamp">${timestamp}</div>
          <div class="content">${escapeHTML(msg.content)}</div>
        </div>
      `;
        })
        .join('');

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${escapeHTML(conversation.title)}</title>
      ${styles}
    </head>
    <body>
      <h1>${escapeHTML(conversation.title)}</h1>
      <p><em>Exported on ${new Date().toLocaleDateString()}</em></p>
      ${messages}
    </body>
    </html>
  `;
}

/**
 * Open print dialog for PDF export
 */
export function printConversationAsPDF(conversation: ExportConversation): void {
    const html = generatePrintableHTML(conversation);
    const printWindow = window.open('', '_blank');

    if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.onload = () => {
            printWindow.print();
        };
    }
}

// Helper functions
function sanitizeFilename(name: string): string {
    return name
        .replace(/[^a-z0-9\s-]/gi, '')
        .replace(/\s+/g, '-')
        .toLowerCase()
        .slice(0, 50);
}

function formatDateForFilename(date: Date): string {
    return date.toISOString().split('T')[0];
}

function escapeHTML(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Generate PDF content for Report/Protocol
 */
interface AgendaItem {
  title: string;
  description?: string;
}

interface Task {
  title: string;
  assignee: string;
  deadline: string;
  status: 'open' | 'in_progress' | 'done';
}

interface Protocol {
  title: string;
  date: string;
  time?: string;
  location?: string;
  attendees?: string[];
  summary?: string;
  agenda?: AgendaItem[];
  tasks?: Task[];
  nextMeeting?: string;
}

export function generateReportHTML(protocol: Protocol): string {
    const styles = `
    <style>
      @page { size: A4; margin: 20mm; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        max-width: 210mm;
        margin: 0 auto;
        padding: 0;
        color: #18181b;
      }
      .header { border-bottom: 2px solid #18181b; padding-bottom: 1.5rem; margin-bottom: 2rem; }
      .meta-label { text-transform: uppercase; letter-spacing: 0.1em; font-size: 0.75rem; font-weight: 600; color: #71717a; margin-bottom: 0.5rem; }
      .title { font-size: 2rem; font-weight: 700; line-height: 1.2; margin: 0 0 1.5rem 0; }
      .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; font-size: 0.875rem; }
      .section { margin-bottom: 2.5rem; }
      .section-title {
        font-size: 0.875rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #71717a;
        border-bottom: 1px solid #e4e4e7;
        padding-bottom: 0.5rem;
        margin-bottom: 1rem;
      }
      .list-item { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; font-size: 0.875rem; }
      .bullet { width: 6px; height: 6px; background: #d4d4d8; border-radius: 50%; margin-top: 0.4rem; flex-shrink: 0; }
      .agenda-item { margin-bottom: 1.5rem; }
      .agenda-header { display: flex; align-items: baseline; gap: 0.75rem; margin-bottom: 0.25rem; }
      .agenda-num { font-family: monospace; font-weight: 700; color: #d4d4d8; font-size: 0.75rem; }
      .agenda-title { font-weight: 600; font-size: 1rem; }
      .agenda-desc { padding-left: 2rem; color: #52525b; font-size: 0.875rem; line-height: 1.5; text-align: justify; }

      table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
      th { text-align: left; padding: 0.75rem 1rem; border-bottom: 1px solid #e4e4e7; color: #52525b; font-weight: 600; }
      td { padding: 0.75rem 1rem; border-bottom: 1px solid #f4f4f5; vertical-align: top; }
      .status-badge {
        display: inline-block;
        padding: 0.125rem 0.5rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 500;
        border: 1px solid #e4e4e7;
      }
      .timestamp { color: #52525b; font-size: 0.875rem; }
      .footer { margin-top: 4rem; text-align: center; font-size: 0.65rem; color: #d4d4d8; text-transform: uppercase; letter-spacing: 0.2em; }
    </style>
  `;

    const attendeesHtml = protocol.attendees?.map((p: string) => `
    <div class="list-item">
      <div class="bullet"></div>
      <div>${escapeHTML(p)}</div>
    </div>
  `).join('') || '';

    const agendaHtml = protocol.agenda?.map((item: AgendaItem, idx: number) => `
    <div class="agenda-item">
      <div class="agenda-header">
        <span class="agenda-num">${String(idx + 1).padStart(2, '0')}</span>
        <span class="agenda-title">${escapeHTML(item.title)}</span>
      </div>
      ${item.description ? `<div class="agenda-desc">${escapeHTML(item.description)}</div>` : ''}
    </div>
  `).join('') || '';

    const tasksHtml = protocol.tasks?.length ? `
    <div class="section">
      <div class="section-title">Action Items</div>
      <table>
        <thead>
          <tr>
            <th style="width: 5%">#</th>
            <th>Task</th>
            <th style="width: 20%">Assignee</th>
            <th style="width: 15%">Due</th>
            <th style="width: 10%">Status</th>
          </tr>
        </thead>
        <tbody>
          ${protocol.tasks.map((task: Task, idx: number) => `
            <tr>
              <td style="color: #a1a1aa; font-family: monospace;">${idx + 1}</td>
              <td style="font-weight: 500;">${escapeHTML(task.title)}</td>
              <td style="color: #52525b;">${escapeHTML(task.assignee)}</td>
              <td style="font-family: monospace; color: #71717a;">${escapeHTML(task.deadline)}</td>
              <td>
                <span class="status-badge">
                  ${task.status === 'done' ? 'Done' : task.status === 'in_progress' ? 'WIP' : 'Open'}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  ` : '';

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${escapeHTML(protocol.title)}</title>
      ${styles}
    </head>
    <body onload="window.print()">
      <div class="header">
        <div class="meta-label">Meeting Report</div>
        <div class="title">${escapeHTML(protocol.title)}</div>
        <div class="meta-grid">
          <div>
            <span style="font-weight: 600;">Date:</span> ${escapeHTML(protocol.date)}
          </div>
          ${protocol.time ? `<div><span style="font-weight: 600;">Time:</span> ${escapeHTML(protocol.time)}</div>` : ''}
          ${protocol.location ? `<div><span style="font-weight: 600;">Location:</span> ${escapeHTML(protocol.location)}</div>` : ''}
        </div>
      </div>

      <div class="section">
        <div class="section-title">Participants</div>
        ${attendeesHtml}
      </div>

      ${protocol.summary ? `
      <div class="section">
        <div class="section-title">Summary</div>
        <div style="text-align: justify; line-height: 1.6;">${escapeHTML(protocol.summary)}</div>
      </div>` : ''}

      ${protocol.agenda?.length ? `
      <div class="section">
        <div class="section-title">Agenda</div>
        ${agendaHtml}
      </div>` : ''}

      ${tasksHtml}

      ${protocol.nextMeeting ? `
      <div style="margin-top: 2rem; border-top: 1px solid #e4e4e7; padding-top: 1rem; display: flex; justify-content: space-between; font-size: 0.875rem; color: #71717a;">
        <span style="font-weight: 600;">Next Meeting:</span>
        <span>${escapeHTML(protocol.nextMeeting)}</span>
      </div>` : ''}

      <div class="footer">Generated by Nexus AI</div>
    </body>
    </html>
  `;
}

/**
 * Open print dialog for Protocol/Report
 */
export function downloadReportAsPDF(protocol: Protocol): void {
    const html = generateReportHTML(protocol);
    const printWindow = window.open('', '_blank');

    if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        // The onload will handle printing in the HTML script
    }
}
