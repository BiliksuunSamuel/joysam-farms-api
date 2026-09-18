import { Injectable, Logger } from '@nestjs/common';
import { ApiResponseDto } from 'src/dtos/common/api.response.dto';
import { BaseFilter } from 'src/dtos/common/base.filter.dto';
import { DropdownOption } from 'src/dtos/common/dropdown.option.dto';
import { PagedResults } from 'src/dtos/common/paged.results.dto';
import { RoleDropdownFilter } from 'src/dtos/role/role.dropdown.filter.dto';
import { RoleRequest } from 'src/dtos/role/role.request.dto';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { RoleRepository } from 'src/repositories/role.repository';
import { UserRepository } from 'src/repositories/user.repository';
import { Role } from 'src/schemas/role.schema';
import { toPaginationInfo } from 'src/utils';

@Injectable()
export class RoleService {
  private readonly logger = new Logger(RoleService.name);
  constructor(
    private readonly roleRepository: RoleRepository,
    private readonly userRepository: UserRepository,
  ) {}

  //get by id
  async getById(id: string): Promise<ApiResponseDto<Role>> {
    try {
      const role = await this.roleRepository.getById(id);
      if (!role) {
        return CommonResponses.NotFoundResponse<Role>('Role not found');
      }
      return CommonResponses.OkResponse<Role>(role);
    } catch (error) {
      this.logger.error(
        'an error occurred while getting role by id',
        id,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<Role>(
        'An error occurred while getting role by id',
      );
    }
  }

  async listForDropdown(
    filter: RoleDropdownFilter,
  ): Promise<ApiResponseDto<DropdownOption[]>> {
    try {
      const results = await this.roleRepository.listForDropdown(filter);
      return CommonResponses.OkResponse<DropdownOption[]>(results);
    } catch (error) {
      this.logger.error(
        'an error occurred while listing roles for dropdown',
        filter,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<DropdownOption[]>(
        'An error occurred while listing roles',
      );
    }
  }

  //list
  async list(filter: BaseFilter): Promise<ApiResponseDto<PagedResults<Role>>> {
    try {
      const { page, pageSize } = toPaginationInfo(filter);
      const { results, totalCount } = await this.roleRepository.list(filter);
      return CommonResponses.OkResponse<PagedResults<Role>>({
        results,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        page,
        pageSize,
      });
    } catch (error) {
      this.logger.error('an error occurred while listing roles', filter, error);
      return CommonResponses.InternalServerErrorResponse<PagedResults<Role>>(
        'An error occurred while listing roles',
      );
    }
  }

  //create role
  async create(request: RoleRequest): Promise<ApiResponseDto<Role>> {
    try {
      const role = await this.roleRepository.create(request);
      return CommonResponses.CreatedResponse<Role>(role);
    } catch (error) {
      this.logger.error(
        'an error occurred while creating role',
        request,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<Role>(
        'An error occurred while creating role',
      );
    }
  }

  //update role
  async update(
    id: string,
    request: RoleRequest,
  ): Promise<ApiResponseDto<Role>> {
    try {
      const role = await this.roleRepository.update(id, request);
      if (!role) {
        return CommonResponses.NotFoundResponse<Role>('Role not found');
      }
      return CommonResponses.OkResponse<Role>(role);
    } catch (error) {
      this.logger.error(
        'an error occurred while updating role',
        { id, request },
        error,
      );
      return CommonResponses.InternalServerErrorResponse<Role>(
        'An error occurred while updating role',
      );
    }
  }

  //delete role
  async delete(id: string): Promise<ApiResponseDto<Role>> {
    try {
      const role = await this.roleRepository.getById(id);
      if (!role) {
        return CommonResponses.NotFoundResponse<Role>('Role not found');
      }
      if (await this.userRepository.existsByRoleId(id)) {
        return CommonResponses.ConflictResponse<Role>(
          'This role is still assigned to one or more users',
        );
      }

      const deleted = await this.roleRepository.delete(id);
      return CommonResponses.OkResponse<Role>(deleted);
    } catch (error) {
      this.logger.error('an error occurred while deleting role', id, error);
      return CommonResponses.InternalServerErrorResponse<Role>(
        'An error occurred while deleting role',
      );
    }
  }
}
