import { Injectable } from '@nestjs/common';

import { AvatarService } from './avatar.service.js';

/** Public reads only; the underlying service enforces current active ownership. */
@Injectable()
export class AvatarPublicReadFacade {
  constructor(private readonly avatars: AvatarService) {}

  readPublic(key: string) {
    return this.avatars.readPublic(key);
  }
}
