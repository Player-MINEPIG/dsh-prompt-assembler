import type { RequestAssembler } from './index.js'
export class CoreRequestBackend {
  constructor(runtime: RequestAssembler);
  readonly id: 'core';
  available(): boolean; requireAvailable(): void; startsSeries(agent: any): boolean;
  execute(payload: any, next: () => Promise<any>): Promise<any>;
}
