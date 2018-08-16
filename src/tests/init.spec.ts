import * as ws from 'html5-websocket';
import { ErcDex } from '../generated/ercdex';

before(() => {
  (global as any).WebSocket = ws;

  ErcDex.Initialize({
    host: 'localhost:8443'
  });
});

after(() => {
  process.exit();
});
