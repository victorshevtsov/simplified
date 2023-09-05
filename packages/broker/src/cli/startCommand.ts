import { BroadbandPublisher, BroadbandSubscriber, CreateClientOptions, createClient } from '@simplified/shared';
import { EthereumAddress, Logger } from '@streamr/utils';
import { Command } from 'commander';
import { Broker } from '../Broker';
import { Cache } from '../Cache';
import { Recovery } from '../Recovery';
import { baseAddress, devNetworkOption, externalIpOption, privateKeyOption } from './options';

const logger = new Logger(module);

interface Options {
	baseAddress: EthereumAddress;
	devNetwork: boolean;
	externalIp: string;
	privateKey: string;
}

export const startCommand = new Command('start')
	.description('Start Broker')
	.addOption(baseAddress)
	.addOption(devNetworkOption)
	.addOption(externalIpOption)
	.addOption(privateKeyOption)
	.action(async (options: Options) => {
		logger.info(`Creating Broker with options ${JSON.stringify({ options })}`);

		const createClientOptions: CreateClientOptions = {
			devNetwork: options.devNetwork,
			externalIp: options.externalIp,
		}

		const systemStreamId = `${options.baseAddress.toString()}/system`;
		const measurementStreamId = `${options.baseAddress.toString()}/measurement`;
		const confirmationStreamId = `${options.baseAddress.toString()}/confirmation`;
		const recoveryStreamId = `${options.baseAddress.toString()}/recovery`;

		const client = await createClient(options.privateKey, createClientOptions);

		const systemStream = await client.getStream(systemStreamId);
		const confirmationStream = await client.getStream(confirmationStreamId);
		const measurementStream = await client.getStream(measurementStreamId);
		const recoveryStream = await client.getStream(recoveryStreamId);
		// const sensorStream = systemStream;
		// const recoveryStream = systemStream;

		const confirmationPublisher = new BroadbandPublisher(client, confirmationStream);
		const measurementSubscriber = new BroadbandSubscriber(client, measurementStream);

		const cache = new Cache(measurementSubscriber, confirmationPublisher);
		const recovery = new Recovery(client, systemStream, recoveryStream, cache);

		const broker = new Broker(cache, recovery);
		await broker.start();

		process.on('SIGINT', async () => {
			await broker.stop();
			await client.destroy();
		});
	});
