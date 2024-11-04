import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import * as moment from 'moment-timezone'; // Correct import for moment-timezone

@Injectable()
export class TransformDateInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        // Check if the response contains an array of assetsDetails
        if (data && data.assetsDetails && Array.isArray(data.assetsDetails)) {
          // Apply the transformation for each object in the array
          data.assetsDetails = data.assetsDetails.map((item) =>
            this.transformDates(item),
          );
        } else if (data && data.assets && Array.isArray(data.assets)) {
          // Apply the transformation for each object in the array
          data.assets = data.assets.map((item) => this.transformDates(item));
        } else if (data && Array.isArray(data)) {
          // Apply the transformation for each object in the array
          data = data.map((item) => this.transformDates(item));
        } else {
          // If it's a single object, apply the transformation directly
          data = this.transformDates(data);
        }
        return data;
      }),
    );
  }

  // Helper function to transform date fields in an object
  private transformDates(item: any): any {
    if (item) {
      // Convert 'lastSeenTime' to EST/EDT and format it if it's a valid string
      if (item.lastSeenTime && this.isValidDate(item.lastSeenTime)) {
        item.lastSeenTime = moment
          .utc(item.lastSeenTime) // Parse as UTC
          .tz('America/New_York') // Convert to EST/EDT
          .format('MM-DD-YYYY HH:mm:ss'); // Format to desired format
      }

      //   // Convert 'returnedAt' to EST/EDT and format it, if it exists as a valid string
      //   if (item.returnedAt && this.isValidDate(item.returnedAt)) {
      //     item.returnedAt = moment
      //       .utc(item.returnedAt, 'YYYY-MM-DD HH:mm:ss') // Ensure proper format
      //       .tz('America/New_York') // Convert to EST/EDT
      //       .format('MM-DD-YYYY HH:mm:ss'); // Format the date
      //   }

      // You can repeat this for any other date fields you want to transform
    }

    return item;
  }

  // Helper function to check if a date string is valid
  private isValidDate(dateString: string): boolean {
    // Ensure the date is neither null nor empty, and is valid for moment parsing
    return moment(dateString, moment.ISO_8601, true).isValid();
  }
}
