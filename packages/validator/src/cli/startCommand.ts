import { BroadbandSubscriber, CreateClientOptions, createClient } from '@simplified/shared';
import { EthereumAddress, Logger } from '@streamr/utils';
import { Command } from 'commander';
import { Listener } from '../Listener';
import { Recovery } from '../Recovery';
import { Validator } from '../Validator';
import { baseAddress, devNetworkOption, externalIpOption, privateKeyOption, recoveryOption } from './options';

const logger = new Logger(module);

interface Options {
	baseAddress: EthereumAddress;
	devNetwork: boolean;
	externalIp: string;
	privateKey: string;
	recovery: boolean;
	streamId: string;
}

export const startCommand = new Command('start')
	.description('Start Broker')
	.addOption(baseAddress)
	.addOption(devNetworkOption)
	.addOption(externalIpOption)
	.addOption(privateKeyOption)
	.addOption(recoveryOption)
	.action(async (options: Options) => {
		logger.info(`Creating Validator with options ${JSON.stringify({ options })}`);

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
		const measurementStream = await client.getStream(measurementStreamId);
		const confirmationStream = await client.getStream(confirmationStreamId);
		const recoveryStream = await client.getStream(recoveryStreamId);
		// const sensorStream = systemStream;
		// const recoveryStream = systemStream;

		const measurementSubscriber = new BroadbandSubscriber(client, measurementStream);
		const confirmationSubscriber = new BroadbandSubscriber(client, confirmationStream);

		const recovery = options.recovery
			? new Recovery(client, systemStream, recoveryStream)
			: undefined;

		const listener = new Listener(measurementSubscriber, confirmationSubscriber, recovery);

		const validator = new Validator(listener);
		await validator.start();

		process.on('SIGINT', async () => {
			await validator.stop();
			await client.destroy();
		});
	});
