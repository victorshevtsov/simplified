import { Logger } from '@streamr/utils';
import { CONFIG_TEST, StreamrClient, StreamrClientConfig } from 'streamr-client';

export interface CreateClientOptions {
  devNetwork?: boolean;
  externalIp?: string;
}

const logger = new Logger(module);

const DEV_NETWORK_CONFIG: StreamrClientConfig = {
  ...CONFIG_TEST,
  // logLevel: 'info',
};

export const createClient = async (privateKey: string, options: CreateClientOptions): Promise<StreamrClient> => {
  logger.info('Creating StreamrClient with options:', { options });

  let config: StreamrClientConfig = options.devNetwork
    ? DEV_NETWORK_CONFIG
    : { network: {} };

  config.logLevel = 'trace';
  config.auth = { privateKey };

  config.network!.webrtcSendBufferMaxMessageCount = 5000;
  config.network!.webrtcDisallowPrivateAddresses = false;
  config.gapFill = true
  config.gapFillTimeout = 30000

  if (options.externalIp) {
    config.network!.externalIp = options.externalIp;
  }

  logger.info('Creating StreamrClient with config:', { config });
  const client = new StreamrClient(config);
  logger.info('StreamrClient created:', { address: await client.getAddress() });

  return client;
};
