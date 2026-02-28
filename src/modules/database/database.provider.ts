import { Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { MongoAdapter } from '../engines/nosql.engine';
import { IDatabaseAdapter } from '../../common/interfaces/database-adapter.interface';

export const DatabaseProvider = {
  provide: 'DATABASE_ADAPTER',
  
  scope: Scope.REQUEST,
  
  useFactory: async (request: Request): Promise<IDatabaseAdapter> => {
    const tenantId = request.headers['x-tenant-id'] || 'default_tenant';
    
    // TODO: In the future, we will query the system database here to find out 
    // if 'tenantId' uses Postgres or Mongo. For now, we force MongoDB.
    
    const dbType = 'mongodb'; 
    const mongoUri = process.env.MONGO_URI || 'mongodb://admin:rootpassword@localhost:27017';

    if (dbType === 'mongodb') {
      const adapter = new MongoAdapter();
      await adapter.connect(`${mongoUri}/${tenantId}?authSource=admin`);
      return adapter;
    }
    throw new Error(`[DatabaseProvider] Unsupported database type: ${dbType}`);
  },
  
  inject: [REQUEST],
};