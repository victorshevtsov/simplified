import { program } from 'commander';
import 'dotenv/config';
import { startCommand } from './cli/startCommand';

program
  .addCommand(startCommand)
  .parse(process.argv);
