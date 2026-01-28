const SECRET = 'matt2026stanley';
const COOKIE_NAME = 'auth_token';
const NINETY_DAYS = 60 * 60 * 24 * 90;

export default function middleware(request) {
  const url = new URL(request.url);

  // Check cookie
  const cookies = request.headers.get('cookie') || '';
  const authCookie = cookies.split(';').map(c => c.trim()).find(c => c.startsWith(COOKIE_NAME + '='));
  if (authCookie && authCookie.split('=')[1] === SECRET) {
    return undefined; // allow through
  }

  // Check Authorization: Bearer header (for API access from Stanley)
  const authHeader = request.headers.get('authorization') || '';
  if (authHeader === `Bearer ${SECRET}`) {
    return undefined;
  }

  // Check ?token= query param
  const tokenParam = url.searchParams.get('token');
  if (tokenParam === SECRET) {
    url.searchParams.delete('token');
    const cleanUrl = url.toString();
    return new Response(null, {
      status: 302,
      headers: {
        'Location': cleanUrl,
        'Set-Cookie': `${COOKIE_NAME}=${SECRET}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${NINETY_DAYS}`,
      },
    });
  }

  // Unauthorized
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Unauthorized</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         background:#0a0a0a; color:#888; font-family:-apple-system,BlinkMacSystemFont,sans-serif; }
  h1 { font-size:1.2rem; font-weight:400; letter-spacing:0.05em; }
</style></head>
<body><h1>Unauthorized &mdash; Access required</h1></body>
</html>`,
    { status: 401, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
};
