import { Measurement } from '@simplified/protocol';
import { BroadbandPublisher } from '@simplified/shared';
import { Logger } from '@streamr/utils';

const logger = new Logger(module);

const INTERVAL_FAST = 50;
const INTERVAL_SLOW = 1000;
const THRESHOLD = 2000;

export class Sensor {
	private timer?: NodeJS.Timeout;
	private counter: number = 0;

	constructor(
		private readonly id: string,
		private readonly publisher: BroadbandPublisher
	) {
		//
	}

	public async start(interval: number = INTERVAL_FAST) {
		logger.info('Started', { interval });
		this.timer = setInterval(this.onTimer.bind(this), interval);
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

		if (this.counter === THRESHOLD) {
			logger.info('Threshold reached. Switching to slower interval', { THRESHOLD });
			this.stop();
			this.start(INTERVAL_SLOW);
		}
	}
}
