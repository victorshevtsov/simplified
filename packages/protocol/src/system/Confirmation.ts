import {
	SystemMessage,
	SystemMessageOptions,
	SystemMessageType,
} from './SystemMessage';

interface ConfirmationOptions extends SystemMessageOptions {
	sensorId: string;
	seqNum: number;
	signature: string;
}

export class Confirmation extends SystemMessage {
	sensorId: string;
	seqNum: number;
	signature: string;

	constructor({
		version = SystemMessage.LATEST_VERSION,
		sensorId,
		seqNum,
		signature,
	}: ConfirmationOptions) {
		super(version, SystemMessageType.Confirmation);

		this.sensorId = sensorId;
		this.seqNum = seqNum;
		this.signature = signature;
	}
}
