const { Ledger } = require('../ledger');

function dispatchAt(ledger, date, cmd) {
  return ledger.dispatch(`${date.toISOString()} ${cmd}`);
}

function dispatchNow(ledger, cmd) {
  return dispatchAt(ledger, new Date(), cmd);
}

describe('new_user command', () => {
  test('Can create new users', () => {
    const ledger = [
      'new_user foo',
      'new_user bar',
      'new_user baz',
    ].reduce((ld, cmd) => dispatchNow(ld, cmd), new Ledger());

    const usernames = Object.keys(ledger.getUsers());

    expect(usernames).toContain('foo');
    expect(usernames).toContain('bar');
    expect(usernames).toContain('baz');
  });

  test('Attempting to create a new user with an existing name throws', () => {
    const ledger = new Ledger();
    dispatchNow(ledger, 'new_user foo');
    expect(() => dispatchNow(ledger, 'new_user foo')).toThrow();
  });
});

describe('claim and vote commands', () => {
  test('Claim funds without drama', () => {
    const now = new Date();
    const past = new Date(now.getTime() - 1000);
    const soon = new Date(now.getTime() + 1000);

    const ledger = [
      'new_user universe',
      'mint abc universe 1000',
      'new_user foo',
    ].reduce((ld, cmd) => dispatchNow(ld, cmd), new Ledger());

    expect(ledger.getBalance('universe')).toEqual(1000);

    dispatchNow(ledger, `claim xyz ${soon.toISOString()} foo universe 100`);

    expect(ledger.getBalance('universe', past)).toEqual(0);
    expect(ledger.getBalance('universe', soon)).toEqual(900);
    expect(ledger.getBalance('foo', past)).toEqual(0);
    expect(ledger.getBalance('foo', now)).toEqual(0);
    expect(ledger.getBalance('foo', soon)).toEqual(100);
  });

  test('Claim funds with drama', () => {
    const now = new Date();
    const matureDate = new Date(now.getTime() + 3000);

    const ledger = [
      'new_user universe',
      'mint abc universe 1000',
      'new_user foo',
      'new_user bar',
      'new_user baz',
      `claim xyz ${matureDate.toISOString()} foo universe 100`,
    ].reduce((ld, cmd) => dispatchNow(ld, cmd), new Ledger());

    const claimID = Object.keys(ledger.getLastClaim())[0];

    expect(ledger.getBalance('foo', matureDate)).toEqual(100);

    dispatchNow(ledger, `vote ${claimID} bar -1`);
    expect(ledger.getBalance('foo', matureDate)).toEqual(0);

    dispatchNow(ledger, `vote ${claimID} baz 1`);
    expect(ledger.getBalance('foo', matureDate)).toEqual(100);
  });

  test('The same user voting twice on the same transaction throws', () => {
    const ledger = new Ledger();

    const future = (new Date(Date.now() + 1000)).toISOString();

    dispatchNow(ledger, 'new_user foo');
    dispatchNow(ledger, 'new_user bar');
    dispatchNow(ledger, 'mint abc bar 100');
    dispatchNow(ledger, `claim xyz ${future} foo bar 100`);
    dispatchNow(ledger, 'vote xyz bar -1');
    expect(() => dispatchNow(ledger, 'vote xyz bar -1')).toThrow();
  });

  test('Claiming one\'s own funds throws', () => {
    const ledger = new Ledger();

    dispatchNow(ledger, 'new_user foo');
    dispatchNow(ledger, 'mint abc foo 100');
    expect(() => dispatchNow(ledger, `claim abc ${(new Date()).toISOString()} foo foo 100`)).toThrow();
  });

  test('Claimed money is unavailable until the mature date', () => {
    const ledger = new Ledger();

    const future = new Date(Date.now() + 100);
    const afterFuture = new Date(Date.now() + 200);

    dispatchNow(ledger, 'new_user foo');
    dispatchNow(ledger, 'new_user bar');
    dispatchNow(ledger, 'mint abc foo 100');
    dispatchNow(ledger, `claim xyz ${future.toISOString()} bar foo 100`);

    expect(ledger.getBalance('foo')).toEqual(0);
    expect(ledger.getBalance('bar')).toEqual(0);
    expect(ledger.getBalance('bar', afterFuture)).toEqual(100);
  });

  test('Voting >1 throws', () => {
    const ledger = new Ledger();

    const future = (new Date(Date.now() + 1000)).toISOString();

    dispatchNow(ledger, 'new_user foo'); // Bank
    dispatchNow(ledger, 'new_user bar'); // Canary
    dispatchNow(ledger, 'new_user baz'); // Miscreant
    dispatchNow(ledger, 'new_user alice'); // Claimer
    dispatchNow(ledger, 'mint abc foo 1000');
    dispatchNow(ledger, `claim xyz ${future} alice foo 1000`);

    // Canary makes sure it is valid to vote on this claim
    dispatchNow(ledger, 'vote xyz bar 1');

    expect(() => dispatchNow(ledger, 'vote xyz baz 2')).toThrow();
  });

  test('Voting to confirm your own claim throws', () => {
    const ledger = new Ledger();

    const future = (new Date(Date.now() + 1000)).toISOString();

    dispatchNow(ledger, 'new_user foo'); // Bank
    dispatchNow(ledger, 'mint abc foo 1000');

    dispatchNow(ledger, 'new_user bar'); // Claimer

    dispatchNow(ledger, `claim xyz ${future} bar foo 1000`);

    expect(() => dispatchNow(ledger, 'vote xyz bar 1')).toThrow();
  });

  test('Voting to deny your own claim is ok', () => {
    const ledger = new Ledger();

    const future = (new Date(Date.now() + 1000)).toISOString();

    dispatchNow(ledger, 'new_user foo'); // Bank
    dispatchNow(ledger, 'mint abc foo 1000');

    dispatchNow(ledger, 'new_user bar'); // Claimer

    dispatchNow(ledger, `claim xyz ${future} bar foo 1000`);

    dispatchNow(ledger, 'vote xyz bar -1');
  });

  test('Voting after maturation date throws', () => {
    const ledger = new Ledger();

    const future = (new Date(Date.now() + 1000));
    const afterFuture = new Date(future.getTime() + 1000);

    dispatchNow(ledger, 'new_user foo'); // Bank
    dispatchNow(ledger, 'mint abc foo 1000');

    dispatchNow(ledger, 'new_user bar'); // Claimer
    dispatchNow(ledger, 'new_user baz'); // Voter

    dispatchNow(ledger, `claim xyz ${future.toISOString()} bar foo 1000`);

    expect(() => dispatchAt(ledger, afterFuture, 'vote xyz baz -1')).toThrow();
  });

  test('Claiming more funds than a user has throws', () => {
    const ledger = new Ledger();

    const future = (new Date(Date.now() + 1000));

    dispatchNow(ledger, 'new_user foo'); // Bank
    dispatchNow(ledger, 'mint abc foo 1000');

    dispatchNow(ledger, 'new_user bar'); // Claimer

    expect(() => dispatchNow(ledger, `claim xyz ${future.toISOString()} bar foo 1001`)).toThrow();
  });

  test('Claiming funds from a user whose funds are already claimed throws', () => {
    const ledger = new Ledger();

    const future1 = (new Date(Date.now() + 100));
    const future2 = (new Date(Date.now() + 200));
    const future3 = (new Date(Date.now() + 300));

    dispatchNow(ledger, 'new_user bank');
    dispatchNow(ledger, 'mint abc bank 1000');

    dispatchNow(ledger, 'new_user claimer1');
    dispatchNow(ledger, 'new_user claimer2');
    dispatchNow(ledger, 'new_user claimer3');

    dispatchNow(ledger, `claim claim1 ${future1.toISOString()} claimer1 bank 400`);
    dispatchNow(ledger, `claim claim2 ${future2.toISOString()} claimer2 bank 400`);
    expect(() => dispatchNow(ledger, `claim xyz ${future3.toISOString()} claimer3 bank 400`)).toThrow();
  });

  test('Claimed funds become available again in the source account after the maturation date if the claim has <0 votes', () => {
    const ledger = new Ledger();

    const maturationTime = (new Date(Date.now() + 1000));
    const afterMaturation = (new Date(maturationTime.getTime() + 1000));

    dispatchNow(ledger, 'new_user bank');
    dispatchNow(ledger, 'mint abc bank 1000');

    dispatchNow(ledger, 'new_user claimer');
    dispatchNow(ledger, `claim xyz ${maturationTime.toISOString()} claimer bank 1000`);

    dispatchNow(ledger, 'new_user voter');

    dispatchNow(ledger, `vote xyz voter -1`);

    expect(ledger.getBalance('bank', afterMaturation)).toEqual(1000);
    expect(ledger.getBalance('claimer', afterMaturation)).toEqual(0);
  });
});

