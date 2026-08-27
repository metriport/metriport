import { MedicalDataSource } from "@metriport/core/external";
import {
  MetricName,
  reportAdvancedMetrics,
  Service,
} from "@metriport/core/external/aws/cloudwatch";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";

export function reportCqDirectorySearchDuration(startedAt: Date, eventType: string) {
  reportAdvancedMetrics({
    service: Service.CarequalityDirectory,
    metrics: [
      {
        name: MetricName.CQ_DIRECTORY_SEARCH_DURATION,
        unit: "Milliseconds",
        value: elapsedTimeFromNow(startedAt),
        dimensions: {
          Hie: MedicalDataSource.CAREQUALITY,
          EventType: eventType,
        },
      },
    ],
  });
}
