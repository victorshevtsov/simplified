import { MessageMetadata } from '../interfaces/MessageMetadata';
import {
	SystemMessage,
	SystemMessageOptions,
	SystemMessageType,
} from './SystemMessage';

interface RecoveryResponseOptions extends SystemMessageOptions {
	requestId: string;
	payload: [SystemMessage, MessageMetadata][];
}

export class RecoveryResponse extends SystemMessage {
	requestId: string;
	payload: [SystemMessage, MessageMetadata][];

	constructor({
		version = SystemMessage.LATEST_VERSION,
		seqNum,
		requestId,
		payload,
	}: RecoveryResponseOptions) {
		super(version, SystemMessageType.RecoveryResponse, seqNum);
		this.requestId = requestId;
		this.seqNum = seqNum;
		this.payload = payload;
	}
}
