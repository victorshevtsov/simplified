import { Serializer } from '../abstracts/Serializer';
import { Confirmation } from './Confirmation';
import { SystemMessage, SystemMessageType } from './SystemMessage';

const VERSION = 1;

export default class ConfirmationSerializerV1 extends Serializer<Confirmation> {
	toArray(message: Confirmation): any[] {
		return [
			VERSION,
			SystemMessageType.Confirmation,
			message.sensorId,
			message.seqNum,
			message.signature,
		];
	}

	fromArray(arr: any[]): Confirmation {
		const [version, _messageType, sensorId, seqNum, signature] = arr;

		return new Confirmation({
			version,
			sensorId,
			seqNum,
			signature,
		});
	}
}

SystemMessage.registerSerializer(
	VERSION,
	SystemMessageType.Confirmation,
	new ConfirmationSerializerV1()
);
