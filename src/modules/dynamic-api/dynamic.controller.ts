// src/modules/dynamic-api/dynamic.controller.ts
import { Controller, Get, Param, Inject } from '@nestjs/common';

// ¡AQUÍ ESTÁ LA MAGIA! Añadimos la palabra 'type'
import type { IDatabaseAdapter } from '../../common/interfaces/database-adapter.interface';

@Controller('api/:tenantId/:entityName')
export class DynamicController {
  
  constructor(
    @Inject('DATABASE_ADAPTER') private readonly db: IDatabaseAdapter
  ) {}

  @Get(':id')
  async getOne(
    @Param('tenantId') tenant: string,
    @Param('entityName') entity: string,
    @Param('id') id: string
  ) {
    console.log(`[DynamicController] Fetching ${entity} with id ${id} for tenant ${tenant}`);
    const result = await this.db.findOne(entity, { id });
    return {
      success: true,
      data: result || null
    };
  }
}