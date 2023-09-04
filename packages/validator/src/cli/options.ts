import { toEthereumAddress } from '@streamr/utils';
import { Option } from 'commander';

export const baseAddress = new Option(
	'--base-address <address>',
	'Ethereum Address of the Streams'
)
	.env('BASE_ADDRESS')
	.makeOptionMandatory()
	.argParser((value) => toEthereumAddress(value));

export const devNetworkOption = new Option(
	'--dev-network',
	'Connect to DevNetwork'
)
	.env('DEV_NETWORK')
	.default(false);

export const externalIpOption = new Option(
	'--external-ip <ip>',
	'External IP address'
)
	.env('EXTERNAL_IP')

export const privateKeyOption = new Option(
	'--private-key <private_key>',
	'Private Key'
)
	.env('PRIVATE_KEY')
	.makeOptionMandatory();

export const recoveryOption = new Option(
	'--recovery',
	'Start Recovery'
)
	.env('RECOVERY')
	.default(false);
