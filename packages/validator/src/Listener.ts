import { Measurement, SystemMessage, SystemMessageType } from '@simplified/protocol';
import { BroadbandSubscriber } from '@simplified/shared';
import { Logger } from '@streamr/utils';
import { MessageMetadata } from 'streamr-client';
import { Recovery } from './Recovery';

const logger = new Logger(module);

export class Listener {
  private readonly sensors: Map<string, Measurement>

  constructor(
    private readonly sensorSubscriber: BroadbandSubscriber,
    private readonly recovery?: Recovery,
  ) {
    this.sensors = new Map<string, Measurement>();
  }

  public async start() {
    await this.sensorSubscriber.subscribe(this.onMessage.bind(this));
    await this.recovery?.start(this.onMeasurement);

    logger.info('Started');
  }

  public async stop() {
    await this.recovery?.stop();
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

    const measurement = systemMessage as Measurement;
    await this.onMeasurement(measurement, metadata);
  }

  private async onMeasurement(
    measurement: Measurement,
    metadata: MessageMetadata
  ): Promise<void> {
    const prevMeasurement = this.sensors.get(measurement.sensorId);
    if (prevMeasurement &&
      measurement.seqNum - prevMeasurement.seqNum !== 1) {
      logger.error(
        `Unexpected Measurement seqNum ${JSON.stringify({
          sensorId: measurement.sensorId,
          prev: prevMeasurement.seqNum,
          curr: measurement.seqNum
        })}`
      );
    }

    this.sensors.set(measurement.sensorId, measurement);
  }
}