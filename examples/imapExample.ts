import { ImapAdapter } from '../src';

const imap = new ImapAdapter({
  host: 'imap.mail.yahoo.com',
  port: 993,
  secure: true,
  auth: {
    user: 'user@yahoo.com',
    pass: 'app-password-here',
  },
});

(async () => {
  const emails = await imap.fetchEmails({
    since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // last 7 days
    limit: 10,
  });

  emails.forEach(e => console.log(e.subject, e.attachments.length));
})();
