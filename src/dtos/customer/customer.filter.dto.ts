import { BaseFilter } from 'src/dtos/common/base.filter.dto';

// `query` (from BaseFilter) searches over name/phone - see
// CustomerRepository.list.
export class CustomerFilter extends BaseFilter {}
