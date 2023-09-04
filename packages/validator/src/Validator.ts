import { Logger } from '@streamr/utils';
import { Listener } from './Listener';

const logger = new Logger(module);

export class Validator {
  constructor(
    private readonly listener: Listener,
  ) {
    //
  }

  public async start() {
    await this.listener.start();

    logger.info('Started');
  }

  public async stop() {
    await this.listener.stop();

    logger.info('Stopped');
  }
}
