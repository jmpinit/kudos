const crypto = require('crypto');

// How many days before claims mature
const DAYS_TO_MATURE = 1;

class CommandError extends Error {}

function generateClaimUUID() {
  return crypto.randomBytes(16).toString('hex');
}

async function claim(ledger, userName, text) {
  const parts = text.split(/\s+/);

  if (parts.length === 1 && parts[0] === 'help') {
    return { ephemeral: 'Here is an example: /claim 15 for cleaning the dishes' };
  }

  const claimRe = /(?<amount>[0-9]+)\s+(for\s+)?(?<reason>.+)/;
  const matches = claimRe.exec(text);

  if (matches === null) {
    throw new CommandError('Incorrect syntax');
  }

  if (!('amount' in matches.groups)) {
    throw new CommandError('Missing amount to be claimed');
  }

  if (!('reason' in matches.groups)) {
    throw new CommandError('Missing reason for claim');
  }

  const amount = parseInt(matches.groups.amount, 10);

  if (Number.isNaN(amount)) {
    throw new CommandError('Amount of bbucks being claimed must be an integer');
  }

  if (amount !== parseFloat(matches.groups.amount)) {
    throw new CommandError('Amount of bbucks being claimed must be an integer');
  }

  const { reason } = matches.groups;

  // https://stackoverflow.com/a/3818198
  const matureDate = new Date();
  matureDate.setDate(matureDate.getDate() + DAYS_TO_MATURE);

  const addedClaimID = generateClaimUUID();

  // TODO: explain how to vote for or against the claim
  return {
    say: `Transaction [${addedClaimID}]: ${userName} is claiming ${amount} bbucks for "${reason}"`,
    commands: [`claim ${addedClaimID} ${matureDate.toISOString()} ${userName} universe ${amount}`],
  };
}

async function nominate(ledger, userName, text) {
  const parts = text.split(/\s+/);

  if (parts.length === 1 && parts[0] === 'help') {
    return { ephemeral: 'Here is an example: /nominate @bob 15 for cleaning the dishes' };
  }

  const nominateRe = /(?<amount>[0-9]+)\s+(to\s+)?@(?<userName>\S+)\s+(for\s+)?(?<reason>.+)/;
  const matches = nominateRe.exec(text);

  if (matches === null) {
    throw new CommandError('Incorrect syntax');
  }

  if (!('amount' in matches.groups)) {
    throw new CommandError('Missing amount to be claimed');
  }

  if (!('userName' in matches.groups)) {
    throw new CommandError('Missing user to nominate');
  }

  if (!('reason' in matches.groups)) {
    throw new CommandError('Missing reason for claim');
  }

  const amount = parseInt(matches.groups.amount, 10);

  if (Number.isNaN(amount)) {
    throw new CommandError('Amount of bbucks must be an integer');
  }

  if (amount !== parseFloat(matches.groups.amount)) {
    throw new CommandError('Amount of bbucks must be an integer');
  }

  const { reason, userName: nominee } = matches.groups;

  if (!(nominee in ledger.getUsers())) {
    throw new CommandError('Nominee does not have an identity in the ledger');
  }

  // https://stackoverflow.com/a/3818198
  const matureDate = new Date();
  matureDate.setDate(matureDate.getDate() + DAYS_TO_MATURE);

  const addedClaimID = generateClaimUUID();

  // TODO: explain how to vote for or against the claim
  return {
    say: `Transaction [${addedClaimID}]: ${userName} nominates ${nominee} to receive ${amount} bbucks for "${reason}"`,
    commands: [`claim ${addedClaimID} ${matureDate.toISOString()} ${nominee} universe ${amount}`],
  };
}

async function deny(ledger, userName, text) {
  const parts = text.split(/\s+/);

  if (parts.length === 1 && parts[0] === 'help') {
    return { ephemeral: 'Here is an example: /deny a10a7e7f0e49e6cfdd2f5678ee3aa363 because they didn\'t do it' };
  }

  const denyRe = /(?<transactionID>\w+)\s+(because)?(?<reason>.+)/;
  const matches = denyRe.exec(text);

  if (matches === null) {
    throw new CommandError('Incorrect syntax');
  }

  if (!('transactionID' in matches.groups)) {
    throw new CommandError('Must specify the transaction ID of the transaction you want to vote to deny');
  }

  if (!('reason' in matches.groups)) {
    throw new CommandError('Missing explanation of why you want to vote to deny the transaction');
  }

  const { transactionID } = matches.groups;

  const transaction = ledger.getClaim(transactionID);

  if (transaction === undefined) {
    throw new CommandError('Transaction with given ID does not exist');
  }

  const fromUserName = ledger.getUserNamesByID(transaction.fromID)[0];
  const toUserName = ledger.getUserNamesByID(transaction.toID)[0];

  return {
    say: `${userName} votes to deny claim [${transactionID}] of ${transaction.amount} from ${fromUserName} for ${toUserName}
    There are now ${transaction.votes - 1} votes for the claim.`,
    commands: [`vote ${transactionID} ${userName} -1`],
  };
}

