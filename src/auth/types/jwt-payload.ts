import { UserRole } from 'src/common/utils/enums/user-role';

export type AuthJwtPayload = {
  sub: string;
  dealerId: string | null;
  role: UserRole | null;
};
