import { Controller, Get } from '@nestjs/common';

export const internalUsers = [
  { id: 'ops-nabil', label: 'Nabil' },
  { id: 'ops-support', label: 'Support' },
  { id: 'ops-sales', label: 'Sales' },
];

@Controller('internal/users')
export class InternalUsersController {
  @Get()
  listUsers() {
    return { users: internalUsers };
  }
}
