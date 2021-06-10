require('dotenv').config();
const fs = require('fs/promises');
const { R_OK, W_OK } = require('fs').constants;
const { App } = require('@slack/bolt');
const { Ledger } = require('./ledger');
const { claim, nominate, deny, confirm, give, destroy, balance, pending, CommandError } = require('./commands');
const { timestamp } = require('./util');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

function getLedgerPath() {
  const ledgerPath = process.env.BBUCKS_LEDGER_PATH;

  if (ledgerPath === undefined) {
    throw new Error('Must define ledger path in BBUCKS_LEDGER_PATH env variable');
  }

  return ledgerPath;
}

async function loadLedger() {
  const ledgerPath = getLedgerPath();

  // Create the ledger file if it does not already exist
  try {
    // eslint-disable-next-line no-bitwise
    await fs.access(ledgerPath, R_OK | W_OK);
  } catch (e) {
    // eslint-disable-next-line no-use-before-define
    console.log('Initializing ledger at', ledgerPath);
    await fs.appendFile(ledgerPath, `${timestamp()} new_user universe\n`, 'utf8');
  }

  const commandLines = (await fs.readFile(ledgerPath, 'utf8'))
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => !(line.startsWith('#') || line.length === 0));

  return commandLines.reduce((ledger, commandText) => ledger.dispatch(commandText), new Ledger());
}

async function appendToLedger(line) {
  const ledgerPath = getLedgerPath();
  const entry = `${timestamp()} ${line}`;

  // Attempt to append entry to ledger to see if it is valid
  try {
    const ledger = await loadLedger();
    ledger.dispatch(entry);
  } catch (e) {
    console.log(`Blocked invalid ledger entry:\n\t${line}\n\tBecause: ${e.message}`);
    throw e;
  }

  console.log(entry);

  await fs.appendFile(ledgerPath, `${entry}\n`, 'utf8');
}

async function handleCommand(client, command, ack, say) {
  await ack();

  const ledger = loadLedger();

  try {
    let response = {};

    switch (command.command) {
      case '/claim':
        response = await claim(ledger, command.user_name, command.text);
        break;
      case '/nominate':
        response = await nominate(ledger, command.user_name, command.text);
        break;
      case '/deny':
        response = await deny(ledger, command.user_name, command.text);
        break;
      case '/confirm':
        response = await confirm(ledger, command.user_name, command.text);
        break;
      case '/give':
        response = await give(ledger, command.user_name, command.text);
        break;
      case '/destroy':
        response = await destroy(ledger, command.user_name, command.text);
        break;
      case '/balance':
        response = await balance(ledger, command.user_name, command.text);
        break;
      case '/pending':
        response = await pending(ledger, command.user_name, command.text);
        break;
      default:
        // This should never happen because we explicitly define which commands
        // we will handle down below
        throw new Error('Unrecognized command');
    }

    if (response === undefined) {
      return;
    }

    if (response.commands !== undefined) {
      try {
        response.commands.forEach((cmd) => appendToLedger(cmd));
      } catch (e) {
        throw new Error('Bad transaction');
      }
    }

    if (response.ephemeral !== undefined) {
      await client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        text: response.ephemeral,
      });
    }

    if (response.say !== undefined) {
      // Always post public messages in the bot channel, unless it's undefined
      await client.chat.postMessage({
        channel: process.env.BBUCKS_BOT_CHANNEL || command.channel_id,
        text: response.say,
      });
    }
  } catch (e) {
    if (e instanceof CommandError) {
      await client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        text: `Error: ${e.message}`,
      });
    } else {
      throw e;
    }
  }
}

[
  '/claim',
  '/deny',
  '/confirm',
  '/give',
  '/destroy',
  '/balance',
  '/pending',
  '/nominate',
].forEach((cmd) => app.command(
  cmd,
  async ({ client, command, ack, say }) => handleCommand(client, command, ack, say),
));

(async () => {
  await app.start();
})();
