
import { EmailParserService } from '../../src/services/EmailParserService.ts';
import { ParsedMail } from 'mailparser';
import * as mailparser from 'mailparser';

// Mock mailparser
jest.mock('mailparser', () => ({
  simpleParser: jest.fn()
}));

describe('EmailParserService', () => {
  let emailParserService: EmailParserService;
  const simpleParserMock = mailparser.simpleParser as jest.Mock;

  beforeEach(() => {
    emailParserService = new EmailParserService();
    jest.clearAllMocks();
    
    // Setup default mock implementation
    simpleParserMock.mockResolvedValue({
      from: { text: 'sender@example.com' },
      to: [{ text: 'recipient@example.com' }],
      subject: 'Test Email',
      text: 'Plain text content',
      html: '<p>HTML content</p>',
      attachments: [
        {
          filename: 'attachment.pdf',
          contentType: 'application/pdf',
          size: 12345,
          content: Buffer.from('test content'),
          contentId: 'test-id'
        }
      ],
      messageId: 'test-message-id',
      date: new Date(),
      references: ['ref1']
    });
  });

  test('should parse email correctly', async () => {
    const result = await emailParserService.parseEmail('raw email data', 'email-id', 'gmail');
    
    expect(simpleParserMock).toHaveBeenCalledWith('raw email data');
    expect(result.id).toBe('email-id');
    expect(result.provider).toBe('gmail');
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0].filename).toBe('attachment.pdf');
  });

  test('should handle parsing errors correctly', async () => {
    simpleParserMock.mockRejectedValueOnce(new Error('Parsing error'));
    
    await expect(emailParserService.parseEmail('invalid email data', 'email-id', 'gmail'))
      .rejects.toThrow('Failed to parse email: Parsing error');
  });

  test('should handle email with no attachments', async () => {
    simpleParserMock.mockResolvedValueOnce({
      from: { text: 'sender@example.com' },
      to: [{ text: 'recipient@example.com' }],
      subject: 'Test Email',
      text: 'Plain text content',
      html: '<p>HTML content</p>',
      messageId: 'test-message-id',
      date: new Date(),
      references: ['ref1'],
      // No attachments field
    });

    const result = await emailParserService.parseEmail('email data', 'email-id', 'gmail');
    
    expect(result.attachments).toHaveLength(0);
  });
  
  test('isInlineAttachment static method works correctly', () => {
    const inlineAttachment = { contentDisposition: 'inline', contentId: '<test>' };
    const regularAttachment = { contentDisposition: 'attachment' };
    const missingContentDisposition = { contentId: '<test>' };
    const missingContentId = { contentDisposition: 'inline' };
    
    expect(EmailParserService.isInlineAttachment(inlineAttachment as any)).toBe(true);
    expect(EmailParserService.isInlineAttachment(regularAttachment as any)).toBe(false);
    expect(EmailParserService.isInlineAttachment(missingContentDisposition as any)).toBe(true); // Will be true because it has contentId with '<'
    expect(EmailParserService.isInlineAttachment(missingContentId as any)).toBe(true); // Will be true because it has contentDisposition 'inline'
  });
});
