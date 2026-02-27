import { Controller, Get, Param } from '@nestjs/common';

@Controller('api/:tenantId/:entityName')
export class AppController {
  @Get(':id')
  getOne(
    @Param('tenantId') tenant: string,
    @Param('entityName') entity: string,
    @Param('id') id: string
  ) {
    return {
      mensaje: "¡Magia de enrutamiento dinámico funcionando!",
      cliente_id: tenant,
      coleccion_buscada: entity,
      registro_id: id
    };
  }
}
