import { Serializer } from '../abstracts/Serializer';
import { Measurement } from './Measurement';
import { SystemMessage, SystemMessageType } from './SystemMessage';

const VERSION = 1;

export default class MeasurementSerializerV1 extends Serializer<Measurement> {
	toArray(message: Measurement): any[] {
		return [
			VERSION,
			SystemMessageType.Measurement,
			message.sensorId,
			message.seqNum,
			message.pressure,
			message.temperature
		];
	}

	fromArray(arr: any[]): Measurement {
		const [version, _messageType, sensorId, seqNum, pressure, temperature] = arr;

		return new Measurement({
			version,
			sensorId,
			seqNum,
			pressure,
			temperature
		});
	}
}

SystemMessage.registerSerializer(
	VERSION,
	SystemMessageType.Measurement,
	new MeasurementSerializerV1()
);
