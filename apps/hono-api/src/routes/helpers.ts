import type { Context } from 'hono';
import type { AppBindings } from '../db/client';

export async function jsonBody(c: Context<AppBindings>) {
  try {
    return await c.req.json();
  } catch {
    return {};
  }
}

export function dailyOrWeekly(cadence: string) {
  return cadence === 'weekly' ? 'weekly' : 'daily';
}
