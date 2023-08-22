import { SystemMessage, SystemMessageType } from '@simplified/protocol';
import { BroadbandSubscriber } from '@simplified/shared';
import { Logger } from '@streamr/utils';
import { MessageMetadata } from 'streamr-client';
import { Recovery } from './Recovery';

const logger = new Logger(module);

export class Listener {
  constructor(
    private readonly sensorSubscriber: BroadbandSubscriber,
    private readonly recovery: Recovery,
  ) {
    //
  }

  public async start() {
    logger.info('Started');
    await this.sensorSubscriber.subscribe(this.onMessage.bind(this));
    await this.recovery.start(this.onSystemMessage);
  }

  public async stop() {
    await this.recovery.stop();
    await this.sensorSubscriber.unsubscribe();
    logger.info('Stopped');
  }

  private async onMessage(
    content: unknown,
    metadata: MessageMetadata
  ): Promise<void> {

    const systemMessage = SystemMessage.deserialize(content);
    if (systemMessage.messageType !== SystemMessageType.Measurement) {
      return;
    }

    await this.onSystemMessage(systemMessage, metadata);
  }

  private async onSystemMessage(
    systemMessage: SystemMessage,
    metadata: MessageMetadata
  ): Promise<void> {
    // logger.info('onSystemMessage', { systemMessage });
  }
}