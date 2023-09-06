import { Serializer } from '../abstracts/Serializer';
import { RecoveryRequest } from './RecoveryRequest';
import { SystemMessage, SystemMessageType } from './SystemMessage';

const VERSION = 1;

export default class RecoveryRequestSerializerV1 extends Serializer<RecoveryRequest> {
	toArray(message: RecoveryRequest): any[] {
		return [
			VERSION,
			SystemMessageType.RecoveryRequest,
			message.seqNum,
			message.requestId,
			message.from,
			message.to
		];
	}

	fromArray(arr: any[]): RecoveryRequest {
		const [version, _messageType, seqNum, requestId, from, to] = arr;

		return new RecoveryRequest({
			version,
			seqNum,
			requestId,
			from,
			to,
		});
	}
}

SystemMessage.registerSerializer(
	VERSION,
	SystemMessageType.RecoveryRequest,
	new RecoveryRequestSerializerV1()
);
