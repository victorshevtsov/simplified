import {
	SystemMessage,
	SystemMessageOptions,
	SystemMessageType,
} from './SystemMessage';

interface ConfirmationOptions extends SystemMessageOptions {
	sensorId: string;
	signature: string;
}

export class Confirmation extends SystemMessage {
	sensorId: string;
	signature: string;

	constructor({
		version = SystemMessage.LATEST_VERSION,
		seqNum,
		sensorId,
		signature,
	}: ConfirmationOptions) {
		super(version, SystemMessageType.Confirmation, seqNum);

		this.sensorId = sensorId;
		this.seqNum = seqNum;
		this.signature = signature;
	}
}
