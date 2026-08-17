import { rm } from 'node:fs/promises';

const temporaryDatabases = [
  '/tmp/astar-customs-e2e-orders.db',
  '/tmp/astar-customs-e2e-reviews.db',
] as const;

export default async function globalTeardown() {
  await Promise.all(
    temporaryDatabases.map((database) => rm(database, { force: true })),
  );
}
