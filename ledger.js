const COMMAND_NEW_USER = 'new_user';
const COMMAND_MINT = 'mint';
const COMMAND_CLAIM = 'claim';
const COMMAND_VOTE = 'vote';

function parseCommandStatement(statement) {
  const parts = statement.split(/\s+/);

  if (parts.length < 2) {
    throw new Error('Must give at least a timestamp and a command');
  }

  const datetime = new Date(Date.parse(parts[0]));
  const command = parts[1];
  const parameters = parts.splice(2);

  return { datetime, command, parameters };
}

function assertIntegerText(valueText) {
  const value = parseInt(valueText, 10);

  if (Number.isNaN(value)) {
    throw new Error('Value is not a number');
  }

  if (value !== parseFloat(valueText)) {
    throw new Error('Value is not an integer');
  }
}

function assertParamCount(params, count) {
  if (params.length !== count) {
    throw new Error('Wrong number of parameters');
  }
}

class Ledger {
  constructor() {
    this.users = {};
    this.nextUserId = 0;
    this.claims = {}; // claim id -> transaction
    this.voters = {}; // claim id -> Set(user IDs who have voted)
    this.lastClaim = undefined;

    this.commands = [];
  }

  addClaim(claimID, dt, mdt, fromID, toID, amount) {
    if (!(dt instanceof Date)) {
      throw new Error('Timestamp must be a Date object');
    }

    if (!(mdt instanceof Date)) {
      console.log(mdt);
      throw new Error('Maturation date must be a Date object');
    }

    if (fromID === toID) {
      throw new Error('User cannot claim their own funds');
    }

    const newClaim = {
      datetime: dt,
      matureDatetime: mdt,
      fromID,
      toID,
      amount,
      votes: 0, // All transactions start with 0 votes
    };

    this.claims[claimID] = newClaim;
    this.lastClaim = { [claimID]: newClaim };
    this.voters[claimID] = new Set();

    return newClaim;
  }

  dispatch(commandStatement) {
    const { datetime, command, parameters } = parseCommandStatement(commandStatement);

    if (this.commands.length > 0 && datetime < this.commands[this.commands.length - 1].datetime) {
      throw new Error('Command is from before earlier commands');
    }

    switch (command) {
      case COMMAND_NEW_USER: {
        assertParamCount(parameters, 1);

        const [name] = parameters;

        if (name in this.users) {
          throw new Error('User already exists');
        }

        // Add an ID for the new user
        this.users[name] = this.nextUserId;
        this.nextUserId += 1;

        break;
      }
      case COMMAND_MINT: {
        assertParamCount(parameters, 3);

        const [claimID, userName, amountText] = parameters;

        if (claimID in this.claims) {
          throw new Error('Claim ID already exists');
        }

        if (!(userName in this.users)) {
          throw new Error('User to mint funds for does not exist');
        }

        assertIntegerText(amountText);

        const amount = parseInt(amountText, 10);

        if (amount <= 0) {
          throw new Error('Amount being claimed is negative or zero');
        }

        const userID = this.users[userName];

        // Create a mint operation

        this.addClaim(
          claimID,
          datetime,
          datetime, // Matures when created
          undefined, // Funds are not coming from any user
          userID,
          amount,
        );

        break;
      }
      case COMMAND_CLAIM: {
        assertParamCount(parameters, 5);

        const [claimID, matureDatetimeText, toUserName, fromUserName, amountText] = parameters;

        // Parse parameters

        const matureDatetime = new Date(Date.parse(matureDatetimeText));

        // Validate parameters

        if (claimID in this.claims) {
          throw new Error('Claim ID already exists');
        }

        if (!(toUserName in this.users)) {
          throw new Error('Username of user claiming funds does not exist');
        }

        if (!(fromUserName in this.users)) {
          throw new Error('Username of user whose funds are being claimed does not exist');
        }

        assertIntegerText(amountText);

        const amount = parseInt(amountText, 10);

        if (amount <= 0) {
          throw new Error('Amount being claimed is negative or zero');
        }

        const toID = this.users[toUserName];
        const fromID = this.users[fromUserName];

        if (this.getBalance(fromUserName, datetime) < amount) {
          throw new Error('User does not have enough funds to fulfill claim');
        }

        // Create a claim transaction

        this.addClaim(
          claimID,
          datetime,
          matureDatetime,
          fromID,
          toID,
          amount,
        );

        break;
      }
      case COMMAND_VOTE: {
        assertParamCount(parameters, 3);

        const [claimID, voterName, voteText] = parameters;

        const vote = parseInt(voteText, 10);

        if (!(claimID in this.claims)) {
          throw new Error('Claim with given ID does not exist');
        }

        if (!(voterName in this.users)) {
          throw new Error('User with given name does not exist');
        }

        if (!(vote === -1 || vote === 1)) {
          throw new Error('Only +1 or -1 votes are allowed');
        }

        const voterID = this.users[voterName];

        if (this.voters[claimID].has(voterID)) {
          throw new Error('User has already voted on this claim');
        }

        if (this.claims[claimID].toID === voterID && vote > 0) {
          throw new Error('User cannot vote to confirm their own claim');
        }

        if (datetime >= this.claims[claimID].matureDatetime) {
          throw new Error('Cannot vote on a mature claim');
        }

        this.claims[claimID].votes += vote;
        this.voters[claimID].add(voterID);

        break;
      }
      default:
        throw new Error(`Unknown command: "${command}"`);
    }

    this.commands.push({ datetime, command, parameters, text: commandStatement });

    return this;
  }