async function confirm(ledger, userName, text) {
  const parts = text.split(/\s+/);

  if (parts.length === 1 && parts[0] === 'help') {
    return { ephemeral: 'Here is an example: /confirm a10a7e7f0e49e6cfdd2f5678ee3aa363 because they did do it' };
  }

  const confirmRe = /(?<transactionID>\w+)\s+(because)?(?<reason>.+)/;
  const matches = confirmRe.exec(text);

  if (matches === null) {
    throw new CommandError('Incorrect syntax');
  }

  if (!('transactionID' in matches.groups)) {
    throw new CommandError('Must specify the transaction ID of the transaction you want to vote to confirm');
  }

  if (!('reason' in matches.groups)) {
    throw new CommandError('Missing explanation of why you want to vote to confirm the transaction');
  }

  const { transactionID } = matches.groups;

  const transaction = ledger.getClaim(transactionID);

  if (transaction === undefined) {
    throw new CommandError('Transaction with given ID does not exist');
  }

  const fromUserName = ledger.getUserNamesByID(transaction.fromID)[0];
  const toUserName = ledger.getUserNamesByID(transaction.toID)[0];

  return {
    say: `${userName} votes to confirm claim [${transactionID}] of ${transaction.amount} from ${fromUserName} for ${toUserName}
    There are now ${transaction.votes + 1} votes for the claim.`,
    commands: [`vote ${transactionID} ${userName} 1`],
  };
}

async function give(ledger, userName, text) {
  const parts = text.split(/\s+/);

  if (parts.length === 1 && parts[0] === 'help') {
    return { ephemeral: 'Here is an example: /give 10 to @bob' };
  }

  const giveRe = /(?<amount>[0-9]+)\s+(to\s+)?@(?<userName>.+)/;
  const matches = giveRe.exec(text);

  if (matches === null) {
    throw new CommandError('Incorrect syntax');
  }

  if (!('amount' in matches.groups)) {
    throw new CommandError('Must specify the amount that you want to give');
  }

  if (!('userName' in matches.groups)) {
    throw new CommandError('Must specify the username of the user you want to give to');
  }

  const amount = parseInt(matches.groups.amount, 10);

  if (Number.isNaN(amount)) {
    throw new CommandError('Amount being given must be an integer');
  }

  if (amount !== parseFloat(matches.groups.amount)) {
    throw new CommandError('Amount being given must be an integer');
  }

  const toUserName = matches.groups.userName;

  // Check if destination user exists

  if (!(toUserName in ledger.getUsers())) {
    throw new CommandError('User to give the funds to does not exist');
  }

  const now = (new Date()).toISOString();

  return {
    say: `${userName} gave ${amount} to ${toUserName}`,
    commands: [`claim ${now} ${toUserName} ${userName} ${amount}`],
  };
}

async function destroy(ledger, userName, text) {
  const parts = text.split(/\s+/);

  if (parts.length === 1 && parts[0] === 'help') {
    return { ephemeral: 'Here is an example: /destroy 10' };
  }

  const destroyRe = /(?<amount>[0-9]+)/;
  const matches = destroyRe.exec(text);

  if (matches === null) {
    throw new CommandError('Incorrect syntax');
  }

  if (!('amount' in matches.groups)) {
    throw new CommandError('Must specify the amount that you want to destroy');
  }

  const amount = parseInt(matches.groups.amount, 10);

  if (Number.isNaN(amount)) {
    throw new CommandError('Amount being destroyed must be an integer');
  }

  if (amount !== parseFloat(matches.groups.amount)) {
    throw new CommandError('Amount being destroyed must be an integer');
  }

  if (amount <= 0) {
    throw new CommandError('Amount being destroyed must be greater than zero');
  }

  const userBalance = ledger.getBalance(userName);

  if (amount > userBalance) {
    throw new CommandError('Cannot destroy more than your total balance');
  }

  const now = (new Date()).toISOString();

  return {
    say: `${userName} destroyed ${amount}`,
    commands: [`claim ${now} universe ${userName} ${amount}`],
  };
}

async function balance(ledger, userName, text) {
  const parts = text.split(/\s+/);

  if (parts.length === 1 && parts[0] === 'help') {
    return { ephemeral: 'Here is an example: /balance @bob' };
  }

  const balanceRe = /@(?<userName>\S+)/;
  const matches = balanceRe.exec(text);

  if (matches === null) {
    throw new CommandError('Incorrect syntax');
  }

  if (!('userName' in matches.groups)) {
    throw new CommandError('Must specify username whose balance should be shown');
  }

  const targetUserName = matches.groups.userName;

  if (!(targetUserName in ledger.getUsers())) {
    throw new CommandError('User does not exist');
  }

  const amount = ledger.getBalance(targetUserName);

  return {
    ephemeral: `${targetUserName} has ${amount} bbucks`,
  };
}

async function pending(ledger, userName, text) {
  const parts = text.split(/\s+/);

  if (parts.length === 1 && parts[0] === 'help') {
    return { ephemeral: 'Here is an example: /pending @bob' };
  }

  const pendingRe = /@(?<userName>\S+)/;
  const matches = pendingRe.exec(text);

  if (matches === null) {
    throw new CommandError('Incorrect syntax');
  }

  if (!('userName' in matches.groups)) {
    throw new CommandError('Must specify username whose pending claims should be shown');
  }

  const targetUserName = matches.groups.userName;

  if (!(targetUserName in ledger.getUsers())) {
    throw new CommandError('User does not exist');
  }

  const targetUserID = ledger.getUserID(targetUserName);
  const claims = ledger.getPending(targetUserName);

  return {
    ephemeral: claims.reduce(
      (list, cl) => (
        cl.fromID === targetUserID
          ? `${list}\t${cl.amount} to ${ledger.getUserNamesByID(cl.toID)[0]} at ${cl.matureDatetime.toISOString()}\n`
          : `${list}\t${cl.amount} from ${ledger.getUserNamesByID(cl.fromID)[0]} at ${cl.matureDatetime.toISOString()}\n`
      ),
      `${targetUserName} has ${claims.length} claims:\n`,
    ),
  };
}

module.exports = {
  claim,
  nominate,
  deny,
  confirm,
  give,
  destroy,
  balance,
  pending,
  CommandError,
};
