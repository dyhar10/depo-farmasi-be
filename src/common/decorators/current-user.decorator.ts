import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserSessionProfile } from '../../modules/auth/domain/auth.domain';

export const CurrentUser = createParamDecorator(
  (data: keyof UserSessionProfile | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as UserSessionProfile;
    return data ? user?.[data] : user;
  },
);

