import { Confirmation, Measurement, SystemMessage, SystemMessageType } from '@simplified/protocol';
import { BroadbandPublisher, BroadbandSubscriber, sleep } from '@simplified/shared';
import { EthereumAddress, Logger } from '@streamr/utils';
import { EventEmitter } from 'events';
import { MessageMetadata } from 'streamr-client';

const logger = new Logger(module);

const LIMIT = 10000;
const LOG_METRICS_INTERVAL = 10 * 1000;

interface Metrics {
	measurementsReceived: number;
	measurementsLost: number;
}

export class Cache extends EventEmitter {
	private counter: number = 0;
	private records: {
		message: SystemMessage;
		metadata: MessageMetadata;
	}[] = [];
	private readonly measurements: Map<EthereumAddress, Measurement>
	private readonly metrics: Metrics;
	private metricsTimer?: NodeJS.Timer;

	constructor(
		private readonly subscriber: BroadbandSubscriber,
		private readonly publisher: BroadbandPublisher,
	) {
		super();
		this.measurements = new Map<EthereumAddress, Measurement>();
		this.metrics = {
			measurementsReceived: 0,
			measurementsLost: 0,
		}
	}

	public async start() {
		await this.subscriber.subscribe(this.onMessage.bind(this));
		this.metricsTimer = setInterval(this.logMetrics.bind(this), LOG_METRICS_INTERVAL);

		logger.info('Started');
	}

	public async stop() {
		clearInterval(this.metricsTimer);
		await this.subscriber.unsubscribe();

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

		const confirmation = new Confirmation({
			seqNum: this.counter,
			sensorId: measurement.sensorId,
			signature: metadata.signature,
		});
		this.counter++;

		await this.publisher.publish(confirmation.serialize());
	}

	public get(from: number, to: number) {
		return this.records.filter((record) =>
			record.metadata.timestamp >= from &&
			record.metadata.timestamp < (to || Number.MAX_SAFE_INTEGER));
	}

	private logMetrics() {
		logger.info(`Metrics ${JSON.stringify(this.metrics)}`);
	}
}
