import { UserRequest } from './user.request.dto';

// No password here - it's system-generated (equal to the generated
// username) at creation time, not admin-supplied. See UserService.create.
export class CreateUserRequest extends UserRequest {}
