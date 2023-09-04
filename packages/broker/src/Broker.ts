import { Logger } from '@streamr/utils';
import { Cache } from './Cache';
import { Recovery } from './Recovery';
import { Sensor } from './Sensor';

const logger = new Logger(module);

export class Broker {

  constructor(
    private readonly sensor: Sensor,
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

    await this.sensor.start(),

    logger.info('Started');
  }

  public async stop() {
    await this.sensor.stop(),

    await Promise.all([
      this.recovery.stop(),
      this.cache.stop(),
    ]);

    logger.info('Stopped');
  }
}
