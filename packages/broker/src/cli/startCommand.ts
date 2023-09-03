import { BroadbandPublisher, BroadbandSubscriber, CreateClientOptions, createClient } from '@simplified/shared';
import { EthereumAddress, Logger } from '@streamr/utils';
import { Command } from 'commander';
import { v4 as uuid } from 'uuid';
import { Broker } from '../Broker';
import { Cache } from '../Cache';
import { Recovery } from '../Recovery';
import { Sensor } from '../Sensor';
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
		logger.info('Creating Broker...');

		const createClientOptions: CreateClientOptions = {
			devNetwork: options.devNetwork,
			externalIp: options.externalIp,
		}

		const systemStreamId = `${options.baseAddress.toString()}/system`;
		const sensorStreamId = `${options.baseAddress.toString()}/sensor`;
		const recoveryStreamId = `${options.baseAddress.toString()}/recovery`;

		const client = await createClient(options.privateKey, createClientOptions);

		const systemStream = await client.getStream(systemStreamId);
		const sensorStream = await client.getStream(sensorStreamId);
		const recoveryStream = await client.getStream(recoveryStreamId);
		// const sensorStream = systemStream;
		// const recoveryStream = systemStream;

		const sensorPublisher = new BroadbandPublisher(client, sensorStream);
		const sensorSubscriber = new BroadbandSubscriber(client, sensorStream);

		const sensor = new Sensor(uuid(), sensorPublisher);
		const cache = new Cache(sensorSubscriber);
		const recovery = new Recovery(client, systemStream, recoveryStream, cache);

		const broker = new Broker(sensor, cache, recovery);
		await broker.start();
	});
