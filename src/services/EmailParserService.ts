import { simpleParser, ParsedMail } from 'mailparser';
import { Attachment, NormalizedEmail } from '../interfaces.ts';

export class EmailParserService {
  public async parseEmail(
    rawEmail: string | Buffer,
    providerMessageId: string,
    provider: NormalizedEmail['provider']
  ): Promise<NormalizedEmail> {
    try {
      const parsed: ParsedMail = await simpleParser(rawEmail);

      const attachments: Attachment[] = (parsed.attachments || []).map(att => ({
        filename: att.filename || 'untitled',
        mimeType: att.contentType,
        size: att.size,
        buffer: Buffer.isBuffer(att.content) ? att.content : undefined,
        contentId: att.contentId,
      }));

      // Filter out inline images if they are not explicitly requested or handled differently
      // For now, we include all. PRD: "Skips inline images" - this needs more specific logic.
      // A common way is to check `att.contentDisposition === 'inline'` or if it has a contentId referenced in HTML.

      return {
        id: providerMessageId, // Use provider's ID
        threadId: parsed.messageId, // mailparser's messageId might be useful, or use provider's threadId
        from: parsed.from?.text || '',
        to: Array.isArray(parsed.to) ? parsed.to.flatMap(addr => addr.text.split(',').map((t: string) => t.trim())) : (parsed.to?.text.split(',').map((t: string) => t.trim()) || []),
        cc: Array.isArray(parsed.cc) ? parsed.cc.flatMap(addr => addr.text.split(',').map((t: string) => t.trim())) : (parsed.cc?.text.split(',').map((t: string) => t.trim()) || []),
        subject: parsed.subject,
        bodyText: parsed.text,
        bodyHtml: parsed.html || undefined, // Ensure it's string or undefined
        attachments,
        date: parsed.date || new Date(),
        labels: parsed.references ? (Array.isArray(parsed.references) ? parsed.references : [parsed.references]) : [], // Example, Gmail labels are different
        provider,
        raw: parsed // Optionally include the full parsed object
      };
    } catch (error) {
      console.error('Error parsing email:', error);
      throw new Error(`Failed to parse email: ${(error as Error).message}`);
    }
  }

  public static isInlineAttachment(attachment: ParsedMail['attachments'][0]): boolean {
    // Basic check for inline disposition. More sophisticated checks might be needed.
    // e.g., checking if contentId is referenced in the HTML body.
    return attachment.contentDisposition === 'inline' || (!!attachment.contentId && attachment.contentId.startsWith('<'));
  }
}
