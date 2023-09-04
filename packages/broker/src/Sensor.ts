import { Measurement } from '@simplified/protocol';
import { BroadbandPublisher } from '@simplified/shared';
import { Logger } from '@streamr/utils';

const logger = new Logger(module);

const INTERVAL_FAST = 50;
const INTERVAL_SLOW = 1000;
const THRESHOLD = 2000;

export class Sensor {
	private interval: number;
	private timer?: NodeJS.Timeout;
	private counter: number = 0;

	constructor(
		private readonly id: string,
		private readonly publisher: BroadbandPublisher,
		private readonly fillCache: boolean
	) {
		this.interval = this.fillCache ? INTERVAL_FAST : INTERVAL_SLOW;
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

		if (this.fillCache && this.counter === THRESHOLD) {
			logger.info(`Threshold reached. Switching to slower interval ${JSON.stringify({ THRESHOLD })}`);
			this.stop();
			this.interval = INTERVAL_SLOW;
			this.start();
		}
	}
}
