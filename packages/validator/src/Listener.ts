import { Confirmation, Measurement, SystemMessage, SystemMessageType } from '@simplified/protocol';
import { BroadbandSubscriber, Metrics } from '@simplified/shared';
import { Logger } from '@streamr/utils';
import { MessageMetadata } from 'streamr-client';
import { Recovery } from './Recovery';

const LOG_METRICS_INTERVAL = 10 * 1000;

const logger = new Logger(module);

export class Listener {
  private readonly measurementMetrics: Metrics;
  private readonly confirmationMetrics: Metrics;
  private metricsTimer?: NodeJS.Timer;

  constructor(
    private readonly systemSubscriber: BroadbandSubscriber,
    private readonly sensorSubscriber: BroadbandSubscriber,
    private readonly recovery?: Recovery,
  ) {
    this.measurementMetrics = new Metrics("Measurement");
    this.confirmationMetrics = new Metrics("Confirmation");
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
    this.measurementMetrics.update(metadata.publisherId, measurement.seqNum);
  }

  private async onConfirmation(
    confirmation: Confirmation,
    metadata: MessageMetadata
  ): Promise<void> {
    this.confirmationMetrics.update(metadata.publisherId, confirmation.seqNum);
  }

  private logMetrics() {
    logger.info(`Metrics ${JSON.stringify({
      measurements: this.measurementMetrics.summary,
      confirmations: this.confirmationMetrics.summary,
    })}`);
  }
}
