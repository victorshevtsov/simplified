import { Logger } from '@streamr/utils';
import { Cache } from './Cache';
import { Recovery } from './Recovery';

const logger = new Logger(module);

export class Broker {

  constructor(
    private readonly cache: Cache,
    private readonly recovery: Recovery,
  ) {
    //
  }

  public async start() {
    await Promise.all([
      this.cache.start(),
      this.recovery.start(),
    ]);

    logger.info('Started');
  }

  public async stop() {
    await Promise.all([
      this.recovery.stop(),
      this.cache.stop(),
    ]);

    logger.info('Stopped');
  }
}
