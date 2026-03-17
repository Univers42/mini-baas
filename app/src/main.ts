import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe, Logger, LogLevel } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import * as compression from "compression";
import * as cookieParser from "cookie-parser";
import helmet from "helmet";
import { AllExceptionsFilter } from "./common/exceptions/all-exceptions.filter";

// Helper function to map a string level to NestJS LogLevel array
function getLogLevels(level?: string): LogLevel[] {
  switch (level?.toLowerCase()) {
    case "fatal":
      return ["fatal"];
    case "error":
      return ["fatal", "error"];
    case "warn":
      return ["fatal", "error", "warn"];
    case "log":
      return ["fatal", "error", "warn", "log"];
    case "debug":
      return ["fatal", "error", "warn", "log", "debug"];
    case "verbose":
      return ["fatal", "error", "warn", "log", "debug", "verbose"];
    default:
      // Default to 'log' if no valid level is provided via environment
      return ["fatal", "error", "warn", "log"];
  }
}

async function bootstrap() {
  // Inject the dynamic log levels based on the environment variable
  const app = await NestFactory.create(AppModule, {
    logger: getLogLevels(process.env.LOG_LEVEL),
  });

  const config = app.get(ConfigService);
  const port = config.get<number>("PORT", 3000);

  // Security & Middleware
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  // Global Exception Filter (Prevents Data Leakage)
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // CORS Configuration
  app.enableCors({
    origin: config.get("CORS_ORIGINS", "*"),
    credentials: true,
  });

  // Swagger API Documentation Setup
  const swaggerEnabled = /^(true|1|yes|on)$/i.test(
    String(config.get("SWAGGER_ENABLED", "false")),
  );

  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("mini-baas Engine")
      .setDescription("Metadata-driven polyglot Backend-as-a-Service")
      .setVersion("1.0")
      .addBearerAuth()
      .addApiKey({ type: "apiKey", in: "header", name: "x-api-key" }, "api-key")
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("docs", app, document);
  }

  await app.listen(port);
  Logger.log(`mini-baas running on port ${port}`, "Bootstrap");
  if (swaggerEnabled) {
    Logger.log(`Swagger Docs: http://localhost:${port}/docs`, "Bootstrap");
  }
}

bootstrap().catch((err) => {
  const logger = new Logger("Bootstrap");
  logger.error("💥 Engine failed to start:");
  logger.error(err);
  process.exit(1);
});
