import { Injectable } from '@nestjs/common';

import { AvatarService } from './avatar.service.js';
import type { AvatarUploadFile } from './avatar-validation.js';

/** Account-scoped avatar commands; storage and maintenance stay private. */
@Injectable()
export class AvatarSelfFacade {
  constructor(private readonly avatars: AvatarService) {}

  upload(userId: string, file?: AvatarUploadFile) {
    return this.avatars.upload(userId, file);
  }

  delete(userId: string) {
    return this.avatars.delete(userId);
  }
}
