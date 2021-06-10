const { timestamp } = require('../util');
const { Ledger } = require('../ledger');
const commands = require('../commands');

test('Usernames including symbols are parsed correctly', async () => {
  const ledger = new Ledger();

  ledger.dispatch(`${timestamp()} new_user universe`);
  ledger.dispatch(`${timestamp()} mint abc universe 100`);
  ledger.dispatch(`${timestamp()} new_user foo`);
  ledger.dispatch(`${timestamp()} new_user bar.baz`);

  {
    const response = await commands.nominate(ledger, 'foo', '10 to @bar.baz for doing good');
    response.commands.forEach((cmd) => ledger.dispatch(`${timestamp()} ${cmd}`));
  }

  {
    const response = await commands.give(ledger, 'universe', '10 to @bar.baz for being awesome');
    response.commands.forEach((cmd) => ledger.dispatch(`${timestamp()} ${cmd}`));
  }

  await commands.balance(ledger, 'foo', '@bar.baz');
  await commands.pending(ledger, 'foo', '@bar.baz');
});

test('Claims, nominations, and give commands for negative quantities throw', async () => {
  const ledger = new Ledger();

  ledger.dispatch(`${timestamp()} new_user universe`);
  ledger.dispatch(`${timestamp()} mint abc universe 100`);
  ledger.dispatch(`${timestamp()} new_user foo`);
  ledger.dispatch(`${timestamp()} new_user bar`);

  await expect(() => commands.claim(ledger, 'foo', '-10 for doing good'))
    .rejects.toThrow();

  await expect(() => commands.nominate(ledger, 'foo', '-10 to @bar for doing good'))
    .rejects.toThrow();

  await expect(() => commands.give(ledger, 'universe', '-10 to @foo for doing good'))
    .rejects.toThrow();
});
