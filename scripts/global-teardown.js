import { getLogger } from '../src/logging/index.js';

export default async function globalTeardown() {
  const logger = getLogger();
  logger.info('Global teardown: starting cleanup');

  // Add cleanup logic here:
  // - Delete test users created during the run
  // - Reset database state via API
  // - Clean up uploaded files
  // - Flush log buffers

  logger.info('Global teardown: cleanup complete');
}
