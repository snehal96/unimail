import { ImapFlow, ImapFlowOptions } from 'imapflow';
import { EmailParserService } from '../services/EmailParserService.js';
import { NormalizedEmail } from '../interfaces.js';

// Define Unimail-normalized email output

interface FetchOptions {
  since?: Date;
  limit?: number;
  mailbox?: string;
}

export class ImapAdapter {
  private client: ImapFlow;
  private config: ImapFlowOptions;
  private emailParserService: EmailParserService;
  private retries = 0;
  private maxRetries = 3;

  constructor(config: ImapFlowOptions) {
    this.config = config;
    this.client = new ImapFlow(config);
    this.emailParserService = new EmailParserService();
  }

  private log(msg: string, extra?: any) {
    console.log(`[IMAP] ${msg}`, extra || '');
  }

  private async connectWithRetry() {
    while (this.retries < this.maxRetries) {
      try {
        await this.client.connect();
        this.log('Connected successfully');
        return;
      } catch (err) {
        this.retries++;
        this.log(`Connection failed (attempt ${this.retries})`, err);
        await new Promise(res => setTimeout(res, 1000 * this.retries)); // exponential backoff
      }
    }
    throw new Error(`Failed to connect after ${this.maxRetries} attempts`);
  }

  public async fetchEmails({ since, limit = 10, mailbox = 'INBOX' }: FetchOptions): Promise<NormalizedEmail[]> {
    const output: NormalizedEmail[] = [];

    await this.connectWithRetry();

    try {
      await this.client.mailboxOpen(mailbox);

      let counter = 0;
      let normalized: NormalizedEmail;
      for await (const msg of this.client.fetch({ since }, { source: true, uid: true })) {

        normalized = await this.emailParserService.parseEmail(msg.source as Buffer, msg.uid.toString(), 'imap');
        normalized.attachments = normalized.attachments.filter(att => {
          if (att.contentId && normalized.bodyHtml?.includes(`cid:${att.contentId.replace(/[<>]/g, '')}`)) {
            // This is likely an inline image referenced in the HTML
            return false;
          }
          return true;
        });
        output.push(normalized);

        counter++;
        if (counter >= limit) break;
      }

      this.log(`Fetched ${output.length} email(s)`);
      return output;
    } catch (err) {
      this.log('Error during fetchEmails', err);
      throw err;
    } finally {
      await this.close();
    }
  }

  public async close() {
    try {
      await this.client.logout();
      this.log('Disconnected cleanly');
    } catch (err) {
      this.log('Error during logout', err);
    }
  }
}
