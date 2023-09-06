import { Serializer } from '../abstracts/Serializer';
import { Confirmation } from './Confirmation';
import { SystemMessage, SystemMessageType } from './SystemMessage';

const VERSION = 1;

export default class ConfirmationSerializerV1 extends Serializer<Confirmation> {
	toArray(message: Confirmation): any[] {
		return [
			VERSION,
			SystemMessageType.Confirmation,
			message.seqNum,
			message.sensorId,
			message.signature,
		];
	}

	fromArray(arr: any[]): Confirmation {
		const [version, _messageType, sensorId, seqNum, signature] = arr;

		return new Confirmation({
			version,
			seqNum,
			sensorId,
			signature,
		});
	}
}

SystemMessage.registerSerializer(
	VERSION,
	SystemMessageType.Confirmation,
	new ConfirmationSerializerV1()
);
