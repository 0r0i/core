[![npm version](https://badge.fury.io/js/aqueduct.svg)](https://badge.fury.io/js/aqueduct)

# Aqueduct JavaScript SDK

## Overview

The JavaScript client library offers a simple way to begin interacting with the Aqueduct network, including convenience wrappers for a variety of trading related tasks. While we do offer a standalone [REST API](https://aqueduct.ercdex.com/rest.html) and [WebSocket API](https://aqueduct.ercdex.com/#/events), the client library helps to bundle together common workflows and enhances API discoverability for TypeScript users.

## Quick Start

### Setup environment

- Must have [node.js](https://nodejs.org/en/) installed

### Install NPM Package

`yarn add aqueduct` or `npm install aqueduct`

## Usage

The SDK can be thought of as containing four 'types' of actions:
- Initialization
- High level trading workflows
- REST API interaction
- WebSocket API interaction

### Initialization

ErcDex.Initialize *must* be called before interacting with the SDK in any way.

```
import { ErcDex } from '@ercdex/core';

ErcDex.Initialize();
```

#### A note about WebSockets

Modern browsers containing native implementations of the [WebSockets API](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API). If you intend to use the Events API outside of a browser, you'll need to bring your own WebSockets implementation. We recommend a great library like [html5-websocket](https://github.com/pladaria/html5-websocket). In a node.js environment, make sure to put the WebSocket constructor the global namespace:

```
import * as ws from 'html5-websocket';

global.WebSocket = ws;
```

### Trading Workflows

Trading workflows refers to common trading actions that are actually composed of several layers, including interacting with the Aqueduct API, validating order parameters, and interacting with the Ethereum network in some way (off chain signing, or sending transactions). It is completely possible to post, fill, and cancel orders without using these workflow wrappers, but these wrappers create an intuitive interface for traders.

#### Placing a Limit Order

Limit orders represent a brand new order with a quantity and price specified by the user. Limit orders can be filled by other traders.

```
import { BigNumber } from 'bignumber.js';
import { ErcDex } from '@ercdex/core';
import { LimitOrder } from '../limit-order';
import * as Web3 from 'web3';

ErcDex.Initialize();

(async () => {
  const order = await new LimitOrder({
    // an unlocked account configured in local node (Parity)
    account: '0x00be81aeb2c6b82c68123f49b4bf983224124ada',
    // 'ZRX' in ZRX/WETH
    baseTokenSymbol: 'ZRX',
    // 'WETH' in ZRX/WETH
    quoteTokenSymbol: 'WETH',
    price: new BigNumber(.0013),
    // base amount in wei - buying 40 ZRX
    quantityInWei: new BigNumber(40000000000000000000),
    // buying ZRX
    type: 'buy',
    // points to a local node (Parity)
    web3: new Web3(new Web3.providers.HttpProvider('http://localhost:8545'))
  }).execute();

  console.log(order);
})();

```

#### Placing a Market Order

Market orders attempt to fill existing orders at the best price. Traders placing market orders don't specify a price, only a quantity.

```
import { BigNumber } from 'bignumber.js';
import { Aqueduct, MarketOrder } from '@ercdex/core';
import * as Web3 from 'web3';

// Initialize the Aqueduct client
ErcDex.Initialize();

(async () => {
  await new MarketOrder({
    account: '0x00be81aeb2c6b82c68123f49b4bf983224124ada',
    baseTokenSymbol: 'MLN',
    quoteTokenSymbol: 'WETH',
    // buying .1 MLN
    quantityInWei: new BigNumber(100000000000000000),
    web3: new Web3(new Web3.providers.HttpProvider('http://localhost:8545'))
    type: 'buy'
  }).execute();
})();

```

#### Filling a standalone order

You may want to fill a single order rather than using the more advanced Market Order option. 

```
import { ZeroEx } from '0x.js';
import { BigNumber } from 'bignumber.js';
import { Aqueduct, FillOrder } from '@ercdex/core';
import * as Web3 from 'web3';

ErcDex.Initialize();

(async () => {
  await new FillOrder({
    orderHash: '0x96be98070f1e3b0ff06014f34d5916e7a26b37b60f5583b44c7dca27e0051eaa',
    takerAmountInWei: ZeroEx.toBaseUnitAmount(new BigNumber(0.000012), 18),
    account: '0x00be81aeb2c6b82c68123f49b4bf983224124ada',
    web3: new Web3(new Web3.providers.HttpProvider('http://localhost:8545'))
  }).execute();

  process.exit(0);
})();

```

#### Canceling an order

Traders can cancel limit orders that they've opened.

```
import { Aqueduct, CancelOrder } from '@ercdex/core';
import * as Web3 from 'web3';

(async () => {
  ErcDex.Initialize();

  const cancelResult = await new CancelOrder({
    orderHash: order.orderHash,
    account: order.makerAddress,
    web3: new Web3(new Web3.providers.HttpProvider('http://localhost:8545'))
  }).execute();

  console.log(cancelResult);
})();

```
```

### Rest API Services

The REST API SDK (conveniently located in the ErcDex.Api namespace) is a simple service for interacting with REST endpoints. Domain objects are grouped logically into services. [See the full REST API documentation here.](https://docs.ercdex.com/#restapi)

#### Getting a list of your open orders

```
import { ErcDex } from '@ercdex/core';

ErcDex.Initialize();

(async () => {
  const orders = await new ErcDex.Api.OrdersService().get({
    makerAddress: '0x00be81aeb2c6b82c68123f49b4bf983224124ada'
  });

  console.log(orders);
})();

```

### WebSocket API Services

Event related functions are contained within the "Events" namespace. All events follow a simple subscription model, taking in parameters and a callback to handle the event feed. Subscriptions must be managed by the client and unused subscriptions should be `unsubscribed`.

```
import { ErcDex } from '@ercdex/core';

// Initialize client
ErcDex.Initialize();

const subscription = new ErcDex.Events.AccountNotification().subscribe({
  account: 'XXXX'
}, data => {
  console.log(data);
});

// some time later
subscription.unsubscribe();
```

## SDK Technical Documentation

Documentation on available imports and client APIs can be found [here.](https://aqueduct.ercdex.com/client/modules/_aqueduct_.html)
