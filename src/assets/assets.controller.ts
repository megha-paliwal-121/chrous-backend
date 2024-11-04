import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  InternalServerErrorException,
  Req,
  Logger,
} from '@nestjs/common';
import { AssetsService } from './assets.service';
import {
  GroupByFilterDto,
  SearchFilterAssetsDto,
} from './dto/searchFilterAssets.dto';
import { Asset } from './schemas/assets.entity';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { FileInterceptor } from '@nestjs/platform-express';
import { Express } from 'express';
import { TransformDateInterceptor } from 'src/Interceptors/transform.date.interceptor';

@Controller('assets')
export class AssetsController {
  private readonly logger = new Logger(AssetsController.name); // Initialize logger

  constructor(private readonly assetsService: AssetsService) {}

  @Post('/upload-csv')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(
            null,
            `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`,
          );
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // Limit file size to 10 MB
    }),
  )
  @HttpCode(HttpStatus.CREATED)
  async uploadCsv(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Upload CSV endpoint`);
    try {
      if (!file) {
        this.logger.warn('No file uploaded or file upload failed');
        throw new BadRequestException(
          'File upload failed or no file uploaded.',
        );
      }

      const filePath = file.path;
      if (!filePath) {
        this.logger.warn('File path is undefined after upload');
        throw new BadRequestException('File path is undefined.');
      }

      this.logger.log(`Processing CSV file at path: ${filePath}`);
      await this.assetsService.processCsvWithStageComparision(filePath);

      return {
        success: true,
        message: 'CSV file uploaded and processed successfully.',
      };
    } catch (error) {
      this.logger.error(`Error uploading CSV file: ${error.message}`);
      throw new InternalServerErrorException(
        `Failed to process CSV: ${error.message}`,
      );
    }
  }

  @Post('/search')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(TransformDateInterceptor)
  @UseGuards(JwtAuthGuard)
  async getAssets(
    @Body() assetsSeachFilterDto: SearchFilterAssetsDto,
    @Req() req,
  ): Promise<Asset[]> {
    const userEmail = req.user.email; // Extract user email from JwtAuthGuard
    this.logger.log(
      `User ${userEmail} called search assets endpoint with searchQuery- ${assetsSeachFilterDto.searchQuery}`,
    );
    const assets = await this.assetsService.getAssets(
      assetsSeachFilterDto,
      userEmail,
    );
    return assets;
  }

  @Get('/:id')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(TransformDateInterceptor)
  @UseGuards(JwtAuthGuard)
  async getAssetByDeviceId(
    @Param('id') deviceId: string,
    @Req() req,
  ): Promise<Asset> {
    const userEmail = req.user.email; // Extract user email from JwtAuthGuard
    this.logger.log(
      `User ${userEmail} called get asset by device ID endpoint for ID: ${deviceId}`,
    );
    const asset = await this.assetsService.getAssetByDeviceId(deviceId);
    return asset;
  }

  @Post('/assetsList')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async getAssetsBy(
    @Body() groupBy: GroupByFilterDto,
    @Req() req,
  ): Promise<any> {
    const userEmail = req.user.email; // Extract user email from JwtAuthGuard
    this.logger.log(
      `User ${userEmail} called get assets list by group endpoint`,
    );
    const assets = await this.assetsService.getGroupBy(groupBy);
    return assets;
  }

  @Get('/description/all')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(TransformDateInterceptor)
  @UseGuards(JwtAuthGuard)
  async getAssetsByDescription(
    @Query('description') description: string,
    @Query('skip') skip = 0,
    @Query('limit') limit = 10,
    @Req() req,
  ): Promise<any> {
    const userEmail = req.user.email; // Extract user email from JwtAuthGuard
    this.logger.log(
      `User ${userEmail} called get assets by description endpoint with description: ${description}`,
    );
    const assets = await this.assetsService.getAssetsByDescription(
      description,
      Number(skip),
      Number(limit),
    );
    return assets;
  }

  @Get('/floor/all')
  @UseGuards(JwtAuthGuard)
  async getAllFoor(@Req() req) {
    const userEmail = req.user.email; // Extract user email from JwtAuthGuard
    this.logger.log(`User ${userEmail} called get all floors endpoint`);
    const floors = await this.assetsService.getAllFloor();
    return floors;
  }

  @Get('/floor/:floorNumber')
  @UseGuards(JwtAuthGuard)
  async getAssetsByFloor(
    @Param('floorNumber') floorNumber: string,
    @Req() req,
  ): Promise<any> {
    const userEmail = req.user.email; // Extract user email from JwtAuthGuard
    this.logger.log(
      `User ${userEmail} called get assets by floor endpoint for floor number: ${floorNumber}`,
    );
    const assets = await this.assetsService.getAssetsByFloor(floorNumber);
    return assets;
  }

  @Get('/floor/:floorNumber/:department/:zone')
  @UseGuards(JwtAuthGuard)
  async getAssetsByDepartment(
    @Param('floorNumber') floorNumber: string,
    @Param('department') department: string,
    @Param('zone') zone: string,
    @Req() req,
  ): Promise<any> {
    const userEmail = req.user.email; // Extract user email from JwtAuthGuard
    this.logger.log(
      `User ${userEmail} called get assets by department endpoint for floor number: ${floorNumber}, department: ${department}, zone: ${zone}`,
    );
    const assets = await this.assetsService.getAssetByDepartment(
      floorNumber,
      department,
      zone,
    );
    return assets;
  }

  @Get('/floor/:floorNumber/:department/:zone/:description')
  @UseInterceptors(TransformDateInterceptor)
  @UseGuards(JwtAuthGuard)
  async getAssetByDescriptionForDepartmentAndFloor(
    @Param('floorNumber') floorNumber: string,
    @Param('department') department: string,
    @Param('description') description: string,
    @Param('zone') zone: string,
    @Req() req,
  ): Promise<any> {
    const userEmail = req.user.email; // Extract user email from JwtAuthGuard
    this.logger.log(
      `User ${userEmail} called get asset by description for department and floor endpoint for floor number: ${floorNumber}, department: ${department}, zone: ${zone}, description: ${description}`,
    );
    const assets =
      await this.assetsService.getAssetByDescriptionForDepartmentAndFloor(
        floorNumber,
        department,
        description,
        zone,
      );
    return assets;
  }
}
