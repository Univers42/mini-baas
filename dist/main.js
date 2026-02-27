"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
async function bootstrap() {
    process.env.MONGO_URI ??= `mongodb://${process.env.MONGO_USER ?? 'admin'}:${process.env.MONGO_PASSWORD ?? 'rootpassword'}@${process.env.MONGO_HOST ?? 'localhost'}:${process.env.MONGO_PORT ?? '27018'}`;
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
//# sourceMappingURL=main.js.map