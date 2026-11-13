import { makeRouteHandler } from '@keystatic/next/route-handler';
import config from '../../../../../keystatic.config';
import { adminEnabled } from '@/lib/admin';

// Never prerendered or cached: the answer depends on the deployment's variables.
export const dynamic = 'force-dynamic';

// See src/lib/admin.ts: without `next dev` or a complete GitHub setup the API does not exist.
const handlers = adminEnabled ? makeRouteHandler({ config }) : null;

const notFound = () => new Response('Not Found', { status: 404, headers: { 'cache-control': 'no-store' } });

export async function GET(request: Request): Promise<Response> {
  return handlers ? handlers.GET(request) : notFound();
}

export async function POST(request: Request): Promise<Response> {
  return handlers ? handlers.POST(request) : notFound();
}
