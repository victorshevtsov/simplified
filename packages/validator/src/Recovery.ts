import {
	Measurement,
	RecoveryComplete,
	RecoveryRequest,
	RecoveryResponse,
	SystemMessage,
	SystemMessageType,
} from '@simplified/protocol';
import { Logger } from '@streamr/utils';
import {
	EthereumAddress,
	MessageMetadata,
	Stream,
	StreamrClient,
	Subscription
} from 'streamr-client';
import { v4 as uuid } from 'uuid';
import { ActivityTimeout } from './ActivityTimeout';

const START_DELAY = 5 * 1000;
const RESTART_DELAY = 30 * 1000;
const ACTIVITY_TIMEOUT = 30 * 1000;

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
	lastSeqNum: number;
	isComplete: boolean;
	isFulfilled: boolean;
}

interface RecoverySummary {
	timestamp?: number;
	isComplete: boolean;
	isFulfilled: boolean;
}

const logger = new Logger(module);

export class Recovery {
	private requestId?: string;
	private subscription?: Subscription;
	private onMeasurement?: (measurement: Measurement, metadata: MessageMetadata) => Promise<void>;

	private progresses: Map<EthereumAddress, RecoveryProgress> = new Map();
	private isRestarting: boolean = false;

	private activityTimeout: ActivityTimeout;
	private restartTimeout?: NodeJS.Timeout;

	constructor(
		private readonly client: StreamrClient,
		private readonly systemStream: Stream,
		private readonly recoveryStream: Stream,
	) {
		this.activityTimeout = new ActivityTimeout(this.onActivityTimeout.bind(this), ACTIVITY_TIMEOUT);
	}

	public async start(
		onMeasurement: (measurement: Measurement, metadata: MessageMetadata) => Promise<void>
	) {
		this.onMeasurement = onMeasurement;
		this.subscription = await this.client.subscribe(this.recoveryStream, this.onRecoveryMessage.bind(this));

		logger.info(`Waiting for ${START_DELAY}ms to form peer connections...`);
		setTimeout(this.sendRecoveryRequest.bind(this), START_DELAY);

		logger.info('Started');
	}

	public async stop() {
		this.activityTimeout.stop();
		clearTimeout(this.restartTimeout);

		await this.subscription?.unsubscribe();
		this.subscription = undefined;

		logger.info('Stopped');
	}

	public get progress(): RecoverySummary {
		if (this.progresses.size === 0) {
			return { isComplete: false, isFulfilled: false };
		}

		const summary: RecoverySummary = {
			timestamp: Number.MAX_SAFE_INTEGER,
			isComplete: true,
			isFulfilled: true,
		};

		for (const [_, progress] of this.progresses) {
			if (progress.timestamp === undefined) {
				return { isComplete: false, isFulfilled: false };
			}

			summary.timestamp = Math.min(summary.timestamp || 0, progress.timestamp);
			summary.isComplete = summary.isComplete && progress.isComplete;
			summary.isFulfilled = summary.isFulfilled && progress.isFulfilled;
		}

		return summary;
	}

	private async onActivityTimeout() {
		logger.warn('Activity timeout');
		await this.sendRecoveryRequest();
	}

	private waitAndRestart() {
		this.restartTimeout = setTimeout(async () => {
			await this.sendRecoveryRequest();
		}, RESTART_DELAY);
	}

	private async sendRecoveryRequest() {
		this.requestId = uuid();
		const from = this.progress.timestamp || 0;
		const to = 0;
		const recoveryRequest = new RecoveryRequest({ requestId: this.requestId, from, to });

		logger.info('Sending RecoveryRequest', { requestId: recoveryRequest.requestId, from: recoveryRequest.from, to: recoveryRequest.to });
		await this.client.publish(this.systemStream, recoveryRequest.serialize());

		for (const broker of BROKERS) {
			const progress = {
				...this.progresses.get(broker) || { isComplete: false, lastSeqNum: -1 },
				isComplete: false,
				isFulfilled: false,
				lastSeqNum: -1,
			};

			this.progresses.set(broker, progress);
		}

		this.activityTimeout.start();
		this.isRestarting = false;
	}

	private async onRecoveryMessage(
		content: unknown,
		metadata: MessageMetadata
	): Promise<void> {
		const systemMessage = SystemMessage.deserialize(content);
		if (!MESSAGE_TYPES.includes(systemMessage.messageType)) {
			return;
		}

		const recoveryMessage = systemMessage as RecoveryResponse | RecoveryComplete;
		if (recoveryMessage.requestId != this.requestId) {
			return;
		}

		let progress = this.progresses.get(metadata.publisherId);
		if (!progress) {
			progress = { isComplete: false, isFulfilled: false, lastSeqNum: -1 };
			this.progresses.set(metadata.publisherId, progress);
		}

		try {
			switch (systemMessage.messageType) {
				case SystemMessageType.RecoveryResponse: {
					const recoveryResponse = systemMessage as RecoveryResponse;
					await this.processRecoveryResponse(recoveryResponse, metadata, progress);
					break;
				}
				case SystemMessageType.RecoveryComplete: {
					const recoveryComplete = systemMessage as RecoveryComplete;
					await this.processRecoveryComplete(recoveryComplete, metadata, progress);
					break;
				}
			}

			this.activityTimeout.update();
		} catch (error: any) {
			if (!this.isRestarting) {
				this.isRestarting = true;
				logger.warn('Failed to process RecoveryMessage', { message: error.message });

				this.activityTimeout.stop();
				this.waitAndRestart()
			}
		}
	}

	private async processRecoveryResponse(recoveryResponse: RecoveryResponse, metadata: MessageMetadata, progress: RecoveryProgress) {
		logger.info('Processing RecoveryResponse',
			{
				publisherId: metadata.publisherId,
				seqNum: recoveryResponse.seqNum,
				payloadLength: recoveryResponse.payload.length,
			}
		);

		if (recoveryResponse.seqNum - progress.lastSeqNum !== 1) {
			throw new Error(`RecoveryResponse has unexpected seqNum ${JSON.stringify({ seqNum: recoveryResponse.seqNum })}`);
		}

		for await (const [msg, msgMetadata] of recoveryResponse.payload) {
			if (msg.messageType === SystemMessageType.Measurement) {
				const measurement = msg as Measurement;
				await this.onMeasurement?.(measurement, msgMetadata as MessageMetadata);
				progress.timestamp = msgMetadata.timestamp;
			}
		}

		progress.lastSeqNum = recoveryResponse.seqNum;
	}

	private async processRecoveryComplete(recoveryComplete: RecoveryComplete, metadata: MessageMetadata, progress: RecoveryProgress) {
		logger.info(
			'Processing RecoveryComplete',
			{
				publisherId: metadata.publisherId,
				seqNum: recoveryComplete.seqNum,
			}
		);

		if (recoveryComplete.seqNum - progress.lastSeqNum !== 1) {
			throw new Error(`RecoveryComplete has unexpected seqNum ${JSON.stringify({ seqNum: recoveryComplete.seqNum })}`);
		}

		// if no recovery messages received
		if (progress.timestamp === undefined) {
			progress.timestamp = metadata.timestamp;
		}

		progress.isComplete = true;
		progress.isFulfilled = recoveryComplete.isFulfilled;

		if (this.progress.isComplete) {
			if (this.progress.isFulfilled) {
				logger.info('Successfully complete Recovery');
				setImmediate(this.stop.bind(this));
			} else {
				logger.info('Successfully complete Recovery Round. Sending next Request.');
				this.activityTimeout.stop();
				setImmediate(this.sendRecoveryRequest.bind(this));
			}
		}
	}
}
