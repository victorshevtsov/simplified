import { BroadbandPublisher, CreateClientOptions, createClient } from '@simplified/shared';
import { EthereumAddress, Logger } from '@streamr/utils';
import { Command } from 'commander';
import { v4 as uuid } from 'uuid';
import { Sensor } from '../Sensor';
import { baseAddress, devNetworkOption, externalIpOption, privateKeyOption, rapidIntervalOption, sensorIntervalOption } from './options';

const logger = new Logger(module);

interface Options {
	baseAddress: EthereumAddress;
	devNetwork: boolean;
	externalIp: string;
	privateKey: string;
	rapidInterval: number;
	sensorInterval: number;
}

export const startCommand = new Command('start')
	.description('Start Broker')
	.addOption(baseAddress)
	.addOption(devNetworkOption)
	.addOption(externalIpOption)
	.addOption(privateKeyOption)
	.addOption(sensorIntervalOption)
	.addOption(rapidIntervalOption)
	.action(async (options: Options) => {
		logger.info(`Creating Broker with options ${JSON.stringify({ options })}`);

		const createClientOptions: CreateClientOptions = {
			devNetwork: options.devNetwork,
			externalIp: options.externalIp,
		}

		const measurementStreamId = `${options.baseAddress.toString()}/measurement`;

		const client = await createClient(options.privateKey, createClientOptions);

		const measurementStream = await client.getStream(measurementStreamId);
		const measurementPublisher = new BroadbandPublisher(client, measurementStream);

		const sensor = new Sensor(uuid(), measurementPublisher, options.sensorInterval, options.rapidInterval);

		await sensor.start();

		process.on('SIGINT', async () => {
			await sensor.stop();
			await client.destroy();
		});
	});
