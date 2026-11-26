// Owner-scoped account deletion request intake; no deletion execution or credentials access.
export { AccountDeletionRequestsService } from './services/account-deletion-requests.service.js';
export {
  accountDeletionRequestSchema,
  type AccountDeletionRequestInput,
} from './dto/account-deletion-request.dto.js';
