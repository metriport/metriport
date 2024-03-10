import {
  DescribeTasksCommand,
  DescribeTasksCommandOutput,
  ECSClient,
  ListTasksCommand,
} from "@aws-sdk/client-ecs";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";

dayjs.extend(duration);

export async function getEcsTasks({
  region,
  clusterName,
  serviceName,
}: {
  region: string;
  clusterName: string;
  serviceName: string;
}): Promise<DescribeTasksCommandOutput> {
  const client = new ECSClient({ region });
  const taskList = await client.send(
    new ListTasksCommand({
      cluster: clusterName,
      serviceName,
    })
  );
  const tasks = await client.send(
    new DescribeTasksCommand({
      cluster: clusterName,
      tasks: taskList.taskArns,
    })
  );
  return tasks;
}
