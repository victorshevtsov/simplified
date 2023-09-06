import {
	SystemMessage,
	SystemMessageOptions,
	SystemMessageType,
} from './SystemMessage';

interface MeasurementOptions extends SystemMessageOptions {
	sensorId: string;
	pressure: number;
	temperature: number;
}

export class Measurement extends SystemMessage {
	sensorId: string;
	pressure: number;
	temperature: number;

	constructor({
		version = SystemMessage.LATEST_VERSION,
		seqNum,
		sensorId,
		pressure,
		temperature,
	}: MeasurementOptions) {
		super(version, SystemMessageType.Measurement, seqNum);

		this.sensorId = sensorId;
		this.pressure = pressure;
		this.temperature = temperature;
	}
}
