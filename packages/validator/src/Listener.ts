import { Confirmation, Measurement, SystemMessage, SystemMessageType } from '@simplified/protocol';
import { BroadbandSubscriber } from '@simplified/shared';
import { EthereumAddress, Logger } from '@streamr/utils';
import { MessageMetadata } from 'streamr-client';
import { Recovery } from './Recovery';

const LOG_METRICS_INTERVAL = 10 * 1000;

const logger = new Logger(module);

interface Metrics {
  measurementsReceived: number;
  confirmationsReceived: number;
  measurementsLost: number;
  confirmationsLost: number;
}

export class Listener {
  private readonly measurements: Map<EthereumAddress, Measurement>
  private readonly confirmations: Map<EthereumAddress, Confirmation>
  private readonly metrics: Metrics;
  private metricsTimer?: NodeJS.Timer;

  constructor(
    private readonly systemSubscriber: BroadbandSubscriber,
    private readonly sensorSubscriber: BroadbandSubscriber,
    private readonly recovery?: Recovery,
  ) {
    this.measurements = new Map<EthereumAddress, Measurement>();
    this.confirmations = new Map<EthereumAddress, Confirmation>();
    this.metrics = {
      measurementsReceived: 0,
      measurementsLost: 0,
      confirmationsReceived: 0,
      confirmationsLost: 0,
    };
  }

  public async start() {
    await this.systemSubscriber.subscribe(this.onSystemMessage.bind(this));
    await this.sensorSubscriber.subscribe(this.onSensorMessage.bind(this));
    await this.recovery?.start(this.onMeasurement);
    this.metricsTimer = setInterval(this.logMetrics.bind(this), LOG_METRICS_INTERVAL);

    logger.info('Started');
  }

  public async stop() {
    clearInterval(this.metricsTimer);
    await this.recovery?.stop();
    await this.systemSubscriber.unsubscribe();
    await this.sensorSubscriber.unsubscribe();

    logger.info('Stopped');
    this.logMetrics();
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
    this.metrics.measurementsReceived++;

    const prevMeasurement = this.measurements.get(metadata.publisherId);
    if (prevMeasurement &&
      measurement.seqNum - prevMeasurement.seqNum > 1) {
      const lost = measurement.seqNum - prevMeasurement.seqNum;
      this.metrics.measurementsLost += lost;

      logger.error(
        `Unexpected Measurement seqNum ${JSON.stringify({
          publisherId: metadata.publisherId,
          prev: prevMeasurement.seqNum,
          curr: measurement.seqNum,
          lost,
        })}`
      );
    }

    this.measurements.set(metadata.publisherId, measurement);
  }

  private async onConfirmation(
    confirmation: Confirmation,
    metadata: MessageMetadata
  ): Promise<void> {
    this.metrics.confirmationsReceived++;

    const prevConfirmation = this.confirmations.get(metadata.publisherId);
    if (prevConfirmation &&
      confirmation.seqNum - prevConfirmation.seqNum > 1) {
      const lost = confirmation.seqNum - prevConfirmation.seqNum;
      this.metrics.confirmationsLost += lost;

      logger.error(
        `Unexpected Confrmation seqNum ${JSON.stringify({
          publisherId: metadata.publisherId,
          prev: prevConfirmation.seqNum,
          curr: confirmation.seqNum,
          lost,
        })}`
      );
    }

    this.confirmations.set(metadata.publisherId, confirmation);
  }

  private logMetrics() {
    logger.info(`Metrics ${JSON.stringify(this.metrics)}`);
  }
}
