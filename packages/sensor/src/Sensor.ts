import { Measurement } from '@simplified/protocol';
import { BroadbandPublisher } from '@simplified/shared';
import { Logger } from '@streamr/utils';

const logger = new Logger(module);

const THRESHOLD = 2000;

export class Sensor {
	private interval: number;
	private timer?: NodeJS.Timeout;
	private counter: number = 0;

	constructor(
		private readonly id: string,
		private readonly publisher: BroadbandPublisher,
		private readonly sensorInterval: number,
		private readonly rapidInterval: number,
	) {
		this.interval = this.rapidInterval || this.sensorInterval;
	}

	public async start() {
		logger.info(`Started ${JSON.stringify({ interval: this.interval })}`);
		this.timer = setInterval(this.onTimer.bind(this), this.interval);
	}

	public async stop() {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = undefined;
		}
		logger.info('Stopped');
	}

	private async onTimer() {
		const measurement = new Measurement({
			sensorId: this.id,
			seqNum: this.counter,
			pressure: 1000 + this.counter % 10,
			temperature: 100 + this.counter % 50,
		});
		this.counter++;
		await this.publisher.publish(measurement.serialize());

		if (this.rapidInterval && this.counter === THRESHOLD) {
			logger.info(`Threshold reached. Switching to normal interval ${JSON.stringify({ THRESHOLD })}`);
			this.stop();
			this.interval = this.sensorInterval;
			this.start();
		}
	}
}
