import { createHash } from 'node:crypto';

import { applyDecorators } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

type EndpointBudget = { limit: number; ttl: number };

/**
 * Keep the published operation and existing default-throttler bucket stable
 * when a controller or handler is renamed. The legacy names are contract data,
 * not the current class/method names. Use in place of a method's @Throttle or
 * @RateLimit decorator; omit the budget to inherit the global default.
 */
export function StableHttpOperation(
  legacyController: string,
  legacyHandler: string,
  tag: string,
  budget?: EndpointBudget,
): MethodDecorator {
  return applyDecorators(
    ApiOperation({
      operationId: `${legacyController}_${legacyHandler}`,
      tags: [tag],
      summary: undefined,
    }),
    Throttle({
      default: {
        ...budget,
        // Byte-for-byte compatible with the locked Nest Throttler default.
        // Keep tracker/name inputs and storage hashing unchanged.
        generateKey: (_context, tracker, name) =>
          createHash('sha256')
            .update(`${legacyController}-${legacyHandler}-${name}-${tracker}`)
            .digest('hex'),
      },
    }),
  );
}
