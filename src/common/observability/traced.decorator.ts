import { Inject } from '@nestjs/common';
import { TracerService } from '@nestjs/observe';

const TRACER_KEY = '__observeTracer';

export function Traced(spanName?: string): MethodDecorator {
  return (target, key, descriptor: PropertyDescriptor) => {
    Inject(TracerService)(target, TRACER_KEY);

    const original = descriptor.value;
    // createSpan() always returns a Promise, so wrapping a sync method would change its return type.
    if (original?.constructor?.name !== 'AsyncFunction') {
      throw new Error(
        `@Traced() only supports async methods (${target.constructor.name}.${String(key)})`,
      );
    }
    const name = spanName ?? `${target.constructor.name}.${String(key)}`;

    descriptor.value = function (this: any, ...args: unknown[]) {
      const tracer: TracerService | undefined = this[TRACER_KEY];
      // Outside a traced request/job (seed, bootstrap, cron) createSpan throws, so run untraced.
      if (!tracer || tracer.currentTraceId() === null) {
        return original.apply(this, args);
      }
      return tracer.createSpan(name, () => original.apply(this, args));
    };

    // Keep metadata set by other decorators (@Get, @Roles, ...) on the wrapped function.
    for (const k of Reflect.getMetadataKeys(original)) {
      Reflect.defineMetadata(
        k,
        Reflect.getMetadata(k, original),
        descriptor.value,
      );
    }
    return descriptor;
  };
}
