import { handleCalendar } from '../server/http.js';

/** GET /api/calendar — upcoming events from Google Calendar, read on the server. */
export const GET = (req: Request) => handleCalendar(req);
