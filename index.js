require('dotenv').config();
const { App } = require('@slack/bolt');
const { claim, deny, confirm, give, destroy, balance, pending, CommandError } = require('./commands');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

async function handleCommand(client, command, ack, say) {
  await ack();

  try {
    let response = {};

    switch (command.command) {
      case '/claim':
        response = await claim(command.user_name, command.text);
        break;
      case '/deny':
        response = await deny(command.user_name, command.text);
        break;
      case '/confirm':
        response = await confirm(command.user_name, command.text);
        break;
      case '/give':
        response = await give(command.user_name, command.text);
        break;
      case '/destroy':
        response = await destroy(command.user_name, command.text);
        break;
      case '/balance':
        response = await balance(command.user_name, command.text);
        break;
      case '/pending':
        response = await pending(command.user_name, command.text);
        break;
      default:
        // This should never happen because we explicitly define which commands
        // we will handle down below
        throw new Error('Unrecognized command');
    }

    if (response === undefined) {
      return;
    }

    if (response.ephemeral !== undefined) {
      await client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        text: response.ephemeral,
      });
    }

    if (response.say !== undefined) {
      await say(response.say);
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
].forEach((cmd) => app.command(
  cmd,
  async ({ client, command, ack, say }) => handleCommand(client, command, ack, say),
));

(async () => {
  await app.start();
})();
