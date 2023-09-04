import { Confirmation, Measurement, SystemMessage, SystemMessageType } from '@simplified/protocol';
import { BroadbandSubscriber } from '@simplified/shared';
import { EthereumAddress, Logger } from '@streamr/utils';
import { MessageMetadata } from 'streamr-client';
import { Recovery } from './Recovery';

const LOG_EVERY_CONFIRMATION = 1000;
const LOG_EVERY_MEASUREMENT = 1000;

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

    this.measurements.set(metadata.publisherId, measurement);

    if (measurement.seqNum % LOG_EVERY_MEASUREMENT === 0) {
      logger.info(`Measurement ${JSON.stringify({
        publisherId: metadata.publisherId,
        seqNum: measurement.seqNum,
      })}`)
    }
  }

  private async onConfirmation(
    confirmation: Confirmation,
    metadata: MessageMetadata
  ): Promise<void> {
    const prevConfirmation = this.confirmations.get(metadata.publisherId);
    if (prevConfirmation &&
      confirmation.seqNum - prevConfirmation.seqNum !== 1) {
      logger.error(
        `Unexpected Confrmation seqNum ${JSON.stringify({
          publisherId: metadata.publisherId,
          prev: prevConfirmation.seqNum,
          curr: confirmation.seqNum
        })}`
      );
    }

    this.confirmations.set(metadata.publisherId, confirmation);

    if (confirmation.seqNum % LOG_EVERY_CONFIRMATION === 0) {
      logger.info(`Confirmation ${JSON.stringify({
        publisherId: metadata.publisherId,
        seqNum: confirmation.seqNum,
      })}`)
    }
  }
}
