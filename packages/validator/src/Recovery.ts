import {
	RecoveryComplete,
	RecoveryRequest,
	RecoveryResponse,
	SystemMessage,
	SystemMessageType,
} from '@simplified/protocol';
import { StreamPublisher, StreamSubscriber } from '@simplified/shared';
import { Logger } from '@streamr/utils';
import {
	EthereumAddress,
	MessageMetadata,
	Stream,
	StreamrClient
} from 'streamr-client';
import { v4 as uuid } from 'uuid';

const MESSAGE_TYPES = [
	SystemMessageType.RecoveryResponse,
	SystemMessageType.RecoveryComplete,
];

const BROKERS = [
	'0x392bd2cb87f5670f321ad521397d30a00c582b34' as EthereumAddress,
	'0x50048764ed9b8ae502ab7785684f6959b9b7831a' as EthereumAddress,
	'0x5e98df807c09a91557d8b3161f2d01852fb005b9' as EthereumAddress,
	'0xa8380efd258ab0f08dd1c0c8bc0e332efbbe7650' as EthereumAddress,
	'0xb9d980f332e4528a9470ce934d53f39d644cc5df' as EthereumAddress,
	'0xf667f0dc2089c849b30910837fe36f4d5a40f6f9' as EthereumAddress,
]

interface RecoveryProgress {
	timestamp?: number;
	isComplete: boolean;
}

const logger = new Logger(module);

export class Recovery {
	private requestId?: string;
	private publisher: StreamPublisher
	private subscriber: StreamSubscriber;

	private progresses: Map<EthereumAddress, RecoveryProgress> = new Map();

	constructor(
		private readonly client: StreamrClient,
		private readonly stream: Stream,
		private readonly onSystemMessage: (systemMessage: SystemMessage, metadata: MessageMetadata) => Promise<void>
	) {
		this.publisher = new StreamPublisher(this.client, this.stream);
		this.subscriber = new StreamSubscriber(this.client, this.stream);
	}

	public async start() {
		logger.info('Starting Recovery...');

		await this.subscriber.subscribe(this.onMessage.bind(this));

		this.requestId = uuid();
		const recoveryRequest = new RecoveryRequest({ requestId: this.requestId });
		await this.publisher.publish(recoveryRequest.serialize());

		for (const broker of BROKERS) {
			this.progresses.set(broker, { isComplete: false });
		}
	}

	public async stop() {
		await this.subscriber.unsubscribe();
	}

	public get progress(): RecoveryProgress {
		const result: RecoveryProgress = {
			timestamp: Number.MAX_SAFE_INTEGER,
			isComplete: true,
		};

		for (const [_, progress] of this.progresses) {
			if (progress.timestamp === undefined) {
				return { isComplete: false };
			}

			result.timestamp = Math.min(result.timestamp!, progress.timestamp);
			result.isComplete = result.isComplete && progress.isComplete;
		}

		return result;
	}

	private async onMessage(
		content: unknown,
		metadata: MessageMetadata
	): Promise<void> {
		const systemMessage = SystemMessage.deserialize(content);
		if (!MESSAGE_TYPES.includes(systemMessage.messageType)) {
			return;
		}

		let progress = this.progresses.get(metadata.publisherId);
		if (!progress) {
			progress = { isComplete: false };
			this.progresses.set(metadata.publisherId, progress);
		}

		switch (systemMessage.messageType) {
			case SystemMessageType.RecoveryResponse: {
				const recoveryResponse = systemMessage as RecoveryResponse;

				if (recoveryResponse.requestId != this.requestId) {
					return;
				}

				logger.info(
					`Processing RecoveryResponse ${JSON.stringify({
						publisherId: metadata.publisherId,
						payloadLength: recoveryResponse.payload.length,
					})}`
				);

				for await (const [msg, msgMetadata] of recoveryResponse.payload) {
					await this.onSystemMessage(msg, msgMetadata as MessageMetadata);
					progress.timestamp = metadata.timestamp;
				}

				break;
			}
			case SystemMessageType.RecoveryComplete: {
				const recoveryComplete = systemMessage as RecoveryComplete;

				if (recoveryComplete.requestId != this.requestId) {
					return;
				}

				logger.info(
					`Processing RecoveryComplete ${JSON.stringify({
						publisherId: metadata.publisherId,
					})}`
				);

				// if no recovery messages received
				if (progress.timestamp === undefined) {
					progress.timestamp = 0;
				}

				progress.isComplete = true;

				if (this.progress.isComplete) {
					logger.info('Successfully complete Recovery');
					await this.stop();
				}
				break;
			}
		}
	}
}
