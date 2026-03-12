"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const swagger_1 = require("@nestjs/swagger");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const helmet_1 = require("helmet");
const all_exceptions_filter_1 = require("./common/exceptions/all-exceptions.filter");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        logger: ['error', 'warn', 'log', 'debug'],
    });
    const config = app.get(config_1.ConfigService);
    const port = config.get('PORT', 3000);
    app.use((0, helmet_1.default)());
    app.use(compression());
    app.use(cookieParser());
    app.useGlobalFilters(new all_exceptions_filter_1.AllExceptionsFilter());
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
    }));
    app.enableCors({
        origin: config.get('CORS_ORIGINS', '*'),
        credentials: true,
    });
    if (config.get('SWAGGER_ENABLED') === 'true') {
        const swaggerConfig = new swagger_1.DocumentBuilder()
            .setTitle('mini-baas Engine')
            .setDescription('Metadata-driven polyglot Backend-as-a-Service')
            .setVersion('1.0')
            .addBearerAuth()
            .addApiKey({ type: 'apiKey', in: 'header', name: 'x-api-key' }, 'api-key')
            .build();
        const document = swagger_1.SwaggerModule.createDocument(app, swaggerConfig);
        swagger_1.SwaggerModule.setup('docs', app, document);
    }
    await app.listen(port);
    common_1.Logger.log(`mini-baas running on port ${port}`, 'Bootstrap');
    common_1.Logger.log(`Swagger Docs: http://localhost:${port}/docs`, 'Bootstrap');
}
bootstrap();
//# sourceMappingURL=main.js.map