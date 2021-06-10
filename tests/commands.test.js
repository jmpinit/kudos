const { timestamp } = require('../util');
const { Ledger } = require('../ledger');
const commands = require('../commands');

test('Usernames including symbols are parsed correctly', async () => {
  const ledger = new Ledger();

  ledger.dispatch(`${timestamp()} new_user universe`);
  ledger.dispatch(`${timestamp()} mint abc universe 100`);
  ledger.dispatch(`${timestamp()} new_user foo`);
  ledger.dispatch(`${timestamp()} new_user bar`);

  const response = await commands.nominate(ledger, 'foo', '10 to @bar for doing good');
  response.commands.forEach((cmd) => ledger.dispatch(cmd));

  // await commands.give('foo', '10 to @bob');
  // await commands.balance('foo', '@bar');
  // await commands.pending('foo', '@bar');
});
