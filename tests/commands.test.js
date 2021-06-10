const { timestamp } = require('../util');
const { Ledger } = require('../ledger');
const commands = require('../commands');

test('Usernames including symbols are parsed correctly', async () => {
  const ledger = new Ledger();

  ledger.dispatch(`${timestamp()} new_user universe`);
  ledger.dispatch(`${timestamp()} mint abc universe 100`);
  ledger.dispatch(`${timestamp()} new_user foo`);
  ledger.dispatch(`${timestamp()} new_user bar`);

  {
    const response = await commands.nominate(ledger, 'foo', '10 to @bar for doing good');
    response.commands.forEach((cmd) => ledger.dispatch(`${timestamp()} ${cmd}`));
  }

  {
    console.log(ledger.getUsers());
    const response = await commands.give(ledger, 'universe', '10 to @foo for being awesome');
    response.commands.forEach((cmd) => ledger.dispatch(`${timestamp()} ${cmd}`));
  }

  await commands.balance(ledger, 'foo', '@bar');
  await commands.pending(ledger, 'foo', '@bar');
});