  getUsers() {
    // TODO: use immutable data structures and get rid of the need for this
    return JSON.parse(JSON.stringify(this.users));
  }

  getClaims() {
    // TODO: use immutable data structures and get rid of the need for this
    return JSON.parse(JSON.stringify(this.claims));
  }

  getLastClaim() {
    // TODO: use immutable data structures and get rid of the need for this
    return JSON.parse(JSON.stringify(this.lastClaim));
  }

  getBalance(userName, maybeDatetime = undefined) {
    if (!(userName in this.users)) {
      return 0;
    }

    // Use the current time if one is not given
    const datetime = maybeDatetime !== undefined
      ? maybeDatetime
      : new Date();

    if (!(datetime instanceof Date)) {
      throw new Error('Date of balance must be Date object');
    }

    const userID = this.users[userName];

    const lastCommand = this.commands.length > 0
      ? this.commands[this.commands.length - 1]
      : undefined;

    if (lastCommand === undefined || lastCommand.datetime <= datetime) {
      // We are being asked for the balance of the user at the present state of the ledger

      // Gather mature claims which were owed to the user
      const matureConfirmedClaimsForUser = Object.values(this.claims)
        // Only claims which are owed to this user
        .filter(({ toID }) => toID === userID)
        // Only claims whose maturation date was in the past
        .filter(({ matureDatetime }) => datetime >= matureDatetime)
        // Only claims which were not voted to be denied
        .filter(({ votes }) => votes >= 0);

      // Gather outstanding claims on the user
      const outstandingUndeniedClaimsFromUser = Object.values(this.claims)
        // Only claims on this user's funds
        .filter(({ fromID }) => fromID === userID)
        // Only claims which have not been voted to be denied
        .filter(({ votes }) => votes >= 0);

      // Sum up the user's balance as
      // + mature claims of funds for the user
      // - claims of funds from the user, mature or not
      const owedToUser = matureConfirmedClaimsForUser
        .reduce((balance, claim) => balance + claim.amount, 0);
      const maybeOwedByUser = outstandingUndeniedClaimsFromUser
        .reduce((balance, claim) => balance - claim.amount, 0);

      return owedToUser + maybeOwedByUser;
    }

    // We are being asked for a balance in the past
    // so we will recreate the past up to the specified datetime and then ask it for the balance

    const ledger = new Ledger();

    for (let i = 0; i < this.commands.length; i += 1) {
      const command = this.commands[i];

      if (command.datetime >= datetime) {
        break;
      }

      ledger.dispatch(command.text);
    }

    return ledger.getBalance(userName, datetime);
  }

  getPending(userName, maybeDatetime) {
    if (!(userName in this.users)) {
      return [];
    }

    // Use the current time if one is not given
    const datetime = maybeDatetime !== undefined
      ? maybeDatetime
      : new Date();

    const userID = this.users[userName];

    return Object.values(this.claims)
      .filter(({ fromID, toID }) => fromID === userID || toID === userID)
      .filter((claim) => claim.matureDatetime > datetime);
  }

  getClaim(claimID) {
    if (!(claimID in this.claims)) {
      return undefined;
    }

    return this.claims[claimID];
  }

  getUserID(userName) {
    if (!(userName in this.users)) {
      throw new Error('User with given name does not exist');
    }

    return this.users[userName];
  }

  getUserNamesByID(userID) {
    return Object.entries(this.users)
      .filter(([, id]) => id === userID)
      .map(([userName]) => userName);
  }
}

module.exports = {
  Ledger,
};
