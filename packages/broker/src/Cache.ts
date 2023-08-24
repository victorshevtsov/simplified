import { SystemMessage, SystemMessageType } from '@simplified/protocol';
import { BroadbandSubscriber } from '@simplified/shared';
import { Logger } from '@streamr/utils';
import { EventEmitter } from 'events';
import { MessageMetadata } from 'streamr-client';

const logger = new Logger(module);

const LIMIT = 100_000;

export class Cache extends EventEmitter {
	private records: {
		message: SystemMessage;
		metadata: MessageMetadata;
	}[] = [];

	constructor(
		private readonly subscriber: BroadbandSubscriber,
	) {
		super();
	}

	public async start() {
		await this.subscriber.subscribe(this.onMessage.bind(this));

		logger.info('Started');
	}

	public async stop() {
		await this.subscriber.unsubscribe();

		logger.info('Stopped');
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
	}

	public get(from: number, to: number) {
		return this.records.filter((record) =>
			record.metadata.timestamp >= from &&
			record.metadata.timestamp < (to || Number.MAX_SAFE_INTEGER));
	}
}
