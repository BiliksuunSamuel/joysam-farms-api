import { BaseFilter } from 'src/dtos/common/base.filter.dto';

// Paginated only for now - startDate/endDate from BaseFilter are wired up
// in the repository, filtering on createdAt.
export class UserAuthSessionFilter extends BaseFilter {}
