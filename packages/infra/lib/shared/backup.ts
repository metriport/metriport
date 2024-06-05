import { Duration, CfnOutput, aws_backup as bk, aws_events as events } from "aws-cdk-lib";
import { Construct } from "constructs";

export interface BackupProps {
  /**
   * Resources to apply backup plan.
   */
  readonly resources: bk.BackupResource[];

  /**
   * The display name of the backup plan.
   */
  readonly backupPlanName: string;

  /**
   * The duration after a backup job is successfully
   * started before it must be completed or it is
   * canceled by AWS Backup.
   *
   * Note: `backupCompletionWindow` must be at least 60 minutes greater
   * than @backupStartWindows
   *
   * @default - 3 hours
   */
  readonly backupCompletionWindow?: Duration;

  /**
   * The duration after a backup is scheduled before
   * a job is canceled if it doesn't start successfully.
   *
   * @default - 1 hour less than @backupCompletionWindow
   */
  readonly backupStartWindow?: Duration;

  /**
   * Specifies the duration after creation that a recovery point is deleted.
   * Must be greater than moveToColdStorageAfter.
   *
   * @default - 30 days
   */
  readonly deleteBackupAfter?: Duration;

  /**
   * Specifies the duration after creation that a recovery point is moved to cold storage.
   *
   * @default - recovery point is never moved to cold storage
   */
  readonly moveBackupToColdStorageAfter?: Duration;

  /**
   * At what minute in the hour the backup will be ran.
   *
   * @default 15
   */
  readonly cronMinute?: number;
  /**
   * At what hour in the day the backup will be ran.
   *
   * @default 9 - will be 9AM UTC, or 1AM PST
   */
  readonly cronHour?: number;
}

/**
 * Construct to create a Backup Plan with specific backing cadence.
 *
 * @stability stable
 */
export class DailyBackup extends Construct {
  // runs by default at 9:15am UTC (1:15am PST)
  DEFAULT_CRON_UTC_HOUR = "9";
  DEFAULT_CRON_MINUTE = "15";
  DEFAULT_BACKUP_COMPLETION_WINDOW = Duration.hours(3);

  /**
   * Backup plan
   */
  public readonly backupPlan: bk.BackupPlan;
  /**
   *
   * @param scope Construct's scope
   * @param id Construct's id
   * @param props Construct's props
   */
  constructor(scope: Construct, id: string, props: BackupProps) {
    super(scope, id);

    const cronHour = props.cronHour ?? this.DEFAULT_CRON_UTC_HOUR;
    if (cronHour > 23 || cronHour < 0) {
      throw Error("cronHour must be 0 - 23");
    }
    const cronMinute = props.cronMinute ?? this.DEFAULT_CRON_MINUTE;
    if (cronMinute > 59 || cronMinute < 0) {
      throw Error("cronMinute must be 0 - 59");
    }

    const completionWindow = props.backupCompletionWindow ?? this.DEFAULT_BACKUP_COMPLETION_WINDOW;
    const startWindow = props.backupStartWindow ?? Duration.hours(completionWindow.toHours() - 1);

    if (completionWindow.toHours() - startWindow.toHours() < 1) {
      throw Error(
        "Backup completion window must be at least 60 minutes greater than backup start window"
      );
    }

    const scheduledBkRule = new bk.BackupPlanRule({
      completionWindow,
      startWindow,
      deleteAfter: props.deleteBackupAfter || Duration.days(30),
      // Only cron expressions are supported
      scheduleExpression: events.Schedule.cron({
        minute: `${cronMinute}`,
        hour: `${cronHour}`,
      }),
      moveToColdStorageAfter: props.moveBackupToColdStorageAfter,
    });

    this.backupPlan = new bk.BackupPlan(this, "BackupPlan", {
      backupPlanName: props.backupPlanName,
      backupPlanRules: [scheduledBkRule],
    });

    this.backupPlan.addSelection("BackupSelection", {
      resources: props.resources,
      allowRestores: true,
    });

    // Outputs
    const outputVars = {
      BackupPlanId: this.backupPlan.backupPlanId,
      BackupPlanArn: this.backupPlan.backupPlanArn,
    };
    Object.entries(outputVars).forEach(
      ([outName, outValue]) => new CfnOutput(this, outName, { value: outValue })
    );
  }
}
