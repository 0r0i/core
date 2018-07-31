import { Aqueduct } from '../../generated/aqueduct';
import { sleep } from './sleep';

/**
 * Captures events so tests can verify that events are published appropriately
 */
export class EventSink<T, D> {
  public readonly events = new Array<D>();

  constructor(
    subscription: Aqueduct.Events.SocketEvent<T, D>,
    params: T
  ) {
    subscription.subscribe(params, data => {
      this.events.push(data);
    });
  }

  public async verifyEventState(eventsFn: (e: D[]) => boolean, message: string) {
    const maxTries = 50;
    let tries = 0;
    while (tries < maxTries) {
      tries++;
      if (eventsFn(this.events)) {
        return;
      }

      await sleep(100);
    }

    throw new Error(message);
  }
}
