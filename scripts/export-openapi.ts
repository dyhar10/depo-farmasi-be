import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../src/app.module';

async function exportOpenApi() {
  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle('Depo Farmasi API')
    .setDescription('API Pengadaan dan Pengelolaan Barang Depo Farmasi (Obat dan BMHP)')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const outputPath = path.resolve(__dirname, '../docs/openapi.json');

  fs.writeFileSync(outputPath, JSON.stringify(document, null, 2) + '\n');
  console.log(`OpenAPI schema successfully exported to ${outputPath}`);
  await app.close();
}

exportOpenApi().catch((err) => {
  console.error('Failed to export OpenAPI schema:', err);
  process.exit(1);
});

