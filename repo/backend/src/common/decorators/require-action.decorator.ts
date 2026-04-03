import { SetMetadata } from '@nestjs/common';

export const ACTION_KEY = 'action';
export const RequireAction = (action: string) => SetMetadata(ACTION_KEY, action);
