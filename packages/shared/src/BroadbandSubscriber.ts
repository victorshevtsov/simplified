import {
	StreamrClient,
	MessageListener,
	Stream,
	Subscription,
} from 'streamr-client';

export class BroadbandSubscriber {
	private readonly subscriptions: Subscription[] = [];

	constructor(
		private readonly client: StreamrClient,
		private readonly stream: Stream
	) {
		//
	}

	public async subscribe(onMessage: MessageListener) {
		const { partitions } = this.stream.getMetadata();

		const promises = [];
		for (let partition = 0; partition < partitions; partition++) {
			promises.push(
				this.client.subscribe({ id: this.stream.id, partition }, onMessage)
			);
		}

		this.subscriptions.push(...(await Promise.all(promises)));
	}

	public async unsubscribe() {
		await Promise.all(
			this.subscriptions.map((subscription) => subscription.unsubscribe())
		);
		this.subscriptions.splice(0);
	}
}
