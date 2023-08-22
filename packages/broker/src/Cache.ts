import { SystemMessage, SystemMessageType } from '@simplified/protocol';
import { BroadbandSubscriber } from '@simplified/shared';
import { Logger } from '@streamr/utils';
import { EventEmitter } from 'events';
import { MessageMetadata, Stream, StreamrClient } from 'streamr-client';

const logger = new Logger(module);

const LIMIT = 10000;

export class Cache extends EventEmitter {
	private subscriber: BroadbandSubscriber;

	private records: {
		message: SystemMessage;
		metadata: MessageMetadata;
	}[] = [];

	constructor(
		private readonly client: StreamrClient,
		private readonly stream: Stream,
	) {
		super();

		this.subscriber = new BroadbandSubscriber(
			this.client,
			this.stream
		);
	}

	public async start() {
		logger.info('Started');
		await this.subscriber.subscribe(this.onMessage.bind(this));
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

	public get(from: number) {
		return this.records.filter((record) => record.metadata.timestamp >= from);
	}
}
