import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { AssetRepository } from './repository/asset.repository';
import { CsvHelperService } from 'src/helpers/csvHelper.service';
import { Asset } from './schemas/assets.entity';
import {
  GroupByFilterDto,
  SearchFilterAssetsDto,
} from './dto/searchFilterAssets.dto';
import * as fs from 'fs';
import { UserService } from 'src/user/user.service';

@Injectable()
export class AssetsService {
  private readonly logger: Logger = new Logger(AssetsService.name);

  constructor(
    private readonly assetRepository: AssetRepository,
    private readonly csvHelperService: CsvHelperService,
    private readonly userService: UserService,
  ) {}

  // async createAsset(assetData: Partial<Asset>): Promise<Asset> {
  //   try {
  //     return await this.assetRepository.createAsset(assetData);
  //   } catch (error) {
  //     this.logger.error(`Error creating asset: ${error.message}`);
  //     throw new InternalServerErrorException('Failed to create asset');
  //   }
  // }

  async getAssetByDeviceId(deviceId: string): Promise<Asset> {
    try {
      if (!deviceId) {
        throw new BadRequestException('Device ID is required');
      }

      const assetsDetails =
        await this.assetRepository.findAssetByDeviceId(deviceId);
      if (!assetsDetails) {
        this.logger.warn(`Asset not found for deviceId: ${deviceId}`);
        throw new BadRequestException('Asset not found');
      }

      return assetsDetails;
    } catch (error) {
      this.logger.error(
        `Error fetching asset by deviceId: ${deviceId}, Error: ${error.message}`,
      );
      throw new InternalServerErrorException('Failed to fetch asset');
    }
  }

  async loadCsvDataToStageTable(filePath: string): Promise<void> {
    try {
      if (!filePath) {
        throw new BadRequestException('File path is required');
      }

      this.logger.log('Loading CSV data into staging table');
      const csvAssets = await this.csvHelperService.processCsv(filePath);
      if (!csvAssets || csvAssets.length === 0) {
        throw new BadRequestException('CSV file is empty or invalid');
      }

      await this.assetRepository.saveStageAsset(csvAssets);
      this.logger.log('CSV data loaded into staging table successfully.');
    } catch (error) {
      this.logger.error(
        `Error loading CSV data into staging table: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to load CSV data into staging table',
      );
    }
  }

  async processCsvWithStageComparision(filePath: string): Promise<any> {
    const startTime = Date.now();
    try {
      if (!filePath) {
        throw new BadRequestException('File path is required');
      }

      // Load CSV data into the staging table
      await this.loadCsvDataToStageTable(filePath);

      // Synchronize the main asset table with the staging table
      await this.assetRepository.syncAssetsWithStageTable();

      const endTime = Date.now();
      const processingTime = (endTime - startTime).toFixed(3);

      // Delete the file after processing
      fs.unlink(filePath, (err) => {
        if (err) {
          this.logger.error(`Error deleting file: ${filePath}`, err);
        } else {
          this.logger.log(`Successfully deleted file: ${filePath}`);
        }
      });

      this.logger.log(`Total processing time: ${processingTime} ms`);
      return { message: 'CSV file processed and synchronized successfully.' };
    } catch (error) {
      this.logger.error(`Error processing CSV file: ${error.message}`);

      // Attempt to delete the file if an error occurs
      fs.unlink(filePath, (err) => {
        if (err) {
          this.logger.error(
            `Error deleting file after failure: ${filePath}`,
            err,
          );
        }
      });

      throw new InternalServerErrorException(
        `Failed to process CSV: ${error.message}`,
      );
    }
  }

  async getAssets(
    assetsSeachFilterDto: SearchFilterAssetsDto,
    userEmail: string,
  ): Promise<Asset[]> {
    try {
      const {
        filter = {},
        searchQuery = '',
        skip = 0,
        limit = 10,
      } = assetsSeachFilterDto;

      const assetsDetails = await this.assetRepository.getAssets(
        filter,
        searchQuery,
        skip,
        limit,
      );

      if (searchQuery) {
        await this.userService.saveSearch(userEmail, searchQuery);
      }

      return assetsDetails;
    } catch (error) {
      this.logger.error(`Error fetching assets: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch assets');
    }
  }

  async getGroupBy(groupBy: GroupByFilterDto): Promise<any> {
    try {
      const result = await this.assetRepository.getMonitoringData();
      return result;
    } catch (error) {
      this.logger.error(`Error fetching group data: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch group data');
    }
  }

  async getAssetsByDescription(
    description: string,
    skip: number,
    limit: number,
  ): Promise<any> {
    try {
      const totalCount =
        await this.assetRepository.getTotalCountGroupedByDescription(
          description,
        );
      const assetsDetails = await this.assetRepository.getAssetsByDescription(
        description,
        skip,
        limit,
      );
      return { assetsDetails, totalCount };
    } catch (error) {
      this.logger.error(
        `Error fetching assets by description: ${description}, Error: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to fetch assets by description',
      );
    }
  }

  async getAllFloor() {
    try {
      return await this.assetRepository.getAllFloor();
    } catch (error) {
      this.logger.error(`Error fetching floor data: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch floor data');
    }
  }

  async getAssetsByFloor(floor: string) {
    try {
      return await this.assetRepository.getAssetCountsByFloorDepartmentAndZone(
        floor,
      );
    } catch (error) {
      this.logger.error(`Error fetching assets by floor: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch assets by floor');
    }
  }

  async getAssetByDepartment(
    floorNumber: string,
    department: string,
    zone: string,
  ): Promise<any> {
    try {
      return await this.assetRepository.getMonitoringData(
        floorNumber,
        department,
        zone,
      );
    } catch (error) {
      this.logger.error(
        `Error fetching assets by department: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to fetch assets by department',
      );
    }
  }

  async getAssetByDescriptionForDepartmentAndFloor(
    floor: string,
    department: string,
    description: string,
    zone: string,
  ): Promise<any> {
    try {
      return await this.assetRepository.getAssetByFloorDepartmentAndDescription(
        floor,
        department,
        description,
        zone,
      );
    } catch (error) {
      this.logger.error(
        `Error fetching asset by description: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to fetch asset by description',
      );
    }
  }
}
