import { EthereumAddress, Logger } from '@streamr/utils';

const logger = new Logger(module);

export class Metrics {
  private readonly seqNums: Map<EthereumAddress, number>;
  private count: number = 0;
  private lost: number = 0;

  constructor(
    private readonly subject: string
  ) {
    this.seqNums = new Map<EthereumAddress, number>();
  }

  public update(publisherId: EthereumAddress, seqNum: number) {
    this.count++;
    const prevSeqNum = this.seqNums.get(publisherId);
    if (prevSeqNum) {
      const diff = seqNum - prevSeqNum;
      if (diff > 1) {
        this.lost += diff;

        logger.error(
          `Unexpected ${this.subject} seqNum ${JSON.stringify({
            publisherId,
            prev: prevSeqNum,
            curr: seqNum,
            lost: diff,
          })}`
        );
      }
    }

    this.seqNums.set(publisherId, seqNum);
  }

  public get summary() {
    return {
      count: this.count,
      lost: this.lost,
    }
  }
}
