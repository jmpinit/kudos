# BBucks

BBucks is a Slack app which provides a currency for users in a Slack workspace. As opposed to crypto currencies, bbucks
is centralized and requires trust between the participating users. It is meant to provide the machinery of a social
currency which allows participants to quantify goodwill produced by carrying out good deeds.

The Slack app provides commands which allow users to claim funds from a "universe" account. Users must wait one day for
the funds to become available (the claim "matures"). During that time other users may vote to confirm or deny the claim.
If a claim receives more denials than confirmations it will not mature, and the funds will return to the universe
account after the time limit elapses.

Users can give each other portions of their balances at any time and these transactions will complete instantly.

Users can also "destroy" quantities of their funds, which returns them to the universe account. It is suggested that
this mechanism may be used to convert funds into another currency (e.g., real world rewards). Another party on the outside
can interpret the destruction transaction as an exchange of value into their system.

## Suggested Usage

Every week enough bbucks are minted into the universe account to bring its balance to 10080, which is the number of
minutes in a week. It's suggested that the value of 1 bbuck is equal to 1 minute of engineering time.

Anyone may claim any amount of bbucks up to the total available in the universe account. However, everyone is encouraged
to vote to deny unreasonable claims.

The system is implemented on top of Slack to make discussion about transactions easy. Such discussion in the exchange
channel is encouraged. And don't forget you can also just discuss issues face-to-face.

## Slack Commands

* `/claim <amount> for <reasons>` - Claim the given amount of funds from the universe
* `/deny <transaction ID>` - Vote to deny the transaction with the given ID
* `/confirm <transaction ID>` - Vote to confirm the transaction with the given ID
* `/give <amount> to <username>` - Give the specified amount to the specified user
* `/destroy <amount>` - Destroy the given amount of your balance
* `/balance <username>` - Print the user's current balance
* `/pending <username>` - List the pending claims involving the given user

## Ledger Language

The ledger is stored in a simple text format to make human verification straightforward.

Each ledger entry begins with a timestamp of when the command should be considered executed. All amounts are
non-negative integers. All dates are in ISO 8601 format.

### Commands

* `new_user <username>` - Creates a new user identity with the given name. Names must be unique.
* `mint <username> <amount>` - Immediately increase the given user's account balance by the given amount.
* `claim <unique ID> <time of maturation> <destination username> <source username> <amount>` -
  Claim given amount of funds from user. Funds are not available in the destination account until the maturation date.
  However, the funds are unavailable in the source account from the moment that the claim is made. The funds transfer to
  the destination account after the maturation date if the claim has a zero or positive vote count. Otherwise, they
  become available again in the source account after the maturation date.
* `vote <claim ID> <username> <-1 or 1>` - Vote to confirm (1) or deny (-1) a specific claim. Each user may only vote
  once on any particular claim.

### Example Ledger

```
2021-06-05T17:39:09.946Z new_user universe
2021-06-05T17:39:09.958Z new_user person
2021-06-05T17:39:09.958Z new_user other.person
2021-06-05T17:39:09.959Z mint xyz universe 10080
# person is claiming funds for "doing the dishes"
2021-06-05T17:40:14.812Z claim 84503f 2021-06-06T17:40:14.812Z person universe 10
# other.person is voting to deny claim because "they didn't do the dishes"
2021-06-05T17:45:14.812Z vote 84503f other.person -1
```

## Running Tests

```
yarn test
```

Tests are implemented with [Jest](https://jestjs.io/).
