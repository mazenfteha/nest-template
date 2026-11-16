import { DynamicModule, Global, Module } from '@nestjs/common';

/**
 * Jest stand-in for @nestjs/observe, which is ESM-only and can't be loaded by Jest's CommonJS runtime.
 * Observe is disabled under NODE_ENV=test anyway; this keeps the same API surface as no-ops.
 * Wired via `moduleNameMapper` in package.json (unit) and test/jest-e2e.json (e2e).
 */
const noopSpan = { addTags: () => undefined, setTag: () => undefined };
const noopMetric = {
  increment: () => undefined,
  decrement: () => undefined,
  setValue: () => undefined,
  observe: () => undefined,
};

export class TracerService {
  currentTraceId(): string | null {
    return null;
  }
  async createSpan(_name: string, callback: (span: unknown) => unknown) {
    return callback(noopSpan);
  }
  async captureError(): Promise<void> {}
  setAttribute(): void {}
  getAttribute(): undefined {
    return undefined;
  }
  counter() {
    return noopMetric;
  }
  gauge() {
    return noopMetric;
  }
  summary() {
    return noopMetric;
  }
}

@Global()
@Module({ providers: [TracerService], exports: [TracerService] })
class ObserveStubModule {
  static forRoot(): DynamicModule {
    return { module: ObserveStubModule };
  }
  static forRootAsync(): DynamicModule {
    return { module: ObserveStubModule };
  }
}

export function createObserveModule() {
  return { ObserveModule: ObserveStubModule, ObserveInstrument: undefined };
}
