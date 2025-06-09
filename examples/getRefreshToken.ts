// filepath: getRefreshToken.js
import { google } from 'googleapis';
import express, { Request, Response, Application } from 'express';
import open from 'open';
import http from 'http';
import url from 'url';
import dotenv from 'dotenv';
import { Credentials } from 'google-auth-library';

// Load environment variables from .env file (still useful for the example itself)
dotenv.config();

// Replace with your credentials from GCP
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI; // Must be in your GCP authorized redirect URIs

if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
  console.error('Missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_REDIRECT_URI in .env file.');
  process.exit(1);
}

const SCOPES = ['https://mail.google.com/']; // Or 'https://www.googleapis.com/auth/gmail.readonly'

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,      // Ensured to be string by the check above
  CLIENT_SECRET,  // Ensured to be string by the check above
  REDIRECT_URI    // Ensured to be string by the check above
);

async function main(): Promise<Credentials> {
  const app: Application = express();
  let server: http.Server | undefined;

  return new Promise<Credentials>((resolve, reject) => {
    server = http.createServer(app).listen(3000, () => {
      const authorizeUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline', // Important to get a refresh token
        scope: SCOPES,
        prompt: 'consent', // Ensures you get a refresh token even if previously authorized
      });
      console.log('Authorize this app by visiting this url:', authorizeUrl);
      open(authorizeUrl).catch(err => {
        console.error('Failed to open browser:', err);
        // Depending on the desired behavior, you might want to reject the promise here
        // reject(new Error('Failed to open browser'));
      });
    });

    app.get('/oauth2callback', async (req: Request, res: Response) => {
      const reqUrl = req.url;
      if (!reqUrl) {
        const errMsg = 'Request URL is undefined.';
        console.error(errMsg);
        res.status(500).send(errMsg);
        if (server) server.close();
        reject(new Error(errMsg));
        return;
      }
      const query = url.parse(reqUrl, true).query;

      if (query.error) {
        const errorMsg = Array.isArray(query.error) ? query.error.join(', ') : query.error as string;
        console.error('Error during OAuth callback:', errorMsg);
        res.send(`Error during authentication: ${errorMsg}. Check console.`);
        if (server) server.close();
        reject(new Error(errorMsg));
        return;
      }

      const code = query.code;
      if (!code || typeof code !== 'string') {
        const errMsg = 'Authorization code not found or is invalid in query parameters.';
        console.error(errMsg);
        res.status(400).send(errMsg);
        if (server) server.close();
        reject(new Error(errMsg));
        return;
      }
      
      res.send('Authentication successful! You can close this tab. Check your console for the refresh token.');

      try {
        const { tokens } = await oauth2Client.getToken(code);
        console.log('Received tokens:', tokens);
        if (tokens.refresh_token) {
          console.log('\n\nSUCCESS! Your Refresh Token is:\n');
          console.log(tokens.refresh_token);
          console.log('\nCopy this token into your .env file as GOOGLE_REFRESH_TOKEN\n');
        } else {
          console.log('\n\nNo refresh token received. This can happen if:');
          console.log('1. You did not include "access_type: \'offline\'".');
          console.log('2. You did not include "prompt: \'consent\'" and have previously authorized this app for these scopes.');
          console.log('3. The OAuth client is not configured for a refresh token (e.g., some web app configurations).');
        }
        resolve(tokens);
      } catch (err) {
        console.error('Error while trying to retrieve access token', err);
        reject(err);
      } finally {
        if (server) {
          server.close(closeErr => {
            if (closeErr) console.error('Error closing server:', closeErr);
          });
        }
      }
    });

    server.on('error', (err) => {
      console.error('Server error:', err);
      reject(err); // Reject the main promise if the server fails to start
    });
  });
}

main()
  .then((tokens) => {
    console.log('Refresh token retrieval process finished.');
    // You might want to do something with the tokens here if needed, 
    // though the primary goal is to print the refresh_token to console.
  })
  .catch(err => {
    console.error('Error in refresh token retrieval process:', err.message);
    process.exitCode = 1; // Indicate an error exit
  });