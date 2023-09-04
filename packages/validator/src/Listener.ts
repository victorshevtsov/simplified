import { Confirmation, Measurement, SystemMessage, SystemMessageType } from '@simplified/protocol';
import { BroadbandSubscriber, sleep } from '@simplified/shared';
import { EthereumAddress, Logger } from '@streamr/utils';
import { MessageMetadata } from 'streamr-client';
import { Recovery } from './Recovery';

const logger = new Logger(module);

export class Listener {
  private readonly measurements: Map<EthereumAddress, Measurement>
  private readonly confirmations: Map<EthereumAddress, Confirmation>

  constructor(
    private readonly systemSubscriber: BroadbandSubscriber,
    private readonly sensorSubscriber: BroadbandSubscriber,
    private readonly recovery?: Recovery,
  ) {
    this.measurements = new Map<EthereumAddress, Measurement>();
    this.confirmations = new Map<EthereumAddress, Confirmation>();
  }

  public async start() {
    await this.systemSubscriber.subscribe(this.onSystemMessage.bind(this));
    await this.sensorSubscriber.subscribe(this.onSensorMessage.bind(this));
    await this.recovery?.start(this.onMeasurement);

    logger.info('Started');
  }

  public async stop() {
    await this.recovery?.stop();
    await this.sensorSubscriber.unsubscribe();

    logger.info('Stopped');
  }

  private async onSensorMessage(
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

  private async onSystemMessage(
    content: unknown,
    metadata: MessageMetadata
  ): Promise<void> {

    const systemMessage = SystemMessage.deserialize(content);
    if (systemMessage.messageType !== SystemMessageType.Confirmation) {
      return;
    }

    const confirmation = systemMessage as Confirmation;
    await this.onConfirmation(confirmation, metadata);
  }

  private async onMeasurement(
    measurement: Measurement,
    metadata: MessageMetadata
  ): Promise<void> {
    const prevMeasurement = this.measurements.get(metadata.publisherId);
    if (prevMeasurement &&
      measurement.seqNum - prevMeasurement.seqNum !== 1) {
      logger.error(
        `Unexpected Measurement seqNum ${JSON.stringify({
          publisherId: metadata.publisherId,
          prev: prevMeasurement.seqNum,
          curr: measurement.seqNum
        })}`
      );
    }

    await sleep(100);

    this.measurements.set(metadata.publisherId, measurement);
  }

  private async onConfirmation(
    confirtmation: Confirmation,
    metadata: MessageMetadata
  ): Promise<void> {
    const prevConfirmation = this.confirmations.get(metadata.publisherId);
    if (prevConfirmation &&
      confirtmation.seqNum - prevConfirmation.seqNum !== 1) {
      logger.error(
        `Unexpected Confrmation seqNum ${JSON.stringify({
          publisherId: metadata.publisherId,
          prev: prevConfirmation.seqNum,
          curr: confirtmation.seqNum
        })}`
      );
    }

    await sleep(100);

    this.confirmations.set(metadata.publisherId, confirtmation);
  }
}