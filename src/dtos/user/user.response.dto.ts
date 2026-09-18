import { ApiProperty } from '@nestjs/swagger';
import { UserStatus } from 'src/enums';
import { ShopInfo } from 'src/models/shop/shop-info.model';
import { BaseSchema } from 'src/schemas';

export class UserResponse extends BaseSchema {
  @ApiProperty()
  name: string;
  @ApiProperty()
  email: string;
  @ApiProperty()
  phone: string;
  @ApiProperty()
  roleId: string;
  @ApiProperty({ enum: UserStatus })
  status: UserStatus;
  @ApiProperty()
  shopId: string;
  @ApiProperty({ type: ShopInfo })
  shopInfoSnapshot: ShopInfo;
  @ApiProperty()
  permissionKeys: string[];
  @ApiProperty()
  allPermissions: boolean;
}
