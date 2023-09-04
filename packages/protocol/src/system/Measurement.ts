import {
	SystemMessage,
	SystemMessageOptions,
	SystemMessageType,
} from './SystemMessage';

interface MeasurementOptions extends SystemMessageOptions {
	sensorId: string;
	seqNum: number;
	pressure: number;
	temperature: number;
}

export class Measurement extends SystemMessage {
	sensorId: string;
	seqNum: number;
	pressure: number;
	temperature: number;

	constructor({
		version = SystemMessage.LATEST_VERSION,
		sensorId,
		seqNum,
		pressure,
		temperature,
	}: MeasurementOptions) {
		super(version, SystemMessageType.Measurement);

		this.sensorId = sensorId;
		this.seqNum = seqNum;
		this.pressure = pressure;
		this.temperature = temperature;
	}
}
