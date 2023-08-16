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

  let config: StreamrClientConfig = {
    logLevel: 'trace',
    auth: {
      privateKey,
    },
  };

  if (options.devNetwork) {
    config = {
      ...DEV_NETWORK_CONFIG,
      ...config
    }
  }

  // Streamr v8.1.0 does not have externalIp option
  // if (options.externalIp) {
  //   config.network = {
  //     externalIp: options.externalIp
  //   }
  // }

  const client = new StreamrClient(config);
  logger.info('StreamrClient created:', { address: await client.getAddress() });

  return client;
};
