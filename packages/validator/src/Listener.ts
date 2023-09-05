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
    private readonly measurementSubscriber: BroadbandSubscriber,
    private readonly confirmationSubscriber: BroadbandSubscriber,
    private readonly recovery?: Recovery,
  ) {
    this.measurementMetrics = new Metrics("Measurement");
    this.confirmationMetrics = new Metrics("Confirmation");
  }

  public async start() {
    await this.measurementSubscriber.subscribe(this.onMeasurementMessage.bind(this));
    await this.confirmationSubscriber.subscribe(this.onConfirmationMessage.bind(this));
    await this.recovery?.start(this.onMeasurement.bind(this));
    this.metricsTimer = setInterval(this.logMetrics.bind(this), LOG_METRICS_INTERVAL);

    logger.info('Started');
  }

  public async stop() {
    clearInterval(this.metricsTimer);
    await this.recovery?.stop();
    await this.measurementSubscriber.unsubscribe();
    await this.confirmationSubscriber.unsubscribe();

    logger.info('Stopped');
    this.logMetrics();
  }

  private async onMeasurementMessage(
    content: unknown,
    metadata: MessageMetadata
  ): Promise<void> {

    const systemMessage = SystemMessage.deserialize(content);
    if (systemMessage.messageType !== SystemMessageType.Measurement) {
      return;
    }

    const measurement = systemMessage as Measurement;
    await this.onMeasurement(measurement, metadata, false);
  }

  private async onConfirmationMessage(
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
    metadata: MessageMetadata,
    isRecovery: boolean,
  ): Promise<void> {
    if (!isRecovery) {
      this.measurementMetrics.update(metadata.publisherId, measurement.seqNum);
    }
  }

  private async onConfirmation(
    confirmation: Confirmation,
    metadata: MessageMetadata
  ): Promise<void> {
    this.confirmationMetrics.update(metadata.publisherId, confirmation.seqNum);
  }

  private logMetrics() {
    logger.info(`Metrics ${JSON.stringify([
      this.measurementMetrics.summary,
      this.confirmationMetrics.summary,
    ])}`);
  }
}
