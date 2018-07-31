import * as ws from 'html5-websocket';
import { Aqueduct } from '../generated/aqueduct';

before(() => {
  (global as any).WebSocket = ws;

  Aqueduct.Initialize({
    host: 'localhost:8443'
  });
});

after(() => {
  process.exit();
});
