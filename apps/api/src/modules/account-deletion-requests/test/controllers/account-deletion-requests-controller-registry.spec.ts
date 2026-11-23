import { RequestMethod } from '@nestjs/common';
import {
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  MODULE_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { AccountDeletionRequestsController } from '../../controllers/account-deletion-requests.controller.js';
import { AccountDeletionRequestsModule } from '../../account-deletion-requests.module.js';

describe('AccountDeletionRequestsModule controller registry', () => {
  it('registers authenticated request intake and status under the current user’s route', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AccountDeletionRequestsModule)).toEqual(
      [AccountDeletionRequestsController],
    );
    expect(Reflect.getMetadata(PATH_METADATA, AccountDeletionRequestsController)).toBe(
      'users/me/account-deletion-request',
    );
    const controller = AccountDeletionRequestsController.prototype;
    const findOwn = Object.getOwnPropertyDescriptor(controller, 'findOwn')?.value as object;
    const submit = Object.getOwnPropertyDescriptor(controller, 'submit')?.value as object;
    expect(Reflect.getMetadata(METHOD_METADATA, findOwn)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(METHOD_METADATA, submit)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, submit)).toBe(200);
  });
});
