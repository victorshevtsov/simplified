import { Confirmation, Measurement, SystemMessage, SystemMessageType } from '@simplified/protocol';
import { BroadbandPublisher, BroadbandSubscriber, Metrics } from '@simplified/shared';
import { Logger } from '@streamr/utils';
import { EventEmitter } from 'events';
import { MessageMetadata } from 'streamr-client';

const logger = new Logger(module);

const LIMIT = 10000;
const LOG_METRICS_INTERVAL = 10 * 1000;

export class Cache extends EventEmitter {
	private counter: number = 0;
	private records: {
		message: SystemMessage;
		metadata: MessageMetadata;
	}[] = [];
	private readonly measurementMetrics: Metrics;
	private metricsTimer?: NodeJS.Timer;

	constructor(
		private readonly measurementSubscriber: BroadbandSubscriber,
		private readonly confirmationPublisher: BroadbandPublisher,
	) {
		super();
		this.measurementMetrics = new Metrics("Measurement");
	}

	public async start() {
		await this.measurementSubscriber.subscribe(this.onMessage.bind(this));
		this.metricsTimer = setInterval(this.logMetrics.bind(this), LOG_METRICS_INTERVAL);

		logger.info('Started');
	}

	public async stop() {
		clearInterval(this.metricsTimer);
		await this.measurementSubscriber.unsubscribe();

		logger.info('Stopped');
		this.logMetrics();
	}

	private async onMessage(content: unknown, metadata: MessageMetadata) {
		const systemMessage = SystemMessage.deserialize(content);
		if (systemMessage.messageType !== SystemMessageType.Measurement) {
			return;
		}

		this.records.push({
			message: systemMessage,
			metadata,
		});

		if (this.records.length > LIMIT) {
			this.records.splice(0, this.records.length - LIMIT);
			this.emit('full');
		}

		const measurement = systemMessage as Measurement;

		this.measurementMetrics.update(metadata.publisherId, measurement.seqNum);

		const confirmation = new Confirmation({
			seqNum: this.counter,
			sensorId: measurement.sensorId,
			signature: metadata.signature,
		});
		this.counter++;

		await this.confirmationPublisher.publish(confirmation.serialize());
	}

	public get(from: number, to: number) {
		return this.records.filter((record) =>
			record.metadata.timestamp >= from &&
			record.metadata.timestamp < (to || Number.MAX_SAFE_INTEGER));
	}

	private logMetrics() {
		logger.info(`Metrics ${JSON.stringify(this.measurementMetrics.summary)}`);
	}
}
