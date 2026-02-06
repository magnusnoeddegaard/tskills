import { Command } from 'commander';
import chalk from 'chalk';
import open from 'open';
import http from 'http';
import { createClient } from '@supabase/supabase-js';
import { saveCredentials, getCredentials } from '../lib/credentials.js';
import { getSupabaseUrl, getSupabaseAnonKey } from '../lib/registry.js';
import type { RegistryUser } from '../types.js';

const CALLBACK_PORT = 54321;
const CALLBACK_PATH = '/callback';

export const loginCommand = new Command('login')
  .description('Login to the tskills registry via GitHub')
  .action(async () => {
    // Track resources for cleanup
    let server: http.Server | undefined;
    let timeoutId: NodeJS.Timeout | undefined;

    /**
     * Clean up server and timeout on exit
     */
    function cleanup(): void {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
      if (server) {
        server.close();
        server = undefined;
      }
    }

    try {
      // Check if already logged in
      const existing = await getCredentials();
      if (existing) {
        console.log(chalk.yellow(`Already logged in as ${chalk.bold(existing.user.username)}`));
        console.log(chalk.gray('Use "tskills logout" to sign out first.'));
        return;
      }

      const supabaseUrl = await getSupabaseUrl();
      const supabaseAnonKey = await getSupabaseAnonKey();

      // Create a Supabase client for auth
      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      console.log(chalk.cyan('Opening browser for GitHub authentication...'));

      // Generate the OAuth URL
      // Note: Supabase handles its own OAuth state/PKCE internally.
      // Passing a custom `state` via queryParams conflicts with it and causes bad_oauth_state errors.
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `http://localhost:${CALLBACK_PORT}${CALLBACK_PATH}`,
          skipBrowserRedirect: true,
        },
      });

      if (error || !data.url) {
        throw new Error(error?.message || 'Failed to generate OAuth URL');
      }

      // Start local server to receive callback
      server = http.createServer(async (req, res) => {
        try {
          if (!req.url?.startsWith(CALLBACK_PATH)) {
            res.writeHead(404);
            res.end('Not found');
            return;
          }

          // POST /callback - receive tokens via POST body (secure)
          if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
            req.on('end', async () => {
              try {
                const { access_token: accessToken, refresh_token: refreshToken } = JSON.parse(body);

                if (!accessToken || !refreshToken) {
                  res.writeHead(400, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ success: false, error: 'Missing tokens' }));
                  cleanup();
                  console.error(chalk.red('Login failed: Missing tokens in callback'));
                  process.exit(1);
                  return;
                }

                // Set the session and get user info
                const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken,
                });

                if (sessionError || !sessionData.user) {
                  res.writeHead(400, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ success: false, error: sessionError?.message || 'Could not set session' }));
                  cleanup();
                  console.error(chalk.red(`Login failed: ${sessionError?.message || 'Could not set session'}`));
                  process.exit(1);
                  return;
                }

                // Get or create user from our users table
                const { data: userData, error: userError } = await supabase
                  .from('users')
                  .select('*')
                  .eq('id', sessionData.user.id)
                  .single();

                let registryUser: RegistryUser;

                if (userError || !userData) {
                  const meta = sessionData.user.user_metadata;
                  registryUser = {
                    id: sessionData.user.id,
                    github_id: meta.provider_id || 0,
                    username: meta.user_name || meta.preferred_username || 'unknown',
                    email: sessionData.user.email || null,
                    avatar_url: meta.avatar_url || null,
                  };
                } else {
                  registryUser = userData as RegistryUser;
                }

                // Save credentials
                await saveCredentials(accessToken, refreshToken, registryUser);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));

                console.log(chalk.green(`\nLogged in as ${chalk.bold(registryUser.username)}`));

                cleanup();
                process.exit(0);
              } catch (parseErr) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Invalid request body' }));
                cleanup();
                console.error(chalk.red(`Login error: ${(parseErr as Error).message}`));
                process.exit(1);
              }
            });
            return;
          }

          // GET /callback - serve HTML page that extracts tokens from hash and POSTs them
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <!DOCTYPE html>
            <html>
              <head><title>tskills Login</title></head>
              <body style="font-family: system-ui; text-align: center; padding: 50px;">
                <h1>Processing login...</h1>
                <script>
                  (async function() {
                    const hash = window.location.hash.substring(1);
                    if (!hash) {
                      document.body.innerHTML = '<h1 style="color: #ef4444;">Login failed</h1><p>No authentication data received.</p>';
                      return;
                    }
                    const params = new URLSearchParams(hash);
                    const accessToken = params.get('access_token');
                    const refreshToken = params.get('refresh_token');
                    if (!accessToken || !refreshToken) {
                      document.body.innerHTML = '<h1 style="color: #ef4444;">Login failed</h1><p>Could not extract tokens.</p>';
                      return;
                    }
                    try {
                      const res = await fetch('/callback', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          access_token: accessToken,
                          refresh_token: refreshToken
                        })
                      });
                      const data = await res.json();
                      if (data.success) {
                        document.body.innerHTML = '<h1 style="color: #22c55e;">Login successful!</h1><p>You can close this window and return to the terminal.</p>';
                      } else {
                        document.body.innerHTML = '<h1 style="color: #ef4444;">Login failed</h1><p>' + (data.error || 'Unknown error') + '</p>';
                      }
                    } catch (err) {
                      document.body.innerHTML = '<h1 style="color: #ef4444;">Login failed</h1><p>Could not complete authentication.</p>';
                    }
                    // Clear the hash to remove tokens from the URL
                    history.replaceState(null, '', window.location.pathname);
                  })();
                </script>
              </body>
            </html>
          `);
        } catch (err) {
          // Handle errors within request handler
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end('<h1>Login failed</h1><p>An unexpected error occurred.</p>');
          cleanup();
          console.error(chalk.red(`Login error: ${(err as Error).message}`));
          process.exit(1);
        }
      });

      // Handle server errors (e.g., port already in use)
      server.on('error', (err: NodeJS.ErrnoException) => {
        cleanup();
        if (err.code === 'EADDRINUSE') {
          console.error(chalk.red(`Port ${CALLBACK_PORT} is already in use.`));
          console.log(chalk.gray('Make sure no other tskills login is running, or wait and try again.'));
        } else {
          console.error(chalk.red(`Server error: ${err.message}`));
        }
        process.exit(1);
      });

      server.listen(CALLBACK_PORT, () => {
        console.log(chalk.gray(`Waiting for callback on http://localhost:${CALLBACK_PORT}...`));
      });

      // Open the browser
      await open(data.url);

      // Timeout after 5 minutes
      timeoutId = setTimeout(() => {
        console.log(chalk.red('\nLogin timed out. Please try again.'));
        cleanup();
        process.exit(1);
      }, 5 * 60 * 1000);

    } catch (error) {
      cleanup();
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });
