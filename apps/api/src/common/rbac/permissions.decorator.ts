import { SetMetadata } from '@nestjs/common';

import type { AdminPermission } from './admin-permissions.js';

export const REQUIRED_ADMIN_PERMISSIONS = 'required_admin_permissions';

export const RequireAdminPermissions = (...permissions: AdminPermission[]) =>
  SetMetadata(REQUIRED_ADMIN_PERMISSIONS, permissions);
