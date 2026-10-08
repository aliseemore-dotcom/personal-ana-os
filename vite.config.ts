import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Local development only (SHEETS_MOCK=1): serves /api from an in-memory copy of the Data Hub,
 * so the whole path can run with no Google account. Not part of the production build.
 */
function mockDataHub(): Plugin {
  const mount = async (middlewares: { use: (fn: (req: any, res: any, next: () => void) => void) => void }) => {
    const { handleData, handleWrite } = await import('./server/http.ts');
    const { createSheetsHub } = await import('./server/hub.ts');
    const { buildFixtureWorkbook, createFakeSheets } = await import('./server/sheets/fixture.ts');
    const env = { DASHBOARD_ACCESS_KEY: process.env.DASHBOARD_ACCESS_KEY || 'dev-key' };
    const { handleCalendar } = await import('./server/http.ts');
    const { withCache } = await import('./server/calendar.ts');
    const { createMockCalendarProvider } = await import('./src/services/calendar/mockProvider.ts');
    const calendar = withCache(createMockCalendarProvider());
    const hub = createSheetsHub(createFakeSheets(buildFixtureWorkbook(new Date())), { writable: true, ttlMs: 30_000, minForceIntervalMs: 2_000 });
    middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith('/api/')) return next();
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const request = new Request(`http://localhost${req.url}`, {
        method: req.method,
        headers: req.headers as Record<string, string>,
        body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
      });
      const response = req.url.startsWith('/api/write')
        ? await handleWrite(request, env, hub)
        : req.url.startsWith('/api/calendar')
          ? await handleCalendar(request, env, calendar)
          : await handleData(request, env, hub);
      res.statusCode = response.status;
      response.headers.forEach((v, k) => res.setHeader(k, v));
      res.end(await response.text());
    });
    console.log(`[mock data hub] /api is served from memory. Access key: ${env.DASHBOARD_ACCESS_KEY}`);
  };
  return {
    name: 'personal-os-mock-data-hub',
    apply: () => process.env.SHEETS_MOCK === '1',
    configureServer: (server) => mount(server.middlewares),
    configurePreviewServer: (server) => mount(server.middlewares),
  };
}

export default defineConfig({
  plugins: [react(), mockDataHub()],
  test: { environment: 'node', include: ['src/**/*.test.ts', 'server/**/*.test.ts'] },
});