test('Out of order timestamps throw error', () => {
  const ledger = new Ledger();

  ledger.dispatch('2021-06-04T15:23:00.000Z new_user bar');
  expect(() => ledger.dispatch('2021-06-04T15:22:00.000Z new_user foo')).toThrow();
});

test('Using non-integer quantities throws', () => {
  const ledger = new Ledger();

  dispatchNow(ledger, 'new_user foo');
  dispatchNow(ledger, 'new_user universe');
  expect(() => dispatchNow(ledger, 'mint abc universe 1000.1')).toThrow();
  dispatchNow(ledger, 'mint abc universe 1000');
  expect(() => dispatchNow(ledger, 'claim xyz foo universe 42.42')).toThrow();
});

test('Using negative values throws', () => {
  const ledger = new Ledger();

  dispatchNow(ledger, 'new_user foo');
  dispatchNow(ledger, 'new_user universe');
  expect(() => dispatchNow(ledger, 'mint abc universe -1000')).toThrow();
  dispatchNow(ledger, 'mint abc universe 1000');
  expect(() => dispatchNow(ledger, 'claim xyz foo universe -42')).toThrow();
});

test('Using the number of parameters throws', () => {
  const ledger = new Ledger();

  expect(() => dispatchNow(ledger, 'new_user bob 50')).toThrow();
  expect(() => dispatchNow(ledger, 'new_user')).toThrow();

  dispatchNow(ledger, 'new_user bob');

  expect(() => dispatchNow(ledger, 'mint abc bob 1000 50')).toThrow();
  expect(() => dispatchNow(ledger, 'mint abc bob')).toThrow();

  dispatchNow(ledger, 'mint abc bob 1000');
  dispatchNow(ledger, 'new_user jill');

  expect(() => dispatchNow(ledger, `claim xyz ${(new Date()).toISOString()} jill bob 100 50`)).toThrow();
  expect(() => dispatchNow(ledger, 'claim xyz')).toThrow();

  dispatchNow(ledger, `claim xyz ${(new Date()).toISOString()} jill bob 100`);

  expect(() => dispatchNow(ledger, 'vote xyz bob -1 50')).toThrow();
  expect(() => dispatchNow(ledger, 'vote xyz bob')).toThrow();
});

test('Balance of a user who does not exist is zero', () => {
  const ledger = new Ledger();
  expect(ledger.getBalance('foo')).toEqual(0);
});
